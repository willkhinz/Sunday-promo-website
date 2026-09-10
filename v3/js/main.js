/* ============================================================================
   Sunday v3 — the page
   ----------------------------------------------------------------------------
   One requestAnimationFrame loop drives everything: the WebGL world, the
   corridor of screens, the exploded stack, and the fade of each pinned scene.
   Inside it, all reads happen before all writes, so nothing here forces a
   synchronous layout mid-frame.

   Scroll → world is a station model. Each <section data-station> declares one
   complete world state; the section's own centre is its anchor on the page.
   Between two anchors the loop eases every field of the state from one to the
   next. Nothing is hard-coded to a scroll offset, so changing a section's copy
   or its runway cannot desynchronise the animation from the writing — the
   anchors are re-measured from the DOM on every resize.

   Everything below is additive. With this file absent the document is flat,
   fully visible and completely usable; with it present but Reduce Motion set,
   it stays flat and gains working controls. Only when motion is welcome does
   html.motion go on and the 3D layer wake up.
   ========================================================================= */

(function () {
'use strict';

var doc = document.documentElement;
var mqMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
var motion = !mqMotion.matches;

/* ── small maths ────────────────────────────────────────────────────────── */

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function lerp(a, b, t) { return a + (b - a) * t; }
function smooth01(t) { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); }
function ramp(v, a, b) { return smooth01((v - a) / (b - a || 1)); }

/* ── the eight world states ─────────────────────────────────────────────────
   w      six shape weights: dust · phone · ball · mark · torus · lattice
   rotY   deliberately monotonic — the world only ever turns one way, so no
          station can ever cause a visible rewind. Where a flat shape has to
          face the camera (the mark, the closing phone) rotY is an exact
          multiple of 2π and rotX is ~0.                                     */

/* pk  how much of the viewport-dependent parking offset to apply to the phone
       MESH. The hero stands it beside the headline; the finale must not, and
       sets pk:0 — there the cloud has re-formed into the very same phone at
       the origin, and any offset that moves the mesh alone tears it out of
       its own silhouette. Wherever both have to move, the camera moves
       (camY), because that carries the mesh and the cloud together.        */

var ST = {
  hero:    { w:[1,0,0,0,0,0],       camZ:6.30, camY: 0.00, rotX:-0.05, rotY:0.0000, spread:1.00, turb:0.30, size:1.00, bright:0.55, tint:0.00,  phone:1.00, pk:1 },
  scale:   { w:[0,0,1,0,0,0],       camZ:4.55, camY:-0.62, rotX: 0.12, rotY:1.9000, spread:1.00, turb:0.55, size:1.16, bright:1.05, tint:0.16,  phone:0.00, pk:1 },
  mark:    { w:[0,0,0,1,0,0],       camZ:5.05, camY:-0.70, rotX: 0.00, rotY:6.2832, spread:1.00, turb:0.09, size:0.96, bright:1.20, tint:0.30,  phone:0.00, pk:0 },
  does:    { w:[0,0,0,0,1,0],       camZ:5.40, camY: 0.10, rotX: 0.44, rotY:7.6000, spread:1.00, turb:0.26, size:0.88, bright:0.50, tint:-0.16, phone:0.00, pk:0 },
  stack:   { w:[0,0,0,0,0,1],       camZ:5.70, camY: 0.00, rotX: 0.34, rotY:8.5000, spread:1.00, turb:0.13, size:0.84, bright:0.44, tint:0.00,  phone:0.00, pk:0 },
  offline: { w:[0,0,0,0,0.3,0.7],   camZ:8.60, camY: 0.00, rotX: 0.20, rotY:9.4000, spread:1.30, turb:0.30, size:0.80, bright:0.18, tint:0.00,  phone:0.00, pk:0 },
  privacy: { w:[0,0,0,0.35,0,0.65], camZ:8.10, camY: 0.30, rotX: 0.06, rotY:10.200, spread:1.20, turb:0.20, size:0.80, bright:0.22, tint:0.26,  phone:0.00, pk:0 },
  end:     { w:[0,1,0,0,0,0],       camZ:5.15, camY: 1.00, rotX:-0.03, rotY:12.566, spread:1.00, turb:0.11, size:1.00, bright:0.90, tint:0.10,  phone:0.90, pk:0 }
};

/* ── elements ───────────────────────────────────────────────────────────── */

var canvas   = document.getElementById('world');
var heroVid  = document.getElementById('heroVideo');
var filmVid  = document.getElementById('filmVideo');
var filmBtn  = document.getElementById('filmPlay');
var motBtn   = document.getElementById('motionToggle');
var motLabel = document.getElementById('motionLabel');
var rail     = document.getElementById('rail');
var stackObj = document.getElementById('stackObj');
var cards    = rail ? [].slice.call(rail.children) : [];
var layers   = stackObj ? [].slice.call(stackObj.children) : [];
var sections = [].slice.call(document.querySelectorAll('[data-station]'));

/* ── world ──────────────────────────────────────────────────────────────── */

var W = window.SundayWorld, hasGL = false;
if (W && canvas) {
  hasGL = W.init(canvas, {});
  if (hasGL) W.setVideo(heroVid);
}
if (!hasGL) { doc.classList.add('no-gl'); if (canvas) canvas.style.display = 'none'; }

if (motion) doc.classList.add('motion');

/* ── measurement ────────────────────────────────────────────────────────── */

var vh = window.innerHeight, maxScroll = 1, stations = [];

/* svh is the right unit — it keeps the runway stable while a mobile URL bar
   collapses — but a browser that does not know it drops the declaration
   entirely, which would leave every runway section at auto height and strand
   the whole choreography. Fall back rather than assume. */
var VHU = (window.CSS && CSS.supports && CSS.supports('height', '1svh')) ? 'svh' : 'vh';

function applyRunways() {
  if (!motion) return;
  for (var i = 0; i < sections.length; i++) {
    var len = sections[i].getAttribute('data-len');
    if (len) sections[i].style.height = len + VHU;
  }
}

function measure() {
  vh = window.innerHeight;
  maxScroll = Math.max(1, doc.scrollHeight - vh);
  stations.length = 0;
  for (var i = 0; i < sections.length; i++) {
    var sec = sections[i];
    var top = sec.getBoundingClientRect().top + window.scrollY;
    var h = sec.offsetHeight;
    sec._top = top; sec._h = h; sec._span = Math.max(1, h - vh);
    stations.push({
      y: clamp(top + h / 2 - vh / 2, 0, maxScroll),
      s: ST[sec.getAttribute('data-station')] || ST.hero
    });
  }
  stations.sort(function (a, b) { return a.y - b.y; });
}

/* ── station blending ───────────────────────────────────────────────────── */

var blend = {
  w: new Float32Array(6), camZ: 0, camY: 0, rotX: 0, rotY: 0,
  spread: 1, turb: 0, size: 1, bright: 1, tint: 0, phone: 0,
  pk: 1, burst: 0
};

function sampleWorld(y) {
  if (!stations.length) return;
  var i = 0;
  while (i < stations.length - 1 && y > stations[i + 1].y) i++;

  var a = stations[i].s, b = stations[Math.min(i + 1, stations.length - 1)].s;
  var y0 = stations[i].y, y1 = stations[Math.min(i + 1, stations.length - 1)].y;
  var t = y1 > y0 ? smooth01((y - y0) / (y1 - y0)) : 0;

  var top = 0;
  for (var k = 0; k < 6; k++) {
    var v = lerp(a.w[k], b.w[k], t);
    blend.w[k] = v;
    if (v > top) top = v;
  }
  /* How far between shapes we are, straight out of the weight vector. It
     peaks at exactly the midpoint of any crossfade, whatever the shapes,
     which is what the burst and the extra turbulence key off. */
  var mid = clamp((1 - top) * 2, 0, 1);

  blend.camZ   = lerp(a.camZ, b.camZ, t);
  blend.camY   = lerp(a.camY, b.camY, t);
  blend.rotX   = lerp(a.rotX, b.rotX, t);
  blend.rotY   = lerp(a.rotY, b.rotY, t);
  blend.spread = lerp(a.spread, b.spread, t);
  blend.size   = lerp(a.size, b.size, t);
  /* Bursting spreads the same number of points over a much bigger volume, so
     without a lift the brightest moment of every transition is also its
     dimmest. */
  blend.bright = lerp(a.bright, b.bright, t) * (1 + mid * 0.28);
  blend.tint   = lerp(a.tint, b.tint, t);
  blend.phone  = lerp(a.phone, b.phone, t);
  blend.pk     = lerp(a.pk, b.pk, t);
  blend.turb   = lerp(a.turb, b.turb, t) + mid * 0.5;
  blend.burst  = mid * 0.8;
}

/* ── scroll, smoothed and rate-capped ───────────────────────────────────── */

var target = window.scrollY || 0, current = target, worldTime = 0, paused = !motion;
var last = 0, pointerX = 0, pointerY = 0, ptX = 0, ptY = 0;

/* Where the phone stands, in world units. The copy is set in the DOM and the
   phone is drawn in WebGL, so nothing makes them avoid each other on their
   own — this is the one place that keeps the object out of the headline.
   Wide: type left, phone right of it. Narrow: type up top, phone below. */
var phonePark = { x: 0, y: 0 };

function parkPhone() {
  var w = window.innerWidth;
  railSpread = w < 760 ? 88 : 156;
  if (w >= 1000) { phonePark.x =  1.62; phonePark.y = -0.10; return; }
  if (w >= 760)  { phonePark.x =  1.40; phonePark.y = -0.10; return; }

  /* Narrow: the phone goes under the copy — and where "under the copy" is
     depends entirely on how tall the copy came out, which changes with the
     viewport, the text size and the user's own font settings. So measure it
     rather than pick a number: convert the copy's last pixel into world units
     and hang the phone off the bottom of it. A short viewport can leave no
     room at all, hence the clamp — there the phone peeks in rather than
     printing itself across the headline. */
  phonePark.x = 0;
  var copy = document.querySelector('.hero-in');
  var pin  = document.querySelector('.ch-hero > .pin');
  var pH   = (hasGL && W.phoneSize) ? W.phoneSize.h : 2.75;
  var halfH = ST.hero.camZ * Math.tan(50 * Math.PI / 360);
  if (!copy || !pin) { phonePark.y = -1.55; return; }

  var below = (parseFloat(getComputedStyle(pin).paddingTop) || 0) + copy.offsetHeight + 40;
  var worldY = (0.5 - below / window.innerHeight) * 2 * halfH;
  phonePark.y = clamp(worldY - pH / 2, -(halfH + pH / 2 - 0.55), -0.30);
}

/* Two different things arrive as "the scroll moved a lot".

   A fling — trackpad, momentum, a fast wheel — should still read as a journey
   rather than a cut, so the chase is capped at five viewport-heights a second.
   A jump — an anchor link, Home/End, a restored position on reload — is
   navigation, and throttling it would mean scrubbing the whole 15-viewport
   document at walking pace to answer one click. Past eight viewports the loop
   stops chasing and simply arrives. */
var MAX_VH_PER_SEC = 5;
var SNAP_VH = 8;

/* Anything that changes the picture without advancing the clock raises this,
   so a paused page still repaints when it genuinely needs to. */
var dirty = true, lastPainted = -1e9;

function onScroll() { target = window.scrollY || 0; }

/* ── the loop ───────────────────────────────────────────────────────────── */

function frame(now) {
  requestAnimationFrame(frame);
  if (document.hidden) { last = now; return; }

  var dtMs = last ? Math.min(now - last, 64) : 16;
  last = now;
  var dt = dtMs / 1000;

  /* ---- read phase: nothing below this line touches the DOM for layout ---- */

  if (motion) {
    if (Math.abs(target - current) > SNAP_VH * vh) {
      current = target;
    } else {
      var k = 1 - Math.pow(0.0018, dt);
      var want = current + (target - current) * k;
      var cap = MAX_VH_PER_SEC * vh * dt;
      current += clamp(want - current, -cap, cap);
      if (Math.abs(target - current) < 0.4) current = target;
    }
  } else {
    current = target;
  }

  if (!paused) worldTime += dt;
  ptX += (pointerX - ptX) * Math.min(1, dt * 5);
  ptY += (pointerY - ptY) * Math.min(1, dt * 5);

  sampleWorld(current);

  /* Nothing time-based is running while paused, so an unchanged scroll
     position means an identical frame. Redrawing it sixty times a second
     would burn a laptop battery to show a still — and the people most likely
     to be paused are the ones who asked for Reduce Motion. */
  var scrolled = Math.abs(current - lastPainted) > 0.25;
  var drawWorld = hasGL && (!paused || scrolled || dirty);
  var drawDom   = motion && (scrolled || dirty);
  if (scrolled) lastPainted = current;

  /* ---- write phase ---- */

  if (drawWorld) {
    var s = W.state;
    s.w.set(blend.w);
    s.camZ = blend.camZ; s.camY = blend.camY;
    s.rotX = blend.rotX; s.rotY = blend.rotY;
    s.spread = blend.spread; s.turb = blend.turb; s.burst = blend.burst;
    s.size = blend.size; s.bright = blend.bright; s.tint = blend.tint;
    s.phone = blend.phone;
    s.time = worldTime;
    /* The phone answers the pointer directly, and drifts on its own when
       nothing is asking. Its yaw is separate from the world's so the two
       never fight. */
    s.phoneRY = ptX * 0.62 + (paused ? 0 : Math.sin(worldTime * 0.22) * 0.16);
    s.phoneRX = ptY * -0.34 + (paused ? 0 : Math.sin(worldTime * 0.31) * 0.05);
    s.phoneX  = phonePark.x * blend.pk;
    s.phoneY  = phonePark.y * blend.pk +
                (paused ? 0 : Math.sin(worldTime * 0.45) * 0.045);
    W.draw(now, dtMs);
  }

  if (drawDom) {
    paintPins();
    paintRail();
    paintStack();
  }

  dirty = false;
}

/* ── pinned scenes: hold, then recede on the way out ────────────────────── */

var pins = [];

function collectPins() {
  pins.length = 0;
  for (var i = 0; i < sections.length; i++) {
    var p = sections[i].querySelector(':scope > .pin');
    if (p) pins.push({ sec: sections[i], el: p, o: -1 });
  }
}

function paintPins() {
  for (var i = 0; i < pins.length; i++) {
    var pin = pins[i], sec = pin.sec;
    var p = clamp((current - sec._top) / sec._span, 0, 1);
    var out = 1 - ramp(p, 0.80, 1.0);
    if (Math.abs(out - pin.o) < 0.004) continue;      /* don't dirty style for nothing */
    pin.o = out;
    pin.el.style.opacity = out;
    pin.el.style.transform = out < 0.999
      ? 'translate3d(0,' + (-26 * (1 - out)).toFixed(2) + 'px,0) scale(' + (1 - (1 - out) * 0.045).toFixed(4) + ')'
      : '';
  }
}

/* ── the corridor ───────────────────────────────────────────────────────────
   Six screens strung along −Z. Scrolling the section drives one number: how
   far the camera has travelled down the line. Cards behind the camera are
   taken out of the compositor entirely rather than left to rasterise at
   absurd scale.                                                             */

/* Spaced far enough apart, and faded in late enough, that only two or three
   screens share the frame. Packed tighter they all pile onto the vanishing
   point at once and the corridor reads as a smudge rather than a sequence. */
var RAIL_GAP = 760, RAIL_START = -760, RAIL_TRAVEL = 4900;
var railSpread = 156;                        /* % of card width, set in onResize */

function paintRail() {
  if (!cards.length) return;
  var sec = cards[0].closest('[data-station]');
  if (!sec || !sec._span) return;
  var p = clamp((current - sec._top) / sec._span, 0, 1);
  var travel = p * RAIL_TRAVEL;

  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var z = RAIL_START - i * RAIL_GAP + travel;
    var vis = z < 420;
    if (!vis) {
      if (c._vis !== false) { c._vis = false; c.style.visibility = 'hidden'; }
      continue;
    }
    if (c._vis !== true) { c._vis = true; c.style.visibility = 'visible'; }

    var op = ramp(z, -2500, -1550) * (1 - ramp(z, 60, 380));
    var side = (i % 2 ? 1 : -1);
    /* Percentages here resolve against the card's own box, so −50 is the
       centring and the rest is offset in card-widths / card-heights. The
       card is ~2.2× as tall as it is wide, hence the much smaller y factor.

       The lateral spread is narrower on a phone. At the desktop figure a card
       arriving at the camera sits its own width past the edge of a 390px
       screen — clipped, so never seen, but it was still 110px of the page
       hanging off the side. */
    var x = side * railSpread - 50;
    var y = Math.sin(i * 1.1) * 9;
    c.style.opacity = op.toFixed(3);
    c.style.transform =
      'translate3d(' + x + '%,' + (y - 50) + '%,0) translateZ(' + z.toFixed(1) + 'px)' +
      ' rotateY(' + (-side * 17) + 'deg) rotateX(' + (Math.sin(i * 0.7) * 4).toFixed(1) + 'deg)';
  }
}

/* ── the stack ──────────────────────────────────────────────────────────── */

function paintStack() {
  if (!layers.length) return;
  var sec = layers[0].closest('[data-station]');
  if (!sec || !sec._span) return;
  var p = smooth01(clamp((current - sec._top) / sec._span, 0, 1) * 1.35);

  /* The offsets are applied in the group's local space and only then rotated
     about X, so their signs are not free. With the group tipped by −θ a plate
     lands at
         y' = y·cos θ + z·sin θ
     which means y and z must carry the SAME sign to reinforce. Giving z the
     opposite sign — the obvious reading of "push the back plate away" — makes
     the two terms cancel, and three plates that should fan across 300px
     collapse into a 30px pancake in inverted order. Most of the spread is
     carried by z, so the fan is genuine depth: the near plate is drawn ~1.16×
     and the far one ~0.88× by perspective alone. */
  /* Lifted a little, because perspective makes the near plate the biggest one
     and an evenly-centred fan therefore hangs out of the bottom of the stage
     and onto the spec table. */
  var tip = 8 + p * 20;
  stackObj.style.transform =
    'translateY(' + (-10 * p).toFixed(1) + 'px) rotateX(' + (-tip).toFixed(2) +
    'deg) rotateY(' + (14 - p * 7).toFixed(2) + 'deg)';

  for (var i = 0; i < layers.length; i++) {
    var d = i - 1;
    var y = d * (6 + p * 23);
    var z = d * (4 + p * 174);
    layers[i].style.transform =
      'translate3d(-50%,-50%,0) translate3d(0,' + y.toFixed(1) + 'px,' + z.toFixed(1) + 'px)';
  }
}

/* ── reveals ────────────────────────────────────────────────────────────── */

if (motion && 'IntersectionObserver' in window) {
  var io = new IntersectionObserver(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isIntersecting) {
        entries[i].target.classList.add('in');
        io.unobserve(entries[i].target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  [].forEach.call(document.querySelectorAll('[data-r]'), function (el) { io.observe(el); });
} else {
  [].forEach.call(document.querySelectorAll('[data-r]'), function (el) { el.classList.add('in'); });
}

/* ── video ──────────────────────────────────────────────────────────────────
   The label is driven only by the media element's own play/pause/ended
   events, so it can never claim a state the video is not in — including the
   case where a clip simply runs out. */

function wireVideo(v, btn, label, loops) {
  if (!v || !btn) return;
  var wanted = false;

  function sync() {
    var playing = !v.paused && !v.ended;
    if (label) label.textContent = playing ? 'Pause' : 'Play';
    btn.classList.toggle('is-playing', playing);
    btn.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' the demonstration video');
  }

  btn.addEventListener('click', function () {
    if (v.paused || v.ended) { wanted = true; v.play().catch(function () {}); }
    else { wanted = false; v.pause(); }
  });

  v.addEventListener('play', sync);
  v.addEventListener('pause', sync);
  v.addEventListener('ended', function () { if (!loops) wanted = false; sync(); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      var seen = e[0].isIntersecting;
      if (!seen && !v.paused) v.pause();
      else if (seen && wanted && v.paused && !v.ended) v.play().catch(function () {});
    }, { threshold: 0.25 }).observe(v);
  }
  sync();
}

wireVideo(filmVid, filmBtn, filmBtn ? filmBtn.querySelector('.play-txt') : null, false);

/* Global motion control. One button stops every time-based thing on the page:
   the hero video, the swirl in the cloud, and the phone's drift. Scroll-driven
   movement is left alone — that one is the visitor's own hand. */

function setPaused(next) {
  paused = next;
  dirty = true;
  if (motLabel) motLabel.textContent = paused ? 'Play motion' : 'Pause motion';
  if (motBtn) motBtn.setAttribute('aria-label', (paused ? 'Play' : 'Pause') + ' animation on this page');
  if (paused && heroVid) heroVid.pause();
  else tryPlayHero();
}

/* A page opened in a background tab has its autoplay refused outright, and a
   single swallowed rejection at load would leave the phone showing a frozen
   poster for the rest of the session. Ask again whenever the circumstances
   that cause the refusal have changed. */
function tryPlayHero() {
  if (!heroVid || paused || document.hidden) return;
  var p = heroVid.play();
  if (p && p.catch) p.catch(function () {});
}

document.addEventListener('visibilitychange', function () {
  if (!document.hidden) tryPlayHero();
});
window.addEventListener('pointerdown', tryPlayHero, { passive: true });
window.addEventListener('keydown', tryPlayHero, { passive: true });

if (motBtn && (hasGL || heroVid)) {
  motBtn.hidden = false;
  motBtn.addEventListener('click', function () { setPaused(!paused); });
  setPaused(!motion);
}

/* ── pointer ────────────────────────────────────────────────────────────── */

if (motion) {
  window.addEventListener('pointermove', function (e) {
    pointerX = (e.clientX / window.innerWidth) * 2 - 1;
    pointerY = (e.clientY / window.innerHeight) * 2 - 1;
  }, { passive: true });
  window.addEventListener('pointerleave', function () { pointerX = 0; pointerY = 0; });
}

/* ── wiring ─────────────────────────────────────────────────────────────── */

var rz;
function onResize() {
  clearTimeout(rz);
  rz = setTimeout(function () {
    if (hasGL) W.resize();
    applyRunways();
    parkPhone();
    measure();
    /* Card width tracks the viewport; keeping it a custom property means the
       per-frame transform never has to read layout back. */
    if (rail) rail.style.setProperty('--cw', Math.round(clamp(window.innerWidth * 0.21, 148, 240)) + 'px');
    for (var i = 0; i < pins.length; i++) pins[i].o = -1;
    dirty = true;
  }, 120);
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', onResize, { passive: true });
window.addEventListener('orientationchange', onResize, { passive: true });
window.addEventListener('load', function () { applyRunways(); measure(); });

mqMotion.addEventListener
  ? mqMotion.addEventListener('change', function () { location.reload(); })
  : mqMotion.addListener && mqMotion.addListener(function () { location.reload(); });

applyRunways();
collectPins();
parkPhone();
measure();
if (rail) rail.style.setProperty('--cw', Math.round(clamp(window.innerWidth * 0.21, 148, 240)) + 'px');
target = current = window.scrollY || 0;
sampleWorld(current);

if (motion && heroVid) heroVid.play().catch(function () {});

requestAnimationFrame(frame);

/* A tiny handle for verifying claims about this page from the console rather
   than by eye. */
window.SundayV3 = {
  get fps()      { return W && W.ok ? Math.round(1000 / W.ms) : null; },
  get points()   { return W && W.ok ? W.count : 0; },
  get budget()   { return W && W.ok ? W.budget : 0; },
  get station()  { return stations.length; },
  get gl()       { return hasGL; },
  get motion()   { return motion; },
  get weights()  { return Array.prototype.slice.call(blend.w).map(function (v) { return +v.toFixed(3); }); },
  get scroll()   { return Math.round(current); }
};

})();
