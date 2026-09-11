/* ============================================================================
   Sunday — hero3d
   ----------------------------------------------------------------------------
   Two WebGL layers, one animation frame:

     · a page-wide field of white dots, fixed behind the whole document;
     · the hero's phone — a real handset built from geometry, not a slab —
       lit by one key light, carrying the app as a live video texture, with
       its own denser dots around it.

   Why the phone is modelled rather than downloaded. Apple's guidelines for
   third parties require their product images be used unmodified — no
   tilting, animating or rotating — and this one turns to the pointer, so
   their assets are out on their own terms. Ready-made "iPhone" meshes carry
   the same trademark problem plus licences that are usually unclear, and
   would drag in a glTF loader and megabytes of payload for a shape that is,
   in the end, an extruded squircle. So: a generic modern handset, built to
   real proportions, with the details that actually make a phone read as a
   phone — continuous-curvature corners, a contoured rail, a bezel with the
   display inset behind it, side buttons, a display cutout.

   The hero layer does not lay itself out. The existing .hero-shot .phone
   stays where it was, keeps its size and its alt text, and simply stops
   painting; every frame this file measures that box and solves for the
   camera-space position and scale that projects onto it.

   It stays out of the way when it should: no WebGL, <=768px, Reduce Motion,
   and scrolled away are all handled — see the wiring at the foot.
   ========================================================================= */

(function () {
'use strict';

var host = document.querySelector('.hero');
var shot = document.querySelector('.hero-shot .phone');
var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var TAU = Math.PI * 2;

/* ── mat4 ───────────────────────────────────────────────────────────────── */

function m4() { return new Float32Array(16); }
function perspective(o, fovy, asp, n, f) {
  var t = 1 / Math.tan(fovy / 2), nf = 1 / (n - f);
  o[0] = t / asp; o[1] = o[2] = o[3] = 0;
  o[4] = 0; o[5] = t; o[6] = o[7] = 0;
  o[8] = o[9] = 0; o[10] = (f + n) * nf; o[11] = -1;
  o[12] = o[13] = 0; o[14] = 2 * f * n * nf; o[15] = 0;
  return o;
}
function mul(o, a, b) {
  var t = mul._t || (mul._t = new Float32Array(16));
  for (var c = 0; c < 4; c++) {
    var b0 = b[c*4], b1 = b[c*4+1], b2 = b[c*4+2], b3 = b[c*4+3];
    t[c*4]   = a[0]*b0 + a[4]*b1 + a[8]*b2  + a[12]*b3;
    t[c*4+1] = a[1]*b0 + a[5]*b1 + a[9]*b2  + a[13]*b3;
    t[c*4+2] = a[2]*b0 + a[6]*b1 + a[10]*b2 + a[14]*b3;
    t[c*4+3] = a[3]*b0 + a[7]*b1 + a[11]*b2 + a[15]*b3;
  }
  o.set(t); return o;
}
function trs(o, x, y, z, s) {
  o[0]=s;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=s;o[6]=0;o[7]=0;
  o[8]=0;o[9]=0;o[10]=s;o[11]=0; o[12]=x;o[13]=y;o[14]=z;o[15]=1; return o;
}
function rotY(o, a) { var c=Math.cos(a), s=Math.sin(a);
  o[0]=c;o[1]=0;o[2]=-s;o[3]=0; o[4]=0;o[5]=1;o[6]=0;o[7]=0;
  o[8]=s;o[9]=0;o[10]=c;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1; return o; }
function rotX(o, a) { var c=Math.cos(a), s=Math.sin(a);
  o[0]=1;o[1]=0;o[2]=0;o[3]=0; o[4]=0;o[5]=c;o[6]=s;o[7]=0;
  o[8]=0;o[9]=-s;o[10]=c;o[11]=0; o[12]=0;o[13]=0;o[14]=0;o[15]=1; return o; }
function clamp(v,a,b){ return v<a?a:v>b?b:v; }

/* ── the handset ────────────────────────────────────────────────────────────
   Proportions from a real 6.1" flagship: 70.6 x 146.6 x 8.25mm, ~12mm corner
   radius. The display is derived from the screenshot's own aspect so the
   texture lands on it without a stretch, and the body is that plus a uniform
   bezel — which is the single biggest reason the old slab did not read as a
   phone: the artwork ran clean off its edges.                              */

var SCR_H = 2.60, SCR_W = SCR_H * 0.4601;       /* 640:1391, exactly */
/* The display carried a 0.042 bezel and sat behind a rail chamfered 0.030 in
   from its widest point — together about 10px of frame at the size this
   renders, which read as the artwork stopping short of the edges rather than
   as a phone. Thinner on both counts: the display is now ~96% of the body
   width instead of 93%, and the glass runs much closer to the rail. */
var BEZEL = 0.025;
var PH_H  = SCR_H + BEZEL * 2;
var PH_W  = SCR_W + BEZEL * 2;
var PH_D  = 0.155;
var PH_R  = 0.218;                              /* body corner radius */
var SCR_R = PH_R - BEZEL;

/* Continuous curvature, not a circular arc. A quarter superellipse with this
   exponent is what separates the modern handset silhouette from a
   rounded rectangle — the corner keeps bending instead of meeting the
   straight edge at a hard change of curvature. */
var SQ = 5, SQ_P = 2 / SQ, SQ_N = (SQ - 1) * SQ_P;

function outline(hw, hh, r, seg) {
  var pts = [], cx = hw - r, cy = hh - r;
  var corner = [[cx, cy, 0], [-cx, cy, Math.PI/2], [-cx, -cy, Math.PI], [cx, -cy, Math.PI*1.5]];
  for (var c = 0; c < 4; c++) {
    var ox = corner[c][0], oy = corner[c][1], a0 = corner[c][2];
    for (var i = 0; i <= seg; i++) {
      var a  = a0 + (i / seg) * (Math.PI / 2);
      var co = Math.cos(a), si = Math.sin(a);
      var sc = co < 0 ? -1 : 1, ss = si < 0 ? -1 : 1;
      var ac = Math.abs(co),    as = Math.abs(si);
      var px = sc * Math.pow(ac, SQ_P) * r;
      var py = ss * Math.pow(as, SQ_P) * r;
      /* Outward normal is the gradient of |x/r|^SQ + |y/r|^SQ. */
      var gx = sc * Math.pow(ac, SQ_N), gy = ss * Math.pow(as, SQ_N);
      var gl = Math.hypot(gx, gy) || 1;
      pts.push([ox + px, oy + py, gx / gl, gy / gl]);
    }
  }
  return pts;
}

/* The rail's cross-section, front to back: tucked in where the glass meets
   it, widest at the middle. That inflexion is what puts a moving highlight
   line down the side of the device instead of a flat grey band. */
var PROFILE = [
  { z:  0.500, r: 0.0170 },
  { z:  0.330, r: 0.0032 },
  { z:  0.000, r: 0.0000 },
  { z: -0.330, r: 0.0032 },
  { z: -0.500, r: 0.0200 }
];

var K_RAIL = 0, K_SCREEN = 1, K_BEZEL = 2, K_BACK = 3, K_BUTTON = 4;

function buildPhone(seg) {
  var pos = [], nrm = [], uv = [], knd = [];
  function v(x, y, z, nx, ny, nz, u, t, k) {
    pos.push(x, y, z); nrm.push(nx, ny, nz); uv.push(u, t); knd.push(k);
  }
  function quad(a, b, c, d, n, k) {          /* a,b,c,d CCW seen from outside */
    v(a[0],a[1],a[2], n[0],n[1],n[2], 0,0,k);
    v(b[0],b[1],b[2], n[0],n[1],n[2], 0,0,k);
    v(c[0],c[1],c[2], n[0],n[1],n[2], 0,0,k);
    v(a[0],a[1],a[2], n[0],n[1],n[2], 0,0,k);
    v(c[0],c[1],c[2], n[0],n[1],n[2], 0,0,k);
    v(d[0],d[1],d[2], n[0],n[1],n[2], 0,0,k);
  }

  var body = outline(PH_W/2, PH_H/2, PH_R, seg);
  var scr  = outline(SCR_W/2, SCR_H/2, SCR_R, seg);
  var n = body.length;

  /* ---- rail: sweep the profile around the body outline ---- */
  for (var b = 0; b < PROFILE.length - 1; b++) {
    var p0 = PROFILE[b], p1 = PROFILE[b+1];
    var dz = (p1.z - p0.z) * PH_D;
    var dr = -(p1.r - p0.r);
    var nl = Math.hypot(dz, dr) || 1;
    var n2x = -dz / nl, n2y = dr / nl;        /* outward in the (radial, z) plane */
    for (var i = 0; i < n; i++) {
      var a = body[i], c = body[(i+1) % n];
      var A0 = [a[0] - a[2]*p0.r, a[1] - a[3]*p0.r, p0.z*PH_D];
      var A1 = [a[0] - a[2]*p1.r, a[1] - a[3]*p1.r, p1.z*PH_D];
      var C0 = [c[0] - c[2]*p0.r, c[1] - c[3]*p0.r, p0.z*PH_D];
      var C1 = [c[0] - c[2]*p1.r, c[1] - c[3]*p1.r, p1.z*PH_D];
      /* Per-vertex normals from each point's own outward direction, so the
         squircle corners shade as a continuous curve rather than facets. */
      var na = [a[2]*n2x, a[3]*n2x, n2y], nc = [c[2]*n2x, c[3]*n2x, n2y];
      v(A0[0],A0[1],A0[2], na[0],na[1],na[2], 0,0, K_RAIL);
      v(A1[0],A1[1],A1[2], na[0],na[1],na[2], 0,0, K_RAIL);
      v(C1[0],C1[1],C1[2], nc[0],nc[1],nc[2], 0,0, K_RAIL);
      v(A0[0],A0[1],A0[2], na[0],na[1],na[2], 0,0, K_RAIL);
      v(C1[0],C1[1],C1[2], nc[0],nc[1],nc[2], 0,0, K_RAIL);
      v(C0[0],C0[1],C0[2], nc[0],nc[1],nc[2], 0,0, K_RAIL);
    }
  }

  /* ---- front bezel: a ring between the body edge and the display ---- */
  var fz = PH_D/2, inset = PROFILE[0].r;
  for (var i2 = 0; i2 < n; i2++) {
    var a2 = body[i2], c2 = body[(i2+1) % n];
    var s2 = scr[i2],  t2 = scr[(i2+1) % n];
    quad([a2[0]-a2[2]*inset, a2[1]-a2[3]*inset, fz],
         [s2[0], s2[1], fz],
         [t2[0], t2[1], fz],
         [c2[0]-c2[2]*inset, c2[1]-c2[3]*inset, fz],
         [0,0,1], K_BEZEL);
  }

  /* ---- display: a hair under the glass, so the bezel has an edge ---- */
  var sz = PH_D/2 - 0.0016;
  for (var i3 = 0; i3 < n; i3++) {
    var s3 = scr[i3], t3 = scr[(i3+1) % n];
    v(0, 0, sz, 0,0,1, 0.5, 0.5, K_SCREEN);
    v(s3[0], s3[1], sz, 0,0,1, s3[0]/SCR_W + 0.5, s3[1]/SCR_H + 0.5, K_SCREEN);
    v(t3[0], t3[1], sz, 0,0,1, t3[0]/SCR_W + 0.5, t3[1]/SCR_H + 0.5, K_SCREEN);
  }

  /* ---- back ---- */
  var bz = -PH_D/2;
  for (var i4 = 0; i4 < n; i4++) {
    var a4 = body[i4], c4 = body[(i4+1) % n];
    v(0, 0, bz, 0,0,-1, 0,0, K_BACK);
    v(c4[0]-c4[2]*inset, c4[1]-c4[3]*inset, bz, 0,0,-1, 0,0, K_BACK);
    v(a4[0]-a4[2]*inset, a4[1]-a4[3]*inset, bz, 0,0,-1, 0,0, K_BACK);
  }

  /* ---- side buttons ---- */
  /* Emits a quad with the normal taken from its own winding, flipping both if
     that normal comes out pointing inward. `hint` is any vector known to face
     outward — here, centre-of-part to centre-of-face. Hand-winding twenty
     small faces across two mirrored sides is exactly how you end up with one
     culled away as a hole; this cannot produce one. */
  function quadOut(a, b, c, d, k, hint) {
    var e1 = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    var e2 = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    var n = [e1[1]*e2[2] - e1[2]*e2[1],
             e1[2]*e2[0] - e1[0]*e2[2],
             e1[0]*e2[1] - e1[1]*e2[0]];
    if (n[0]*hint[0] + n[1]*hint[1] + n[2]*hint[2] < 0) {
      var t = b; b = d; d = t;                 /* reverse the winding … */
      n = [-n[0], -n[1], -n[2]];               /* … and the normal with it */
    }
    var l = Math.hypot(n[0], n[1], n[2]) || 1;
    quad(a, b, c, d, [n[0]/l, n[1]/l, n[2]/l], k);
  }

  /* The old button was a flat pad whose outer face carried the normal
     [side,0,0] — the very normal the rail already has along its flat sides.
     Same normal and same material means identical shading, so the only thing
     separating button from body was 2.8px of edge seen almost edge-on. It had
     no depth because nothing in the lighting could tell it was there.

     Now it stands twice as proud and its edges are chamfered, so the bevel
     catches the key light at an angle neither the pad nor the rail does and
     draws a bright line right around the part. Its own material finishes the
     job: a shade darker and less polished than the rail, the way a real
     button is. */
  function button(side, y0, y1) {            /* side: +1 right, -1 left */
    var PR = 0.024, CH = 0.010;
    var base = side * (PH_W/2 - 0.004);      /* a touch inside, so no seam gap */
    var top  = side * (PH_W/2 + PR);
    var z0 = -PH_D*0.32, z1 = PH_D*0.32;
    var ay0 = y0 + CH, ay1 = y1 - CH, az0 = z0 + CH, az1 = z1 - CH;

    var face = [[ay0,az0], [ay1,az0], [ay1,az1], [ay0,az1]];
    var skirt = [[y0,z0], [y1,z0], [y1,z1], [y0,z1]];
    var cen = [base, (y0+y1)/2, (z0+z1)/2];
    function hintTo(pts) {
      var m = [0,0,0];
      pts.forEach(function (p) { m[0]+=p[0]/pts.length; m[1]+=p[1]/pts.length; m[2]+=p[2]/pts.length; });
      return [m[0]-cen[0], m[1]-cen[1], m[2]-cen[2]];
    }

    var o = face.map(function (p) { return [top, p[0], p[1]]; });
    quadOut(o[0], o[1], o[2], o[3], K_BUTTON, hintTo(o));

    for (var i = 0; i < 4; i++) {
      var j = (i+1) % 4;
      var q = [[top, face[i][0], face[i][1]], [top, face[j][0], face[j][1]],
               [base, skirt[j][0], skirt[j][1]], [base, skirt[i][0], skirt[i][1]]];
      quadOut(q[0], q[1], q[2], q[3], K_BUTTON, hintTo(q));
    }
  }
  button( 1,  0.30,  0.86);        /* power */
  button(-1,  0.42,  0.74);        /* volume up */
  button(-1,  0.06,  0.38);        /* volume down */
  button(-1,  0.92,  1.06);        /* action */

  return { pos: new Float32Array(pos), nrm: new Float32Array(nrm),
           uv: new Float32Array(uv), knd: new Float32Array(knd),
           count: pos.length / 3 };
}

/* ── shaders ────────────────────────────────────────────────────────────── */

var PT_VS = [
'precision highp float;',
'attribute vec3 aPos, aSeed;',
'uniform mat4 uProj, uView, uModel;',
'uniform float uTime, uDpr, uFade, uSize, uGain, uNear, uFar;',
'varying float vI;',
'void main(){',
'  vec3 p = aPos;',
'  float t = uTime*0.16 + aSeed.z*6.2831;',
'  p += vec3(sin(p.y*0.9+t), cos(p.x*0.7-t*0.8), sin(p.z*0.8+t*0.6)) * 0.22;',
'  vec4 mv = uView*uModel*vec4(p,1.0);',
'  gl_Position = uProj*mv;',
'  float dist = max(-mv.z, 0.15);',
'  gl_PointSize = uDpr*(uSize/dist)*(0.30+aSeed.y*aSeed.y*1.7);',
'  float far  = 1.0 - smoothstep(uFar, uFar*2.0, dist);',
'  float near = smoothstep(uNear, uNear*3.2, dist);',
'  vI = uFade * uGain * far * near * (0.13 + aSeed.y*0.34);',
'}'].join('\n');

var PT_FS = [
'precision mediump float;',
'varying float vI;',
'void main(){',
'  float d = length(gl_PointCoord - 0.5);',
'  float a = smoothstep(0.5, 0.0, d); a *= a;',
'  gl_FragColor = vec4(vec3(1.0) * (vI * a), 1.0);',
'}'].join('\n');

var MS_VS = [
'precision highp float;',
'attribute vec3 aPos, aNrm;',
'attribute vec2 aUV;',
'attribute float aKind;',
'uniform mat4 uProj, uView, uModel, uRot;',
'varying vec3 vN, vP;',
'varying vec2 vUV;',
'varying float vKind;',
'void main(){',
'  vec4 wp = uModel*vec4(aPos,1.0);',
'  vP = wp.xyz;',
   /* uModel carries a uniform scale, which would shorten every normal by the
      same factor and dim the whole object. The rotation alone is the normal
      matrix. */
'  vN = mat3(uRot)*aNrm;',
'  vUV = aUV; vKind = aKind;',
'  gl_Position = uProj*uView*wp;',
'}'].join('\n');

var MS_FS = [
'precision mediump float;',
'uniform sampler2D uTex;',
'uniform vec3 uEye, uLight;',
'varying vec3 vN, vP;',
'varying vec2 vUV;',
'varying float vKind;',
   /* Rounded-box distance, for the display cutout. */
'float box(vec2 p, vec2 b, float r){',
'  vec2 d = abs(p) - b;',
'  return length(max(d,0.0)) + min(max(d.x,d.y),0.0) - r;',
'}',
'void main(){',
'  vec3 N = normalize(vN);',
'  vec3 V = normalize(uEye - vP);',
'  vec3 L = normalize(uLight);',
'  vec3 H = normalize(L + V);',
'  float ndl  = max(dot(N,L), 0.0);',
'  float ndh  = max(dot(N,H), 0.0);',
'  float fres = pow(1.0 - max(dot(N,V), 0.0), 5.0);',
   /* Grey two-tone environment: bright above, near-black floor below. The
      gradient is what makes anodised metal read as metal — not the hue. */
'  vec3 env = mix(vec3(0.020), vec3(0.34), N.y*0.5+0.5);',
'  vec3 col;',
'  if (vKind < 0.5) {',                                   /* rail */
'    col = env + vec3(0.17)*ndl;',
'    col += vec3(1.0)*pow(ndh, 44.0)*1.05;',
'    col += vec3(0.80)*fres*0.55;',
'  } else if (vKind < 1.5) {',                            /* display */
'    vec3 tex = texture2D(uTex, vUV).rgb;',
'    float isl = 1.0 - smoothstep(-0.0018, 0.0018, box(vUV-vec2(0.5,0.9575), vec2(0.104,0.0062), 0.0092));',
'    tex = mix(tex, vec3(0.006), isl);',
'    col = tex * (0.93 + 0.15*ndl);',
'    col += vec3(1.0)*pow(ndh, 150.0)*0.45;',
'    col += vec3(0.72)*fres*0.20;',
'  } else if (vKind < 2.5) {',                            /* bezel glass */
'    col = vec3(0.014) + vec3(0.05)*ndl;',
'    col += vec3(1.0)*pow(ndh, 130.0)*0.75;',
'    col += vec3(0.82)*fres*0.55;',
'  } else if (vKind < 3.5) {',                            /* back */
'    col = mix(vec3(0.028), vec3(0.125), N.y*0.5+0.5) + vec3(0.06)*ndl;',
'    col += vec3(0.70)*fres*0.30;',
'  } else {',                                             /* side button */
   /* Darker and less polished than the rail it sits on. Matching the rail
      exactly is what made the old pad invisible. */
'    col = env*0.52 + vec3(0.115)*ndl;',
'    col += vec3(1.0)*pow(ndh, 26.0)*0.60;',
'    col += vec3(0.72)*fres*0.42;',
'  }',
'  gl_FragColor = vec4(col, 1.0);',
'}'].join('\n');

/* ── a renderer ─────────────────────────────────────────────────────────── */

function makeLayer(canvas, opts) {
  var gl;
  try {
    var attrs = { alpha: true, antialias: false, depth: true,
                  premultipliedAlpha: true, powerPreference: 'high-performance' };
    gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
  } catch (e) { gl = null; }
  if (!gl) return null;

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs, as, us) {
    var p = gl.createProgram();
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var o = { p: p, a: {}, u: {} };
    as.forEach(function (nm) { o.a[nm] = gl.getAttribLocation(p, nm); });
    us.forEach(function (nm) { o.u[nm] = gl.getUniformLocation(p, nm); });
    return o;
  }
  function buffer(data) {
    var b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    return b;
  }
  function bind(prog, nm, buf, size) {
    var loc = prog.a[nm];
    if (loc < 0) return;
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
  }

  var ptProg, msProg;
  try {
    ptProg = program(PT_VS, PT_FS, ['aPos','aSeed'],
      ['uProj','uView','uModel','uTime','uDpr','uFade','uSize','uGain','uNear','uFar']);
    if (opts.phone) msProg = program(MS_VS, MS_FS, ['aPos','aNrm','aUV','aKind'],
      ['uProj','uView','uModel','uRot','uTex','uEye','uLight']);
  } catch (e) {
    if (window.console && console.warn) console.warn('hero3d:', e.message);
    return null;
  }

  var N = opts.dots, ptBuf = buffer(opts.cloud(N));
  var seeds = new Float32Array(N * 3);
  for (var i = 0; i < N * 3; i++) seeds[i] = Math.random();
  var seedBuf = buffer(seeds);

  var mesh = null, tex = null;
  if (opts.phone) {
    var g = buildPhone(10);
    mesh = { pos: buffer(g.pos), nrm: buffer(g.nrm), uv: buffer(g.uv),
             knd: buffer(g.knd), count: g.count };
    tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                  new Uint8Array([10,10,12,255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  }

  gl.clearColor(0,0,0,0);
  gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);

  var mProj = m4(), mView = m4(), mModel = m4(), mRot = m4(), mA = m4(), mB = m4();
  var dpr = 1, cw = 1, ch = 1;

  return {
    gl: gl, meshCount: mesh ? mesh.count : 0, dots: N,
    setTexture: function (src, flip) {
      if (!tex) return;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, !!flip);
      try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
      catch (e) { /* a frame we cannot upload is a frame we skip */ }
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    },
    clear: function () { gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); },
    resize: function (w, h, fov, camZ) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      cw = Math.max(1, w); ch = Math.max(1, h);
      var pw = Math.round(cw*dpr), ph = Math.round(ch*dpr);
      if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
      gl.viewport(0, 0, pw, ph);
      perspective(mProj, fov, cw/ch, 0.1, 120);
      return { halfH: camZ * Math.tan(fov/2), halfW: camZ * Math.tan(fov/2) * (cw/ch) };
    },
    frame: function (s) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      trs(mView, 0, 0, -s.camZ, 1);

      /* Dots FIRST, so they are a backdrop and nothing else. Drawn after the
         object they were depth-tested but additive, so every dot that happened
         to pass in front of the phone glowed over its screen — a haze of white
         specks across the artwork. Drawn first, the opaque object simply covers
         them, and the field reads as depth behind it. */
      if (s.fade > 0.004) {
        gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(ptProg.p);
        mul(mModel, trs(mModel, s.dx, s.dy, 0, s.dscale), rotY(mA, s.dry));
        gl.uniformMatrix4fv(ptProg.u.uProj, false, mProj);
        gl.uniformMatrix4fv(ptProg.u.uView, false, mView);
        gl.uniformMatrix4fv(ptProg.u.uModel, false, mModel);
        gl.uniform1f(ptProg.u.uTime, s.time);
        gl.uniform1f(ptProg.u.uDpr, dpr);
        gl.uniform1f(ptProg.u.uFade, s.fade);
        gl.uniform1f(ptProg.u.uSize, opts.dotSize);
        gl.uniform1f(ptProg.u.uGain, opts.gain);
        gl.uniform1f(ptProg.u.uNear, opts.near);
        gl.uniform1f(ptProg.u.uFar, opts.far);
        bind(ptProg,'aPos',ptBuf,3); bind(ptProg,'aSeed',seedBuf,3);
        gl.drawArrays(gl.POINTS, 0, N);
      }

      if (mesh && s.phone) {
        gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        gl.useProgram(msProg.p);
        mul(mRot, rotX(mA, s.rx), rotY(mB, s.ry));
        mul(mModel, trs(mModel, s.px, s.py, 0, s.scale), mRot);
        gl.uniformMatrix4fv(msProg.u.uProj, false, mProj);
        gl.uniformMatrix4fv(msProg.u.uView, false, mView);
        gl.uniformMatrix4fv(msProg.u.uModel, false, mModel);
        gl.uniformMatrix4fv(msProg.u.uRot, false, mRot);
        gl.uniform3f(msProg.u.uEye, 0, 0, s.camZ);
        gl.uniform3f(msProg.u.uLight, -0.40, 0.76, 0.72);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.uniform1i(msProg.u.uTex, 0);
        bind(msProg,'aPos',mesh.pos,3); bind(msProg,'aNrm',mesh.nrm,3);
        bind(msProg,'aUV',mesh.uv,2);   bind(msProg,'aKind',mesh.knd,1);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
      }
    }
  };
}

/* ── clouds ─────────────────────────────────────────────────────────────── */

/* Wide and shallow, not a ball. The object ends up ~4.5 world units tall with
   the camera 7 away, so a cloud deep enough to look spherical puts half its
   dots behind the camera and the rest past the distance fade. */
function heroCloud(n) {
  var a = new Float32Array(n*3);
  for (var i = 0; i < n*3; i += 3) {
    var u = Math.random()*2-1, th = Math.random()*TAU, s = Math.sqrt(1-u*u);
    var r = (0.42 + Math.pow(Math.random(), 0.65)*0.62) * PH_H;
    a[i] = s*Math.cos(th)*r*1.45; a[i+1] = u*r*0.95; a[i+2] = s*Math.sin(th)*r*0.42;
  }
  return a;
}

/* A tall slab for the page layer: it is scrolled through rather than orbited,
   so it needs height far more than depth. */
function pageCloud(n) {
  var a = new Float32Array(n*3);
  for (var i = 0; i < n*3; i += 3) {
    a[i]   = (Math.random()*2-1) * 9.0;
    a[i+1] = (Math.random()*2-1) * 14.0;
    a[i+2] = (Math.random()*2-1) * 2.6;
  }
  return a;
}

/* ── layers ─────────────────────────────────────────────────────────────── */

var FOV = 45 * Math.PI/180, CAM_Z = 7;

var pageCanvas = document.createElement('canvas');
pageCanvas.className = 'pagedots';
pageCanvas.setAttribute('aria-hidden', 'true');
document.body.insertBefore(pageCanvas, document.body.firstChild);
var page = makeLayer(pageCanvas, {
  dots: window.innerWidth < 900 ? 14000 : 26000, cloud: pageCloud,
  dotSize: 13, gain: 0.62, near: 1.0, far: 13.0, phone: false
});
if (!page) pageCanvas.remove();

var heroCanvas = null, hero = null;
if (host && shot) {
  heroCanvas = document.createElement('canvas');
  heroCanvas.className = 'hero3d';
  heroCanvas.setAttribute('aria-hidden', 'true');
  hero = makeLayer(heroCanvas, {
    dots: window.innerWidth < 1100 ? 24000 : 46000, cloud: heroCloud,
    dotSize: 13, gain: 1, near: 1.0, far: 11.0, phone: true
  });
  if (hero) host.insertBefore(heroCanvas, host.firstChild);
  else heroCanvas = null;
}
if (!page && !hero) return;

/* ── screen texture ─────────────────────────────────────────────────────── */

var video = null, vStamp = -1;

if (hero) {
  var img = new Image();
  img.onload = function () { if (vStamp < 0) { hero.setTexture(img, true); dirty = true; } };
  img.src = 'assets/img/chat.webp';

  if (!reduced) {
    video = document.createElement('video');
    video.muted = true; video.loop = true; video.playsInline = true;
    video.setAttribute('playsinline',''); video.preload = 'auto';
    /* H.264 only. Both of this project's portrait VP9 encodes — this clip and
       the settings clip — fail to decode (MEDIA_ERR_DECODE in Chromium,
       "Unable to play media" in Safari) while their MP4 siblings and the
       landscape hero WebM all play. Source selection happens once, so a
       browser that picks the WebM fails and never falls back. */
    var s = document.createElement('source');
    s.src = 'assets/video/hero-answer.mp4'; s.type = 'video/mp4';
    video.appendChild(s);
    /* Near-zero opacity rather than display:none — a video that is not
       rendered at all does not reliably produce frames to upload. */
    video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1';
    document.body.appendChild(video);
  }
}

function playVideo() {
  if (!video || document.hidden) return;
  var p = video.play();
  if (p && p.catch) p.catch(function () {});
}
document.addEventListener('visibilitychange', function () { if (!document.hidden) playVideo(); });
window.addEventListener('pointerdown', playVideo, { passive: true });
window.addEventListener('keydown', playVideo, { passive: true });

/* ── placement, solved from the DOM box ─────────────────────────────────── */

var place = { x:0, y:0, s:1 }, live = false, heroBox = null;
var pageDims = { halfH: 1, halfW: 1 };

/* Offsets, deliberately, not getBoundingClientRect. The element we measure
   carries .reveal (translateY(14px) until it fires) and, before this file
   suppresses it, an unfold animation that rotates it through 62 degrees — a
   client rect would be a moving, foreshortened box. Offsets are layout
   values and ignore transforms entirely. */
function offsetBoxIn(el, ancestor) {
  var x = 0, y = 0, n = el;
  while (n && n !== ancestor) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
}

function layout() {
  if (page) pageDims = page.resize(window.innerWidth, window.innerHeight, FOV, CAM_Z);
  if (!hero) { live = false; return false; }

  var box = offsetBoxIn(shot, host);
  /* The hero shot is display:none at <=768px — nothing to stand in for. */
  if (box.width < 8 || box.height < 8) { live = false; return false; }
  live = true; heroBox = box;

  var cw = Math.max(1, host.offsetWidth), ch = Math.max(1, host.offsetHeight);
  var d = hero.resize(cw, ch, FOV, CAM_Z);
  var cx = box.left + box.width/2, cy = box.top + box.height/2;
  place.x = ((cx - cw/2) / (cw/2)) * d.halfW;
  place.y = -((cy - ch/2) / (ch/2)) * d.halfH;
  place.s = (2*d.halfH*(box.height/ch)) / PH_H;
  return true;
}

/* ── loop ───────────────────────────────────────────────────────────────── */

var clock = 0, last = 0, ptX = 0, ptY = 0, wantX = 0, wantY = 0;
var running = false, inView = true, dirty = true, fade = 0, pageFade = 0;
var heroPainted = false;
var st = { camZ: CAM_Z, phone: false, rx:0, ry:0, px:0, py:0, scale:1,
           dx:0, dy:0, dscale:1, dry:0, time:0, fade:0 };

function draw(now) {
  if (!running) return;
  requestAnimationFrame(draw);
  if (document.hidden) { last = now; return; }

  var dt = last ? Math.min((now - last)/1000, 0.064) : 0.016;
  last = now;
  if (!reduced) clock += dt;

  var target = (inView && live) ? 1 : 0;
  if (Math.abs(fade - target) > 0.002) { fade += (target - fade) * Math.min(1, dt*3.2); dirty = true; }
  else if (fade !== target) { fade = target; dirty = true; }
  if (pageFade < 1) { pageFade = Math.min(1, pageFade + dt*0.7); dirty = true; }

  if (!reduced) {
    ptX += (wantX - ptX) * Math.min(1, dt*4);
    ptY += (wantY - ptY) * Math.min(1, dt*4);
  }

  /* The hero shot sits inside a .reveal, so its box only reaches its final
     size once that transition has run. Re-solve for the first second rather
     than trusting a measurement taken mid-entrance. */
  if (clock < 1.2 && !reduced) layout();

  if (reduced && !dirty) return;
  dirty = false;

  if (video && video.readyState >= 2 && video.currentTime !== vStamp && hero) {
    vStamp = video.currentTime;
    hero.setTexture(video, true);
  }

  st.time = clock;

  /* ---- page dots: a slab the document scrolls through ---- */
  if (page) {
    var docH = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    var prog = clamp((window.scrollY || 0) / docH, 0, 1);
    st.camZ = CAM_Z; st.phone = false; st.fade = pageFade;
    st.dx = 0;
    /* Travels less than the page does, so it reads as distance behind the
       content rather than as a second scrolling layer. */
    st.dy = prog * 16.0 - 8.0;
    st.dscale = 1; st.dry = reduced ? 0 : clock * 0.012;
    page.frame(st);
  }

  /* ---- hero: the handset, plus its own denser dots ---- */
  /* Nothing clears a canvas that has stopped being drawn. Resizing below
     768px takes .hero-shot to display:none, so live goes false and frame()
     is never called again — and without this the last frame stayed on screen
     for good, a frozen phone sitting on top of the screenshot that had just
     been restored underneath it. */
  if (hero && !(live && fade > 0.004) && heroPainted) {
    hero.clear();
    heroPainted = false;
    heroCanvas.classList.remove('is-live');
    document.documentElement.classList.remove('hero3d-on');
  }

  if (hero && live && fade > 0.004) {
    var ry = ptX * 0.42 + (reduced ? 0 : Math.sin(clock*0.24)*0.13) - 0.12;
    var rx = ptY * -0.24 + (reduced ? 0 : Math.sin(clock*0.31)*0.045);
    var bob = reduced ? 0 : Math.sin(clock*0.42) * 0.035;
    st.camZ = CAM_Z; st.phone = true; st.fade = fade;
    st.rx = rx; st.ry = ry;
    st.px = place.x; st.py = place.y + bob;
    st.scale = place.s * (0.94 + 0.06*fade);
    st.dx = place.x; st.dy = place.y; st.dscale = place.s;
    st.dry = ry*0.35 + (reduced ? 0 : clock*0.02);
    hero.frame(st);
    heroPainted = true;
    if (!heroCanvas.classList.contains('is-live')) {
      /* The original screenshot is hidden only once a frame has genuinely
         landed. Hiding it at startup would mean anything preventing a draw
         leaves a hole where the product shot used to be. Fail visible. */
      heroCanvas.classList.add('is-live');
      document.documentElement.classList.add('hero3d-on');
    }
  }
  if (page && !pageCanvas.classList.contains('is-live')) pageCanvas.classList.add('is-live');
}

function start() { if (running) return; running = true; last = 0; requestAnimationFrame(draw); }

/* ── wiring ─────────────────────────────────────────────────────────────── */

layout();

var rz;
function onResize() {
  clearTimeout(rz);
  rz = setTimeout(function () {
    var ok = layout();
    if (!ok) document.documentElement.classList.remove('hero3d-on');
    dirty = true;
  }, 140);
}
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('orientationchange', onResize, { passive: true });
window.addEventListener('scroll', function () { dirty = true; }, { passive: true });
window.addEventListener('load', function () { layout(); dirty = true; });

if (!reduced) {
  window.addEventListener('pointermove', function (e) {
    var r = (heroCanvas || pageCanvas).getBoundingClientRect();
    wantX = clamp(((e.clientX - r.left) / Math.max(r.width,1)) * 2 - 1, -1.4, 1.4);
    wantY = clamp(((e.clientY - r.top)  / Math.max(r.height,1)) * 2 - 1, -1.4, 1.4);
  }, { passive: true });
}

/* The hero layer sleeps once the hero has left; the page layer never does,
   because it is behind the whole document. */
if (host && 'IntersectionObserver' in window) {
  new IntersectionObserver(function (e) {
    inView = e[0].isIntersecting;
    if (inView) playVideo(); else if (video) video.pause();
    dirty = true;
  }, { threshold: 0.02 }).observe(host);
}

start();
playVideo();

window.SundayHero3D = {
  get live()      { return live && running; },
  get heroDots()  { return hero ? hero.dots : 0; },
  get pageDots()  { return page ? page.dots : 0; },
  get triangles() { return hero ? hero.meshCount/3 : 0; },
  get place()     { return { x:+place.x.toFixed(3), y:+place.y.toFixed(3), s:+place.s.toFixed(3) }; }
};

})();
