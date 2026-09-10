/* ============================================================================
   Sunday — hero3d
   ----------------------------------------------------------------------------
   Replaces the static hero screenshot with a real object: a rounded slab with
   genuine thickness, lit by one key light, carrying the app on its front face,
   surrounded by a drift of white dots.

   It does not lay itself out. The existing .hero-shot .phone stays exactly
   where it was, keeps its size and its alt text, and is simply made invisible;
   every frame this file measures that box and solves for the camera-space
   position and scale that projects the slab onto it. So the 3D object inherits
   the page's own responsive layout instead of carrying a second copy of it,
   and it cannot drift out of agreement with the design at some width nobody
   tested.

   It stays out of the way when it should:
     · no WebGL          → the original <img> is never hidden
     · <=768px           → the hero shot is display:none there already, so
                           nothing starts
     · Reduce Motion     → one still frame, no drift, no video
     · hero scrolled off → the loop stops entirely
   ========================================================================= */

(function () {
'use strict';

var host = document.querySelector('.hero');
var shot = document.querySelector('.hero-shot .phone');
if (!host || !shot) return;

var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ── maths ──────────────────────────────────────────────────────────────── */

var TAU = Math.PI * 2;
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
function trs(o, x, y, z, s) {          /* translate + uniform scale */
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

/* ── shaders — white and grey only, no hue anywhere ─────────────────────── */

var PT_VS = [
'precision highp float;',
'attribute vec3 aPos, aSeed;',
'uniform mat4 uProj, uView, uModel;',
'uniform float uTime, uDpr, uFade;',
'varying float vI;',
'void main(){',
'  vec3 p = aPos;',
   /* Slow trig drift — enough that the field breathes, never enough to read
      as travel. */
'  float t = uTime*0.16 + aSeed.z*6.2831;',
'  p += vec3(sin(p.y*0.9+t), cos(p.x*0.7-t*0.8), sin(p.z*0.8+t*0.6)) * 0.22;',
'  vec4 mv = uView*uModel*vec4(p,1.0);',
'  gl_Position = uProj*mv;',
'  float dist = max(-mv.z, 0.15);',
'  gl_PointSize = uDpr*(13.0/dist)*(0.30+aSeed.y*aSeed.y*1.7);',
   /* Dim per dot on purpose: the image is built from thousands overlapping
      additively, and a bright sprite piles up into a white smear. */
'  float far  = 1.0 - smoothstep(11.0, 22.0, dist);',
'  float near = smoothstep(1.0, 3.2, dist);',
'  vI = uFade * far * near * (0.13 + aSeed.y*0.34);',
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
'uniform mat4 uProj, uView, uModel;',
'uniform mat4 uRot;',
'varying vec3 vN, vP;',
'varying vec2 vUV;',
'void main(){',
'  vec4 wp = uModel*vec4(aPos,1.0);',
'  vP = wp.xyz;',
   /* uModel carries a uniform scale, which would shorten every normal by the
      same factor and quietly dim the whole object. The rotation alone is the
      normal matrix. */
'  vN = mat3(uRot)*aNrm;',
'  vUV = aUV;',
'  gl_Position = uProj*uView*wp;',
'}'].join('\n');

var MS_FS = [
'precision mediump float;',
'uniform sampler2D uTex;',
'uniform vec3 uEye, uLight;',
'varying vec3 vN, vP;',
'varying vec2 vUV;',
'void main(){',
'  vec3 N = normalize(vN);',
'  vec3 V = normalize(uEye - vP);',
'  vec3 L = normalize(uLight);',
'  vec3 H = normalize(L + V);',
'  float ndl = max(dot(N,L), 0.0);',
'  float ndh = max(dot(N,H), 0.0);',
'  float fres = pow(1.0 - max(dot(N,V), 0.0), 5.0);',
'  vec3 env = mix(vec3(0.020), vec3(0.30), N.y*0.5+0.5);',
'  vec3 col;',
'  if (N.z > 0.5) {',
'    col = texture2D(uTex, vUV).rgb * (0.90 + 0.20*ndl);',
'    col += vec3(1.0) * pow(ndh, 110.0) * 0.60;',
'    col += vec3(0.80) * fres * 0.26;',
'  } else {',
'    col = env + vec3(0.16) * ndl;',
'    col += vec3(1.0) * pow(ndh, 46.0) * 0.90;',
'    col += vec3(0.78) * fres * 0.52;',
'  }',
'  gl_FragColor = vec4(col, 1.0);',
'}'].join('\n');

/* ── gl ─────────────────────────────────────────────────────────────────── */

var canvas = document.createElement('canvas');
canvas.className = 'hero3d';
canvas.setAttribute('aria-hidden', 'true');

var gl = null;
try {
  var attrs = { alpha: true, antialias: false, depth: true, premultipliedAlpha: true,
                powerPreference: 'high-performance' };
  gl = canvas.getContext('webgl', attrs) || canvas.getContext('experimental-webgl', attrs);
} catch (e) { gl = null; }
if (!gl) return;                      /* the original <img> simply stays */

function compile(type, src) {
  var s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
  return s;
}
function program(vs, fs, attrs, unis) {
  var p = gl.createProgram();
  gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
  gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
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

/* ── geometry ───────────────────────────────────────────────────────────── */

var PH_W = 1.265, PH_H = 2.75, PH_D = 0.155, PH_R = 0.185;   /* 640:1391 */

function outline(seg) {
  var hw = PH_W/2 - PH_R, hh = PH_H/2 - PH_R, pts = [];
  var corner = [[hw,hh,0],[-hw,hh,Math.PI/2],[-hw,-hh,Math.PI],[hw,-hh,Math.PI*1.5]];
  for (var c = 0; c < 4; c++) {
    var cx = corner[c][0], cy = corner[c][1], a0 = corner[c][2];
    for (var i = 0; i <= seg; i++) {
      var a = a0 + (i/seg)*(Math.PI/2), co = Math.cos(a), si = Math.sin(a);
      pts.push([cx + co*PH_R, cy + si*PH_R, co, si]);
    }
  }
  return pts;
}

/* Every triangle counter-clockwise seen from outside, so backface culling is
   a complete ordering for this convex slab and it never needs to sort against
   itself. */
function slab(seg) {
  var o = outline(seg), pos = [], nrm = [], uv = [], hd = PH_D/2;
  function v(x,y,z,nx,ny,nz,u,t){ pos.push(x,y,z); nrm.push(nx,ny,nz); uv.push(u,t); }
  /* Uploads use UNPACK_FLIP_Y_WEBGL, so v=1 is already the top of the image. */
  function fuv(x,y){ return [x/PH_W + 0.5, y/PH_H + 0.5]; }
  for (var i = 0; i < o.length; i++) {
    var a = o[i], b = o[(i+1) % o.length];
    var ua = fuv(a[0],a[1]), ub = fuv(b[0],b[1]), uc = fuv(0,0);
    v(0,0,hd, 0,0,1, uc[0],uc[1]);  v(a[0],a[1],hd, 0,0,1, ua[0],ua[1]);  v(b[0],b[1],hd, 0,0,1, ub[0],ub[1]);
    v(0,0,-hd, 0,0,-1, .5,.5);      v(b[0],b[1],-hd, 0,0,-1, 0,0);        v(a[0],a[1],-hd, 0,0,-1, 0,0);
    v(a[0],a[1], hd, a[2],a[3],0, 0,0);
    v(a[0],a[1],-hd, a[2],a[3],0, 0,1);
    v(b[0],b[1],-hd, b[2],b[3],0, 1,1);
    v(a[0],a[1], hd, a[2],a[3],0, 0,0);
    v(b[0],b[1],-hd, b[2],b[3],0, 1,1);
    v(b[0],b[1], hd, b[2],b[3],0, 1,0);
  }
  return { pos:new Float32Array(pos), nrm:new Float32Array(nrm),
           uv:new Float32Array(uv), count: pos.length/3 };
}

/* A cloud measured in phone-heights, so it scales with the object and keeps
   the same relationship to it at every viewport width. Hollowed in the middle
   so the dots surround the phone rather than fogging its screen. */
/* Wide and shallow, not a ball. The slab ends up ~4.5 world units tall with
   the camera only 7 away, so a cloud deep enough to look spherical puts half
   its dots behind the camera and the rest past the distance fade — which is
   exactly how you get a field that is technically 30,000 dots and visibly
   almost empty. Spread it across x, keep it thin in z, and every dot lands
   in the band that actually renders. */
function cloud(n) {
  var a = new Float32Array(n*3);
  for (var i = 0; i < n*3; i += 3) {
    var u = Math.random()*2-1, th = Math.random()*TAU, s = Math.sqrt(1-u*u);
    var r = (0.42 + Math.pow(Math.random(), 0.65)*0.62) * PH_H;
    a[i]   = s*Math.cos(th) * r * 1.45;
    a[i+1] = u * r * 0.95;
    a[i+2] = s*Math.sin(th) * r * 0.42;
  }
  return a;
}

var ptProg, msProg, ptBuf, seedBuf, msBuf = {}, msCount = 0, N = 0, tex;
try {
  ptProg = program(PT_VS, PT_FS, ['aPos','aSeed'],
    ['uProj','uView','uModel','uTime','uDpr','uFade']);
  msProg = program(MS_VS, MS_FS, ['aPos','aNrm','aUV'],
    ['uProj','uView','uModel','uRot','uTex','uEye','uLight']);
} catch (e) {
  if (window.console && console.warn) console.warn('hero3d:', e.message);
  return;
}

N = window.innerWidth < 1100 ? 24000 : 46000;
ptBuf = buffer(cloud(N));
var seeds = new Float32Array(N*3);
for (var i = 0; i < N*3; i++) seeds[i] = Math.random();
seedBuf = buffer(seeds);

var g = slab(9);
msBuf.aPos = buffer(g.pos); msBuf.aNrm = buffer(g.nrm); msBuf.aUV = buffer(g.uv);
msCount = g.count;

tex = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, tex);
gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
              new Uint8Array([12,12,14,255]));
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

gl.clearColor(0,0,0,0);
gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK); gl.frontFace(gl.CCW);

/* ── screen texture ─────────────────────────────────────────────────────── */

var video = null, vStamp = -1;

(function loadPoster() {
  var img = new Image();
  img.onload = function () {
    if (vStamp >= 0) return;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    dirty = true;
  };
  img.src = 'assets/img/chat.webp';
})();

if (!reduced) {
  video = document.createElement('video');
  video.muted = true; video.loop = true; video.playsInline = true;
  video.setAttribute('playsinline',''); video.preload = 'auto';
  video.crossOrigin = 'anonymous';
  ['assets/video/hero-answer.webm','assets/video/hero-answer.mp4'].forEach(function (src) {
    var s = document.createElement('source');
    s.src = src; s.type = /webm$/.test(src) ? 'video/webm' : 'video/mp4';
    video.appendChild(s);
  });
  /* Near-zero opacity rather than display:none — a video that is not rendered
     at all does not reliably produce frames to upload. */
  video.style.cssText = 'position:fixed;left:0;top:0;width:2px;height:2px;opacity:.01;pointer-events:none;z-index:-1';
  document.body.appendChild(video);
}

function playVideo() {
  if (!video || document.hidden) return;
  var p = video.play();
  if (p && p.catch) p.catch(function () {});
}
document.addEventListener('visibilitychange', function () { if (!document.hidden) playVideo(); });
window.addEventListener('pointerdown', playVideo, { passive: true });

function uploadVideo() {
  if (!video || video.readyState < 2 || video.currentTime === vStamp) return;
  vStamp = video.currentTime;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video); }
  catch (e) { video = null; }
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

/* ── placement, solved from the DOM box every resize ────────────────────── */

var FOV = 45 * Math.PI / 180, CAM_Z = 7;
var mProj = m4(), mView = m4(), mModel = m4(), mRot = m4(), mA = m4(), mB = m4();
var dpr = 1, cw = 1, ch = 1, place = { x:0, y:0, s:1 }, live = false;

/* Offsets, deliberately, not getBoundingClientRect. The element we measure
   carries .reveal (translateY(14px) until it fires) and, before this file
   suppresses it, an unfold animation that rotates it through 62 degrees — a
   client rect would be reporting a moving, foreshortened box and the slab
   would be placed against whatever frame we happened to catch. offsetLeft /
   offsetTop / offsetWidth / offsetHeight are layout values and ignore
   transforms entirely. */
function offsetBoxIn(el, ancestor) {
  var x = 0, y = 0, n = el;
  while (n && n !== ancestor) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent; }
  return { left: x, top: y, width: el.offsetWidth, height: el.offsetHeight };
}

function layout() {
  var box = offsetBoxIn(shot, host);
  /* The hero shot is display:none at <=768px — nothing to stand in for. */
  if (box.width < 8 || box.height < 8) { live = false; return false; }
  live = true;

  dpr = Math.min(window.devicePixelRatio || 1, 2);
  cw = Math.max(1, host.offsetWidth);
  ch = Math.max(1, host.offsetHeight);
  var pw = Math.round(cw*dpr), ph = Math.round(ch*dpr);
  if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; }
  gl.viewport(0, 0, pw, ph);
  perspective(mProj, FOV, cw/ch, 0.1, 90);

  /* Solve for the world position and scale whose projection is exactly the
     box the page already laid out. */
  var halfH = CAM_Z * Math.tan(FOV/2), halfW = halfH * (cw/ch);
  var cx = box.left + box.width/2;
  var cy = box.top  + box.height/2;
  place.x = ((cx - cw/2) / (cw/2)) * halfW;
  place.y = -((cy - ch/2) / (ch/2)) * halfH;
  place.s = (2*halfH*(box.height/ch)) / PH_H;
  return true;
}

/* ── loop ───────────────────────────────────────────────────────────────── */

var t0 = 0, clock = 0, last = 0, ptX = 0, ptY = 0, wantX = 0, wantY = 0;
var running = false, inView = true, dirty = true, fade = 0;

function draw(now) {
  if (!running) return;
  requestAnimationFrame(draw);
  if (document.hidden || !live) return;

  var dt = last ? Math.min((now - last)/1000, 0.064) : 0.016;
  last = now;
  if (!reduced) clock += dt;

  /* Ease in once, so the object arrives rather than popping. */
  var target = inView ? 1 : 0;
  if (Math.abs(fade - target) > 0.002) { fade += (target - fade) * Math.min(1, dt*3.2); dirty = true; }
  else if (fade !== target) { fade = target; dirty = true; }

  if (!reduced) {
    ptX += (wantX - ptX) * Math.min(1, dt*4);
    ptY += (wantY - ptY) * Math.min(1, dt*4);
  }

  /* The hero shot is inside a .reveal, so its box only reaches its final
     size once that transition has run. Re-solve for the first second rather
     than trusting a measurement taken mid-entrance. */
  if (clock < 1.2 && !reduced) layout();

  if (reduced && !dirty) return;      /* a still frame stays a still frame */
  dirty = false;
  uploadVideo();

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  trs(mView, 0, 0, -CAM_Z, 1);

  var ry = ptX * 0.42 + (reduced ? 0 : Math.sin(clock*0.24)*0.13) - 0.12;
  var rx = ptY * -0.24 + (reduced ? 0 : Math.sin(clock*0.31)*0.045);
  var bob = reduced ? 0 : Math.sin(clock*0.42) * 0.035;

  /* phone — opaque, depth-written, drawn first so the dots behind it are
     genuinely occluded and the dots in front genuinely glow over it. */
  gl.enable(gl.DEPTH_TEST); gl.depthMask(true);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  gl.useProgram(msProg.p);
  mul(mRot, rotX(mA, rx), rotY(mB, ry));
  mul(mModel, trs(mModel, place.x, place.y + bob, 0, place.s * (0.94 + 0.06*fade)), mRot);
  gl.uniformMatrix4fv(msProg.u.uProj, false, mProj);
  gl.uniformMatrix4fv(msProg.u.uView, false, mView);
  gl.uniformMatrix4fv(msProg.u.uModel, false, mModel);
  gl.uniformMatrix4fv(msProg.u.uRot, false, mRot);
  gl.uniform3f(msProg.u.uEye, 0, 0, CAM_Z);
  gl.uniform3f(msProg.u.uLight, -0.40, 0.76, 0.72);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.uniform1i(msProg.u.uTex, 0);
  bind(msProg,'aPos',msBuf.aPos,3); bind(msProg,'aNrm',msBuf.aNrm,3); bind(msProg,'aUV',msBuf.aUV,2);
  gl.drawArrays(gl.TRIANGLES, 0, msCount);

  /* dots — additive, depth-tested but not depth-written, so thousands of
     sprites composite in any order without sorting. */
  gl.depthMask(false);
  gl.blendFunc(gl.ONE, gl.ONE);
  gl.useProgram(ptProg.p);
  mul(mModel, trs(mModel, place.x, place.y, 0, place.s), rotY(mA, ry*0.35 + (reduced?0:clock*0.02)));
  gl.uniformMatrix4fv(ptProg.u.uProj, false, mProj);
  gl.uniformMatrix4fv(ptProg.u.uView, false, mView);
  gl.uniformMatrix4fv(ptProg.u.uModel, false, mModel);
  gl.uniform1f(ptProg.u.uTime, clock);
  gl.uniform1f(ptProg.u.uDpr, dpr);
  gl.uniform1f(ptProg.u.uFade, fade);
  bind(ptProg,'aPos',ptBuf,3); bind(ptProg,'aSeed',seedBuf,3);
  gl.drawArrays(gl.POINTS, 0, N);

  /* The original screenshot is hidden only once a frame has genuinely landed.
     Hiding it at startup instead would mean that anything preventing a draw —
     a context that links but never renders, a lost context on the first
     frame — leaves a hole where the product shot used to be. Fail visible. */
  if (!canvas.classList.contains('is-live')) {
    canvas.classList.add('is-live');
    document.documentElement.classList.add('hero3d-on');
  }
}

function bind(prog, name, buf, size) {
  var loc = prog.a[name];
  if (loc < 0) return;
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
}

function start() { if (running) return; running = true; last = 0; requestAnimationFrame(draw); }
function stop()  { running = false; }

/* ── wiring ─────────────────────────────────────────────────────────────── */

host.insertBefore(canvas, host.firstChild);

/* Narrow: the page hides the hero shot at <=768px, so there is nothing to
   stand in for and nothing starts. A resize into a wider viewport picks it up. */
layout();

var rz;
function onResize() {
  clearTimeout(rz);
  rz = setTimeout(function () {
    var ok = layout();
    if (!ok) document.documentElement.classList.remove('hero3d-on');
    dirty = true;
    if (ok && inView) start(); else stop();
  }, 140);
}
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('orientationchange', onResize, { passive: true });
window.addEventListener('load', function () { layout(); dirty = true; });

if (!reduced) {
  window.addEventListener('pointermove', function (e) {
    var r = canvas.getBoundingClientRect();
    wantX = clamp(((e.clientX - r.left) / Math.max(r.width,1)) * 2 - 1, -1.4, 1.4);
    wantY = clamp(((e.clientY - r.top)  / Math.max(r.height,1)) * 2 - 1, -1.4, 1.4);
  }, { passive: true });
}

/* Stop dead once the hero has left. The walkthrough below this runs its own
   scroll-driven loop and should not be sharing a frame with a scene nobody
   can see. */
if ('IntersectionObserver' in window) {
  new IntersectionObserver(function (e) {
    inView = e[0].isIntersecting;
    if (inView) { if (live) start(); playVideo(); }
    else { if (video) video.pause(); setTimeout(function () { if (!inView) stop(); }, 700); }
  }, { threshold: 0.02 }).observe(host);
} else { inView = true; }

if (live) { start(); playVideo(); }

window.SundayHero3D = {
  get live()  { return live && running; },
  get dots()  { return N; },
  get place() { return { x:+place.x.toFixed(3), y:+place.y.toFixed(3), s:+place.s.toFixed(3) }; }
};

})();
