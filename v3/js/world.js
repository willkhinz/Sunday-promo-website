/* ============================================================================
   Sunday v3 — the world
   ----------------------------------------------------------------------------
   One WebGL1 context behind the document. Two things live in it:

     · a phone, built as real geometry — a rounded slab with genuine thickness,
       lit by one key light, with the hero video uploaded as a live texture on
       its front face;
     · a point cloud of ~130,000 particles that morphs between six shapes.

   The morph is a weighted sum, not a pair-lerp. Every particle carries all six
   of its home positions as attributes, and the vertex shader evaluates
       p = Σ aPi · uW[i]
   so the page can hold any blend of any shapes at once, and crossing from one
   to the next is just moving a weight vector. "How far between shapes are we"
   falls out of the same vector (1 − max(w)), which is what drives the burst:
   particles fly apart and flash white exactly in the middle of a transition,
   with nothing to keep in sync by hand.

   This module owns no timing and no scroll. main.js runs the single rAF loop,
   writes World.state, and calls World.draw(). If anything here fails, init()
   returns false and the page is simply a page.
   ========================================================================= */

window.SundayWorld = (function () {
'use strict';

var TAU = Math.PI * 2;

/* ── mat4, column-major ─────────────────────────────────────────────────── */

function m4() { return new Float32Array(16); }

function perspective(o, fovy, asp, n, f) {
  var t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
  o[0] = t / asp; o[1] = 0; o[2] = 0;  o[3] = 0;
  o[4] = 0; o[5] = t; o[6] = 0;  o[7] = 0;
  o[8] = 0; o[9] = 0; o[10] = (f + n) * nf; o[11] = -1;
  o[12] = 0; o[13] = 0; o[14] = 2 * f * n * nf; o[15] = 0;
  return o;
}

function mul(o, a, b) {                                   /* o = a · b */
  var t = mul._t || (mul._t = new Float32Array(16));
  for (var c = 0; c < 4; c++) {
    var b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    t[c * 4]     = a[0] * b0 + a[4] * b1 + a[8]  * b2 + a[12] * b3;
    t[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9]  * b2 + a[13] * b3;
    t[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    t[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  o.set(t);
  return o;
}

function translation(o, x, y, z) {
  o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=1;o[11]=0; o[12]=x;o[13]=y;o[14]=z;o[15]=1;
  return o;
}
function rotationY(o, a) {
  var c = Math.cos(a), s = Math.sin(a);
  o[0]=c;o[1]=0;o[2]=-s;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
  o[8]=s;o[9]=0;o[10]=c;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1;
  return o;
}
function rotationX(o, a) {
  var c = Math.cos(a), s = Math.sin(a);
  o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=c;o[6]=s;o[7]=0;
  o[8]=0;o[9]=-s;o[10]=c;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1;
  return o;
}

/* ── shaders ────────────────────────────────────────────────────────────── */

var PT_VS = [
'precision highp float;',
'attribute vec3 aP0,aP1,aP2,aP3,aP4,aP5;',
'attribute vec3 aSeed;',
'uniform mat4 uProj,uView,uModel;',
'uniform float uW[6];',
'uniform float uTime,uTurb,uBurst,uSize,uSpread,uDpr,uBright,uTint;',
'varying vec3 vCol;',
'varying float vI;',
'void main(){',
'  vec3 p = aP0*uW[0]+aP1*uW[1]+aP2*uW[2]+aP3*uW[3]+aP4*uW[4]+aP5*uW[5];',
'  p *= uSpread;',
   /* Cheap divergence-free-ish swirl. Not real curl noise — three shifted
      trig lobes per axis, which at this density is indistinguishable and
      costs a fraction of a simplex fetch. */
'  float t = uTime*0.24 + aSeed.z*6.2831;',
'  vec3 s = vec3(',
'    sin(p.y*1.10+t)      + cos(p.z*0.80-t*0.70),',
'    sin(p.z*0.90+t*1.10) + cos(p.x*0.70+t*0.60),',
'    sin(p.x*0.80-t*0.90) + cos(p.y*1.00+t*0.80));',
'  p += s * uTurb * (0.34 + aSeed.y*0.66);',
   /* Mid-transition explosion, along a per-particle direction. */
'  vec3 dir = normalize(aSeed*2.0-1.0+vec3(1e-4));',
'  p += dir * uBurst * (0.45 + aSeed.x*1.5);',
'  vec4 mv = uView*uModel*vec4(p,1.0);',
'  gl_Position = uProj*mv;',
'  float dist = max(-mv.z, 0.12);',
   /* gl_PointSize is in DEVICE pixels, so the DPR is already in the budget:
      13/dist at a typical 6-unit camera distance is ~2 CSS px. Anything an
      order larger turns 58,000 additive sprites into a white screen. */
   /* Squared seed: mostly fine grains with a scattering of larger ones, which
      is what gives the field a sense of near and far rather than one uniform
      grade of speckle. */
'  gl_PointSize = uSize*uDpr*(13.0/dist)*(0.30+aSeed.y*aSeed.y*1.90);',
'  vec3 warm = vec3(1.00,0.60,0.24);',
'  vec3 cool = vec3(0.36,0.69,1.00);',
'  vCol = mix(cool, warm, clamp(aSeed.x + uTint, 0.0, 1.0));',
'  vCol = mix(vCol, vec3(1.0), clamp(uBurst*1.35,0.0,1.0)*0.50);',
   /* Exposure. Each sprite is deliberately dim: the image is built out of
      thousands of them overlapping, so a peak near 1.0 per sprite would clip
      to white everywhere they pile up. Far and near ramps double as a cheap
      depth of field — points drifting past the camera dissolve instead of
      smearing across the frame. */
'  float far  = 1.0 - smoothstep(7.0, 16.0, dist);',
'  float near = smoothstep(0.90, 2.80, dist);',
'  vI = uBright * far * near * (0.10 + aSeed.y*0.30);',
'}'].join('\n');

var PT_FS = [
'precision mediump float;',
'varying vec3 vCol;',
'varying float vI;',
'void main(){',
'  float d = length(gl_PointCoord - 0.5);',
'  float a = smoothstep(0.5, 0.0, d);',
'  a *= a;',                        /* tight core, soft halo — reads as bloom */
'  gl_FragColor = vec4(vCol * (vI * a), 1.0);',
'}'].join('\n');

var MS_VS = [
'precision highp float;',
'attribute vec3 aPos,aNrm;',
'attribute vec2 aUV;',
'uniform mat4 uProj,uView,uModel;',
'varying vec3 vN,vP;',
'varying vec2 vUV;',
'void main(){',
'  vec4 wp = uModel*vec4(aPos,1.0);',
'  vP = wp.xyz;',
'  vN = mat3(uModel)*aNrm;',        /* rotation-only model — safe as a normal matrix */
'  vUV = aUV;',
'  gl_Position = uProj*uView*wp;',
'}'].join('\n');

var MS_FS = [
'precision mediump float;',
'uniform sampler2D uTex;',
'uniform vec3 uEye,uLight;',
'uniform float uAlpha;',
'varying vec3 vN,vP;',
'varying vec2 vUV;',
'void main(){',
'  vec3 N = normalize(vN);',
'  vec3 V = normalize(uEye - vP);',
'  vec3 L = normalize(uLight);',
'  vec3 H = normalize(L + V);',
'  float ndl  = max(dot(N,L), 0.0);',
'  float ndh  = max(dot(N,H), 0.0);',
'  float fres = pow(1.0 - max(dot(N,V), 0.0), 5.0);',
   /* Two-tone environment: the rails pick up a cool sky above and a near-black
      floor below, which is what actually makes anodised metal read as metal. */
'  vec3 env = mix(vec3(0.020,0.024,0.035), vec3(0.30,0.36,0.48), N.y*0.5+0.5);',
'  vec3 col;',
'  if (N.z > 0.5) {',
'    vec3 tex = texture2D(uTex, vUV).rgb;',
'    col = tex * (0.88 + 0.22*ndl);',
'    col += vec3(1.0) * pow(ndh, 110.0) * 0.75;',      /* glass highlight */
'    col += vec3(0.55,0.72,1.0) * fres * 0.30;',       /* edge-on sheen    */
'  } else {',
'    col = env + vec3(0.16,0.16,0.18) * ndl;',
'    col += vec3(1.0,0.96,0.90) * pow(ndh, 46.0) * 0.95;',
'    col += vec3(0.62,0.74,0.95) * fres * 0.55;',
'  }',
'  gl_FragColor = vec4(col * uAlpha, uAlpha);',
'}'].join('\n');

/* ── gl helpers ─────────────────────────────────────────────────────────── */

var gl = null, canvas = null;

function compile(type, src) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error('shader: ' + gl.getShaderInfoLog(s));
  }
  return s;
}

function program(vs, fs, attrs, unis) {
  var p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error('link: ' + gl.getProgramInfoLog(p));
  }
  var o = { p: p, a: {}, u: {} };
  attrs.forEach(function (n) { o.a[n] = gl.getAttribLocation(p, n); });
  unis.forEach(function (n) { o.u[n] = gl.getUniformLocation(p, n); });
  return o;
}

function buffer(data) {
  var b = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, b);
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  return b;
}

/* ── shape generators ───────────────────────────────────────────────────────
   Every generator fills a Float32Array(n*3) in the same object space: origin
   centred, roughly ±2.5, y up. Because the morph is a weighted sum they must
   agree on scale, or a crossfade would read as a zoom.                      */

function onSphereDir(out, i) {                 /* uniform direction on a sphere */
  var u = Math.random() * 2 - 1, th = Math.random() * TAU, s = Math.sqrt(1 - u * u);
  out[i] = s * Math.cos(th); out[i + 1] = u; out[i + 2] = s * Math.sin(th);
}

function shapeDust(n) {                        /* ambient shell around the hero */
  var a = new Float32Array(n * 3);
  for (var i = 0; i < n * 3; i += 3) {
    onSphereDir(a, i);
    /* Deep rather than shell-thin: a narrow band of radii puts every particle
       at roughly the same distance, and a field with no depth spread reads as
       television static instead of atmosphere. Anything that ends up close to
       the camera is dissolved by the near ramp in the shader rather than
       clamped here. */
    var r = 1.90 + Math.pow(Math.random(), 0.55) * 3.40;
    a[i] *= r; a[i + 1] *= r * 0.84; a[i + 2] *= r;
  }
  return a;
}

/* 640 × 1391 is the real screenshot aspect; the slab keeps it exactly so the
   video lands on the front face without a stretch. */
var PH_W = 1.265, PH_H = 2.75, PH_D = 0.155, PH_R = 0.185;

function roundedOutline(seg) {                 /* one closed loop, with normals */
  var hw = PH_W / 2 - PH_R, hh = PH_H / 2 - PH_R, pts = [];
  var corner = [[hw, hh, 0], [-hw, hh, Math.PI / 2], [-hw, -hh, Math.PI], [hw, -hh, Math.PI * 1.5]];
  for (var c = 0; c < 4; c++) {
    var cx = corner[c][0], cy = corner[c][1], a0 = corner[c][2];
    for (var i = 0; i <= seg; i++) {
      var a = a0 + (i / seg) * (Math.PI / 2), co = Math.cos(a), si = Math.sin(a);
      pts.push([cx + co * PH_R, cy + si * PH_R, co, si]);
    }
  }
  return pts;
}

function insideRounded(x, y) {
  var hw = PH_W / 2 - PH_R, hh = PH_H / 2 - PH_R;
  var dx = Math.max(Math.abs(x) - hw, 0), dy = Math.max(Math.abs(y) - hh, 0);
  return dx * dx + dy * dy <= PH_R * PH_R;
}

function shapePhone(n) {                       /* surface of the slab, as points */
  var a = new Float32Array(n * 3), out = roundedOutline(8);
  for (var i = 0; i < n * 3; i += 3) {
    var roll = Math.random(), x, y, z;
    if (roll < 0.70) {                         /* faces, front weighted heavier */
      do {
        x = (Math.random() - 0.5) * PH_W;
        y = (Math.random() - 0.5) * PH_H;
      } while (!insideRounded(x, y));
      z = (roll < 0.48 ? 1 : -1) * PH_D / 2 + (Math.random() - 0.5) * 0.012;
    } else {                                   /* the rim */
      var p = out[(Math.random() * out.length) | 0];
      x = p[0]; y = p[1]; z = (Math.random() - 0.5) * PH_D;
    }
    a[i] = x; a[i + 1] = y; a[i + 2] = z;
  }
  return a;
}

function shapeBall(n) {                        /* the parameter cloud */
  var a = new Float32Array(n * 3);
  for (var i = 0; i < n * 3; i += 3) {
    onSphereDir(a, i);
    var r = 1.78 * Math.pow(Math.random(), 1 / 2.7);   /* surface-biased */
    a[i] *= r; a[i + 1] *= r; a[i + 2] *= r;
  }
  return a;
}

function shapeTorus(n) {                       /* the capability ring */
  var a = new Float32Array(n * 3);
  for (var i = 0; i < n * 3; i += 3) {
    var u = Math.random() * TAU, v = Math.random() * TAU;
    var rr = 0.44 * Math.sqrt(Math.random()), R = 2.25 + rr * Math.cos(v);
    a[i] = R * Math.cos(u); a[i + 1] = rr * Math.sin(v); a[i + 2] = R * Math.sin(u);
  }
  return a;
}

function shapeLattice(n) {                     /* three planes of nodes */
  var a = new Float32Array(n * 3), GX = 26, GY = 3, GZ = 26, SX = 0.205, SY = 0.90;
  for (var i = 0; i < n * 3; i += 3) {
    var ix = (Math.random() * GX) | 0, iy = (Math.random() * GY) | 0, iz = (Math.random() * GZ) | 0;
    a[i]     = (ix - (GX - 1) / 2) * SX + (Math.random() - 0.5) * 0.05;
    a[i + 1] = (iy - (GY - 1) / 2) * SY + (Math.random() - 0.5) * 0.05;
    a[i + 2] = (iz - (GZ - 1) / 2) * SX + (Math.random() - 0.5) * 0.05;
  }
  return a;
}

function shapeFromAlpha(n, px, w, h, height) { /* the Sunday mark, from its own alpha */
  var hits = [];
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 110) hits.push(x, y);
    }
  }
  if (hits.length < 200) return null;
  var a = new Float32Array(n * 3), k = hits.length / 2, sc = height / h;
  for (var i = 0; i < n * 3; i += 3) {
    var j = (Math.random() * k) | 0;
    a[i]     = (hits[j * 2] - w / 2 + Math.random()) * sc;
    a[i + 1] = (h / 2 - hits[j * 2 + 1] + Math.random()) * sc;
    a[i + 2] = (Math.random() - 0.5) * 0.10;
  }
  return a;
}

/* ── phone mesh ─────────────────────────────────────────────────────────── */

function buildSlab(seg) {
  var out = roundedOutline(seg), pos = [], nrm = [], uv = [], hd = PH_D / 2;
  function v(x, y, z, nx, ny, nz, u, t) {
    pos.push(x, y, z); nrm.push(nx, ny, nz); uv.push(u, t);
  }
  /* Uploads use UNPACK_FLIP_Y_WEBGL, so v=1 is already the top of the image.
     Mapping the top of the phone to v=0 as well would flip it a second time
     and hand back a screenshot reflected in water. */
  function faceUV(x, y) { return [x / PH_W + 0.5, y / PH_H + 0.5]; }

  for (var i = 0; i < out.length; i++) {
    var a = out[i], b = out[(i + 1) % out.length];
    var ua = faceUV(a[0], a[1]), ub = faceUV(b[0], b[1]), uc = faceUV(0, 0);

    /* front cap — fan from centre, CCW seen from +Z */
    v(0, 0, hd, 0, 0, 1, uc[0], uc[1]);
    v(a[0], a[1], hd, 0, 0, 1, ua[0], ua[1]);
    v(b[0], b[1], hd, 0, 0, 1, ub[0], ub[1]);

    /* back cap — reversed */
    v(0, 0, -hd, 0, 0, -1, 0.5, 0.5);
    v(b[0], b[1], -hd, 0, 0, -1, 0, 0);
    v(a[0], a[1], -hd, 0, 0, -1, 0, 0);

    /* rim wall */
    v(a[0], a[1],  hd, a[2], a[3], 0, 0, 0);
    v(a[0], a[1], -hd, a[2], a[3], 0, 0, 1);
    v(b[0], b[1], -hd, b[2], b[3], 0, 1, 1);

    v(a[0], a[1],  hd, a[2], a[3], 0, 0, 0);
    v(b[0], b[1], -hd, b[2], b[3], 0, 1, 1);
    v(b[0], b[1],  hd, b[2], b[3], 0, 1, 0);
  }
  return {
    pos: new Float32Array(pos), nrm: new Float32Array(nrm),
    uv: new Float32Array(uv), count: pos.length / 3
  };
}

/* ── module state ───────────────────────────────────────────────────────── */

var ptProg, msProg, ptBufs = {}, msBufs = {}, msCount = 0;
var N = 0, drawN = 0, tex = null, video = null, videoStamp = -1;
var dpr = 1, aspect = 1, ready = false, drewOnce = false;
var mProj = m4(), mView = m4(), mWorld = m4(), mPhone = m4(), mTmp = m4(), mTmp2 = m4();
var frameMs = 16, slowRun = 0, fastRun = 0;

/* Written by main.js each frame; read here and nowhere else. `time` is a
   caller-owned clock rather than the rAF timestamp, so pausing the page
   freezes the swirl where it stands instead of snapping it to zero. */
var state = {
  w: new Float32Array([1, 0, 0, 0, 0, 0]),
  camZ: 6.2, camY: 0, rotX: 0, rotY: 0,
  spread: 1, turb: 0.3, burst: 0, size: 1, bright: 1, tint: 0,
  phone: 1, phoneRX: 0, phoneRY: 0, phoneX: 0, phoneY: 0,
  time: 0
};

/* ── init ───────────────────────────────────────────────────────────────── */

function init(cv, opts) {
  canvas = cv;
  opts = opts || {};
  try {
    var attrs = { alpha: true, antialias: false, depth: true, premultipliedAlpha: true,
                  powerPreference: 'high-performance', failIfMajorPerformanceCaveat: false };
    gl = cv.getContext('webgl', attrs) || cv.getContext('experimental-webgl', attrs);
    if (!gl) return false;

    ptProg = program(PT_VS, PT_FS,
      ['aP0','aP1','aP2','aP3','aP4','aP5','aSeed'],
      ['uProj','uView','uModel','uW[0]','uTime','uTurb','uBurst','uSize','uSpread','uDpr','uBright','uTint']);
    msProg = program(MS_VS, MS_FS,
      ['aPos','aNrm','aUV'],
      ['uProj','uView','uModel','uTex','uEye','uLight','uAlpha']);

    /* Particle budget. A phone GPU pushing 130k additive points at DPR 2 is
       not a good trade, so narrow viewports start lower; from there the
       adaptive step in draw() moves the draw count, never the buffers. */
    /* Width, not the smaller side: a short desktop window is still a desktop
       GPU, and halving its budget for having a short viewport is wrong. */
    var small = window.innerWidth < 760;
    N = opts.count || (small ? 58000 : 130000);
    drawN = N;

    var seeds = new Float32Array(N * 3);
    for (var i = 0; i < N * 3; i++) seeds[i] = Math.random();

    ptBufs.aP0 = buffer(shapeDust(N));
    ptBufs.aP1 = buffer(shapePhone(N));
    ptBufs.aP2 = buffer(shapeBall(N));
    ptBufs.aP3 = buffer(shapeBall(N));      /* replaced once the mark decodes */
    ptBufs.aP4 = buffer(shapeTorus(N));
    ptBufs.aP5 = buffer(shapeLattice(N));
    ptBufs.aSeed = buffer(seeds);

    var slab = buildSlab(9);
    msBufs.aPos = buffer(slab.pos);
    msBufs.aNrm = buffer(slab.nrm);
    msBufs.aUV  = buffer(slab.uv);
    msCount = slab.count;

    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    /* One opaque texel so the very first frame is never an undefined sample. */
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([14, 14, 18, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    gl.clearColor(0, 0, 0, 0);
    gl.disable(gl.CULL_FACE);

    loadMark(opts.mark || '../assets/img/mark.png');
    loadPoster(opts.poster || '../assets/img/chat.webp');

    /* A lost context is recoverable in principle but not worth the code here;
       stop drawing and let the page carry itself. */
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); ready = false; });

    resize();
    ready = true;
    return true;
  } catch (e) {
    if (window.console && console.warn) console.warn('SundayWorld:', e.message);
    gl = null;
    return false;
  }
}

function loadMark(src) {
  var img = new Image();
  img.onload = function () {
    try {
      var c = document.createElement('canvas');
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      var ctx = c.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      var d = ctx.getImageData(0, 0, c.width, c.height).data;
      var pts = shapeFromAlpha(N, d, c.width, c.height, 2.75);
      if (pts && gl) {
        gl.bindBuffer(gl.ARRAY_BUFFER, ptBufs.aP3);
        gl.bufferSubData(gl.ARRAY_BUFFER, 0, pts);
      }
    } catch (e) { /* tainted or unreadable: the ball stands in, silently */ }
  };
  img.src = src;
}

function loadPoster(src) {
  var img = new Image();
  img.onload = function () {
    if (!gl || videoStamp >= 0) return;              /* video already won */
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  };
  img.src = src;
}

function setVideo(el) { video = el; }

function resize() {
  if (!gl) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  var w = Math.max(1, Math.round(canvas.clientWidth  * dpr));
  var h = Math.max(1, Math.round(canvas.clientHeight * dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  gl.viewport(0, 0, w, h);
  aspect = w / h;
  perspective(mProj, 50 * Math.PI / 180, aspect, 0.1, 80);
}

/* ── draw ───────────────────────────────────────────────────────────────── */

function bindAttr(prog, name, buf, size) {
  var loc = prog.a[name];
  if (loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}

function uploadVideo() {
  if (!video || video.readyState < 2) return;
  /* Only touch the GPU when the decoder has actually moved on. A paused video
     re-uploaded every frame is 3.5 MB/frame of pure waste. */
  if (video.currentTime === videoStamp) return;
  videoStamp = video.currentTime;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  try {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
  } catch (e) { video = null; }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

function draw(nowMs, dtMs) {
  if (!gl || !ready) return;

  /* Adaptive draw count. The buffers never change size; we simply stop
     feeding the rasteriser once it says it is behind, and give it back when
     it says it is not. Two-sided so a brief hitch is not permanent. */
  frameMs += (Math.min(dtMs, 60) - frameMs) * 0.06;
  if (frameMs > 23) { slowRun++; fastRun = 0; } else if (frameMs < 15) { fastRun++; slowRun = 0; }
  if (slowRun > 45) { drawN = Math.max((N * 0.28) | 0, (drawN * 0.72) | 0); slowRun = 0; }
  else if (fastRun > 160 && drawN < N) { drawN = Math.min(N, (drawN * 1.22) | 0); fastRun = 0; }

  uploadVideo();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  translation(mView, 0, -state.camY, -state.camZ);
  mul(mWorld, rotationX(mWorld, state.rotX), rotationY(mTmp, state.rotY));

  /* ── the phone: drawn first so the cloud behind it is genuinely occluded
        and the cloud in front genuinely glows over it.

        Depth is written only while it is effectively opaque. A half-faded
        phone that still wrote depth would go on hiding the particles behind
        it — you would see through the glass to nothing, which is the one
        thing a dissolve must not do. */
  if (state.phone > 0.01) {
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(state.phone > 0.985);
    gl.enable(gl.BLEND);
    /* The fragment shader premultiplies by uAlpha, so the source factor is
       ONE, not SRC_ALPHA — otherwise alpha is applied twice. */
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    gl.useProgram(msProg.p);
    mul(mPhone, translation(mPhone, state.phoneX, state.phoneY, 0),
        mul(mTmp, rotationX(mTmp, state.phoneRX), rotationY(mTmp2, state.phoneRY)));
    gl.uniformMatrix4fv(msProg.u.uProj, false, mProj);
    gl.uniformMatrix4fv(msProg.u.uView, false, mView);
    gl.uniformMatrix4fv(msProg.u.uModel, false, mPhone);
    gl.uniform3f(msProg.u.uEye, 0, state.camY, state.camZ);
    gl.uniform3f(msProg.u.uLight, -0.42, 0.78, 0.72);
    gl.uniform1f(msProg.u.uAlpha, state.phone);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(msProg.u.uTex, 0);
    bindAttr(msProg, 'aPos', msBufs.aPos, 3);
    bindAttr(msProg, 'aNrm', msBufs.aNrm, 3);
    bindAttr(msProg, 'aUV',  msBufs.aUV,  2);
    gl.drawArrays(gl.TRIANGLES, 0, msCount);
  } else {
    gl.enable(gl.DEPTH_TEST);
    gl.depthMask(true);
  }

  /* ── the cloud: additive, depth-tested but not depth-written, so the
        130k points composite in any order without sorting. */
  if (state.bright > 0.004) {
    gl.depthMask(false);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);

    gl.useProgram(ptProg.p);
    gl.uniformMatrix4fv(ptProg.u.uProj, false, mProj);
    gl.uniformMatrix4fv(ptProg.u.uView, false, mView);
    gl.uniformMatrix4fv(ptProg.u.uModel, false, mWorld);
    gl.uniform1fv(ptProg.u['uW[0]'], state.w);
    gl.uniform1f(ptProg.u.uTime,   state.time);
    gl.uniform1f(ptProg.u.uTurb,   state.turb);
    gl.uniform1f(ptProg.u.uBurst,  state.burst);
    gl.uniform1f(ptProg.u.uSize,   state.size);
    gl.uniform1f(ptProg.u.uSpread, state.spread);
    gl.uniform1f(ptProg.u.uDpr,    dpr);
    gl.uniform1f(ptProg.u.uBright, state.bright);
    gl.uniform1f(ptProg.u.uTint,   state.tint);
    bindAttr(ptProg, 'aP0', ptBufs.aP0, 3);
    bindAttr(ptProg, 'aP1', ptBufs.aP1, 3);
    bindAttr(ptProg, 'aP2', ptBufs.aP2, 3);
    bindAttr(ptProg, 'aP3', ptBufs.aP3, 3);
    bindAttr(ptProg, 'aP4', ptBufs.aP4, 3);
    bindAttr(ptProg, 'aP5', ptBufs.aP5, 3);
    bindAttr(ptProg, 'aSeed', ptBufs.aSeed, 3);
    gl.drawArrays(gl.POINTS, 0, drawN);
  }

  if (!drewOnce) { drewOnce = true; canvas.classList.add('live'); }
}

return {
  init: init, resize: resize, draw: draw, setVideo: setVideo,
  state: state,
  get ok()    { return !!gl && ready; },
  get phoneSize() { return { w: PH_W, h: PH_H }; },
  get count() { return drawN; },
  get budget(){ return N; },
  get ms()    { return frameMs; }
};

})();
