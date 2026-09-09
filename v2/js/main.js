/* Sunday — light build.

   Three real objects in one camera each, all lit by the single key light
   declared in style.css :root, and all driven from one rAF loop so the page
   has a single frame budget.

   The loop is strictly READ-THEN-WRITE. Every layout read in the whole page
   happens in one block at the top of frame(); every style write happens
   after. Interleaving them — as the previous build did, writing the device's
   transform and then calling getBoundingClientRect for the ring — makes each
   read wait on a style recalc and a layout it just invalidated. That was two
   forced synchronous layouts per frame before any of this lighting existed.

   Progressive enhancement: every section reads and every control works with
   this file absent. Under Reduce Motion the loop never starts; instead the
   device's pose, rails, glass and shadow are written once from the same
   maths and left alone, so the object stays a lit object and only the motion
   goes. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };
  var RAD   = Math.PI / 180;

  /* ── the one light ───────────────────────────────────────────
     Read once from CSS so the stylesheet stays the single source of truth,
     then never touched again. V is the view vector; H is the half-vector
     between light and view, which is what a specular highlight actually
     answers to. V = (0,0,1) is accurate to within 5.7 degrees here — the
     device is 280px wide under 1400px of perspective, atan(140/1400) — far
     below what the eye resolves in a highlight's position. */
  var css = getComputedStyle(document.documentElement);
  var L = normalize([
    parseFloat(css.getPropertyValue('--key-x')) || -0.30,
    parseFloat(css.getPropertyValue('--key-y')) || -0.86,
    parseFloat(css.getPropertyValue('--key-z')) ||  0.41
  ]);
  var H = normalize([L[0], L[1], L[2] + 1]);          // normalize(L + V)

  function normalize(v) {
    var m = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / m, v[1] / m, v[2] / m];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

  /* CSS applies `rotateX(rx) rotateY(ry)` in that order, so the matrix is
     Rx·Ry and a vector maps as M·v. Written out rather than composed, since
     this runs per rail per frame. */
  function rot(v, rx, ry) {
    var sa = Math.sin(rx), ca = Math.cos(rx);
    var sb = Math.sin(ry), cb = Math.cos(ry);
    return [
      cb * v[0]                + 0  * v[1] + sb * v[2],
      sa * sb * v[0]           + ca * v[1] - sa * cb * v[2],
      -ca * sb * v[0]          + sa * v[1] + ca * cb * v[2]
    ];
  }

  /* ── entrance ────────────────────────────────────────────── */

  var anims = document.querySelectorAll('[data-anim]');
  if (reduced || !('IntersectionObserver' in window)) {
    [].forEach.call(anims, function (el) { el.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        var d = +(e.target.getAttribute('data-anim-delay') || 0);
        e.target.style.transitionDelay = (d * 70) + 'ms';
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: .1 });
    [].forEach.call(anims, function (el) { io.observe(el); });
  }

  var bar = document.getElementById('bar');

  /* ── media controls ──────────────────────────────────────────
     Nothing plays by itself. WCAG 2.2.2 (Level A) and the HIG both require a
     way to start and stop anything that moves on its own, and a looping clip
     with no control is also exactly the repetitive motion Reduce Motion
     exists to suppress. A video only resumes on scroll if the viewer
     actually started it. */

  function wireVideo(btnId, videoId, playLabel, pauseLabel) {
    var btn = document.getElementById(btnId), v = document.getElementById(videoId);
    if (!btn || !v) return null;
    var wanted = false;
    var label = btn.querySelector('.ctl-label');

    function sync() {
      btn.setAttribute('aria-pressed', wanted ? 'true' : 'false');
      if (label) label.textContent = wanted ? pauseLabel : playLabel;
    }
    btn.addEventListener('click', function () {
      wanted = !wanted;
      if (wanted) {
        if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
        v.play().catch(function () {});
      } else { v.pause(); }
      sync();
    });
    sync();
    return { el: v, wants: function () { return wanted; } };
  }

  var media = [
    wireVideo('heroPlay', 'heroVideo', 'Play the answer', 'Pause the answer'),
    wireVideo('filmPlay', 'filmVideo', 'Play', 'Pause')
  ].filter(Boolean);

  if ('IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var m = media.filter(function (x) { return x.el === e.target; })[0];
        if (!m) return;
        if (e.isIntersecting) { if (m.wants()) m.el.play().catch(function () {}); }
        else { m.el.pause(); }
      });
    }, { rootMargin: '150px 0px', threshold: .1 });
    media.forEach(function (m) { vo.observe(m.el); });
  }

  /* ── object 1 · the device ─────────────────────────────────── */

  var device = document.getElementById('device');
  var gloss = document.getElementById('gloss');
  var rim = document.getElementById('rim');
  var shCore = document.getElementById('shCore');
  var shPen = document.getElementById('shPenumbra');
  var dragHint = document.getElementById('dragHint');
  var specs = device ? [].slice.call(device.querySelectorAll('.spec')) : [];

  var REST_X = -8, REST_Y = -26;                 // resting attitude, degrees
  var W = 280, D = 26;                           // device width and thickness
  var PHI = 150 * RAD;                           // chamfer sweep across a rail

  /* Object-space normal and across-axis for each rail, in the order the
     elements appear. The across-axis is the direction the chamfer sweeps. */
  var RAILS = {
    left:   { n: [-1, 0, 0], t: [0, 0,  1], axis: 'x' },
    right:  { n: [ 1, 0, 0], t: [0, 0, -1], axis: 'x' },
    top:    { n: [ 0, -1, 0], t: [0, 0, -1], axis: 'y' },
    bottom: { n: [ 0,  1, 0], t: [0, 0,  1], axis: 'y' }
  };

  var rot3 = { x: REST_X, y: REST_Y };
  var vel = { x: 0, y: 0 };
  var held = false, touched = false;
  var last = { x: 0, y: 0 }, lastT = 0;

  function pointerDown(e) {
    held = true;
    device.classList.add('is-held');
    last.x = e.clientX; last.y = e.clientY; lastT = e.timeStamp;
    vel.x = vel.y = 0;
    if (device.setPointerCapture) device.setPointerCapture(e.pointerId);
    if (!touched) { touched = true; if (dragHint) dragHint.classList.add('is-gone'); }
  }
  function pointerMove(e) {
    if (!held) return;
    var dx = e.clientX - last.x, dy = e.clientY - last.y;
    var dt = Math.max(e.timeStamp - lastT, 1);
    rot3.y += dx * .38;
    rot3.x = clamp(rot3.x - dy * .3, -62, 62);
    vel.y = (dx * .38) / dt * 16;
    vel.x = (-dy * .3) / dt * 16;
    last.x = e.clientX; last.y = e.clientY; lastT = e.timeStamp;
  }
  function pointerUp() {
    if (!held) return;
    held = false;
    device.classList.remove('is-held');
  }

  if (device && !reduced) {
    device.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove, { passive: true });
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    device.tabIndex = 0;
    device.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 15 : 6;
      if (e.key === 'ArrowLeft')  { rot3.y -= step; e.preventDefault(); }
      else if (e.key === 'ArrowRight') { rot3.y += step; e.preventDefault(); }
      else if (e.key === 'ArrowUp')    { rot3.x = clamp(rot3.x - step, -62, 62); e.preventDefault(); }
      else if (e.key === 'ArrowDown')  { rot3.x = clamp(rot3.x + step, -62, 62); e.preventDefault(); }
      else return;
      if (!touched) { touched = true; if (dragHint) dragHint.classList.add('is-gone'); }
    });
  }

  /* Everything the light does to the object, for a given attitude. Pure: it
     is called per frame while animating, and exactly once under Reduce
     Motion, from the same numbers. */
  function lightDevice(rxDeg, ryDeg, lift) {
    var rx = rxDeg * RAD, ry = ryDeg * RAD;

    // Rails. The chamfer normal at angle q across the sweep is
    // n(q) = cos q · N + sin q · T, so the specular peaks at
    // q* = atan2(T·H, N·H) with magnitude hypot(N·H, T·H).
    for (var i = 0; i < specs.length; i++) {
      var el = specs[i], r = RAILS[el.getAttribute('data-rail')];
      if (!r) continue;
      var a = dot(rot(r.n, rx, ry), H);
      var b = dot(rot(r.t, rx, ry), H);
      var q = Math.atan2(b, a);
      var peak = Math.hypot(a, b);
      var on = Math.abs(q) <= PHI / 2 && peak > 0;
      el.style.opacity = on ? (Math.pow(peak, 3.2) * 0.95).toFixed(3) : '0';
      if (on) {
        var shift = ((q / (PHI / 2)) * 50).toFixed(2) + '%';
        el.style.transform = r.axis === 'y' ? 'translateY(' + shift + ')' : 'translateX(' + shift + ')';
      }
    }

    // Front glass. Schlick's approximation with n = 1.52:
    // R0 = ((1.52-1)/(1.52+1))^2 = 0.0426, R = R0 + (1-R0)(1-cos)^5.
    // 0.043 face-on, 0.10 at 65 degrees, 0.34 at 78 — the flare is confined
    // to grazing incidence, which is exactly where a real screen flares.
    var cosT = Math.cos(rx) * Math.cos(ry);       // N_front · V
    var R = 0.0426 + 0.9574 * Math.pow(1 - Math.abs(cosT), 5);
    if (rim) rim.style.opacity = clamp(R * 2.1, 0.03, 0.9).toFixed(3);
    if (gloss) {
      gloss.style.opacity = (0.10 + 0.26 * clamp(Math.abs(Math.sin(ry)), 0, 1)).toFixed(3);
      gloss.style.transform = 'translateX(' + (-Math.sin(ry) * 34).toFixed(1) + '%)';
    }

    // Shadow. The silhouette a box casts is its projected width, so turning
    // about the vertical axis makes the shadow NARROWER — it does not slide
    // sideways, which is what the old `translate(sin(ry) * 26px)` implied
    // (a lamp orbiting with the object). The lateral offset comes from the
    // light and is therefore near-constant: |Lx/Ly| = 0.349.
    var k = (W * Math.abs(Math.cos(ry)) + D * Math.abs(Math.sin(ry))) / W;
    var off = (Math.abs(L[0] / L[1]) * (34 + lift * 16));
    if (shCore) {
      shCore.style.transform = 'translate(' + off.toFixed(1) + 'px, 0) scale(' +
        k.toFixed(3) + ',' + (1 - lift * .38).toFixed(3) + ')';
      shCore.style.opacity = (0.42 * (1 - lift * .55)).toFixed(3);
    }
    if (shPen) {
      shPen.style.transform = 'translate(' + off.toFixed(1) + 'px, 0) scale(' +
        (k * (1 + lift * .18)).toFixed(3) + ',' + (1 + lift * .24).toFixed(3) + ')';
      shPen.style.opacity = (0.30 * (1 - lift * .12)).toFixed(3);
    }
  }

  /* ── object 2 · the ring ─────────────────────────────────────
     Six 232px faces closed into a solid hexagonal prism. For a regular
     hexagon the side equals the circumradius, so the faces sit at the
     apothem, 232·sqrt(3)/2 = 201px. At the old 330px radius the faces were
     ~98px apart and you could see straight through the object. */

  var ringScene = document.getElementById('ringScene');
  var ring = document.getElementById('ring');
  var cards = ring ? [].slice.call(ring.children) : [];
  var shades = cards.map(function (c) { return c.querySelector('.shade'); });
  var ringTitle = document.getElementById('ringTitle');
  var ringNote = document.getElementById('ringNote');
  var ringDots = document.getElementById('ringDots');

  var N = cards.length;
  var STEP = N ? 360 / N : 60;
  var RADIUS = 201;
  var ringTarget = 0, ringNow = 0, ringFace = -1, ringLocked = false;
  var cardVis = [];

  /* The controls are built unconditionally and work in both modes. The
     previous build created them outside the reduced-motion guard but only
     ever moved the ring from inside the rAF loop — so with Reduce Motion on,
     six focusable, labelled buttons did nothing at all and the caption stayed
     frozen on the first capability for the life of the page. */
  var dotBtns = [];
  if (ringDots && N) {
    cards.forEach(function (card, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-label', card.getAttribute('data-label'));
      b.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
      b.addEventListener('click', function () { selectFace(i, true); });
      b.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        var next = (i + (e.key === 'ArrowRight' ? 1 : -1) + N) % N;
        dotBtns[next].focus();
        selectFace(next, true);
      });
      ringDots.appendChild(b);
      dotBtns.push(b);
    });
  }

  function describe(i) {
    if (i === ringFace) return;
    ringFace = i;
    if (ringTitle) ringTitle.textContent = cards[i].getAttribute('data-label');
    if (ringNote) ringNote.textContent = cards[i].getAttribute('data-note');
    dotBtns.forEach(function (b, j) { b.setAttribute('aria-selected', j === i ? 'true' : 'false'); });
  }

  function selectFace(i, fromUser) {
    describe(i);
    if (reduced) {
      // Flat row: bring the chosen screen into view. A scroll, not a tween.
      if (cards[i].scrollIntoView) {
        cards[i].scrollIntoView({ block: 'nearest', inline: 'center' });
      }
    } else {
      // Take the short way round rather than unwinding through the others.
      var want = -i * STEP;
      while (want - ringNow > 180) want -= 360;
      while (want - ringNow < -180) want += 360;
      ringTarget = want;
      if (fromUser) ringLocked = true;
    }
  }

  function faceFor(angle) {
    var idx = Math.round(-angle / STEP) % N;
    return (idx + N) % N;
  }

  /* ── object 3 · the stack ────────────────────────────────── */

  var stackScene = document.getElementById('stackScene');
  var stackObj = document.getElementById('stackObj');
  var planes = stackObj ? [].slice.call(stackObj.children) : [];
  var spread = 0;

  /* ── the loop: read everything, then write everything ────── */

  var prev = 0;
  var readings = { ringTop: 0, ringH: 0, stackTop: 0, vh: 0, scrollY: 0 };

  function frame(t) {
    var dt = prev ? Math.min((t - prev) / 1000, .05) : 1 / 60;
    prev = t;

    // ---- READ PHASE: every layout query on the page, before any write ----
    readings.vh = window.innerHeight;
    readings.scrollY = window.scrollY;
    if (ringScene) {
      var rr = ringScene.getBoundingClientRect();
      readings.ringTop = rr.top; readings.ringH = rr.height;
    }
    if (stackScene) readings.stackTop = stackScene.getBoundingClientRect().top;

    // ---- WRITE PHASE: nothing below reads layout ----
    if (bar) bar.classList.toggle('is-stuck', readings.scrollY > 8);

    // device
    if (device) {
      if (!held) {
        rot3.y += vel.y; rot3.x += vel.x;
        vel.y *= .94; vel.x *= .94;
        if (Math.abs(vel.y) < .004) vel.y = 0;
        if (Math.abs(vel.x) < .004) vel.x = 0;
        if (!touched) rot3.y += dt * 6;                       // 6 deg/s idle
        rot3.x = lerp(rot3.x, REST_X + Math.sin(t / 2600) * 3, 1 - Math.pow(.5, dt * 1.6));
      }
      var float = Math.sin(t / 2200) * 8;
      var lift = (float + 8) / 16;
      device.style.transform =
        'translateY(' + float.toFixed(2) + 'px) rotateX(' + rot3.x.toFixed(2) +
        'deg) rotateY(' + rot3.y.toFixed(2) + 'deg)';
      lightDevice(rot3.x, rot3.y, lift);
    }

    // ring
    if (ring && ringScene && N) {
      if (!ringLocked) {
        var p = clamp((readings.vh - readings.ringTop) / (readings.vh + readings.ringH), 0, 1);
        ringTarget = -p * 360;
      }
      ringNow = lerp(ringNow, ringTarget, 1 - Math.pow(.5, dt * 7));
      ring.style.transform = 'translateZ(-' + RADIUS + 'px) rotateY(' + ringNow.toFixed(2) + 'deg)';

      for (var i = 0; i < N; i++) {
        var facing = Math.cos((i * STEP + ringNow) * RAD);
        // Turned away means unlit, not transparent.
        if (shades[i]) {
          shades[i].style.opacity = (0.80 * Math.pow((1 - facing) / 2, 0.9)).toFixed(3);
        }
        /* The hexagon is closed, so a face pointing away is fully occluded by
           the three in front of it — cull at the horizon rather than well
           past it, which halves what is painted. Written only on change: an
           inline style assignment dirties the element even when the value is
           identical, and doing that to six cards every frame is a style
           recalc per frame for nothing. */
        var vis = facing < -0.02 ? 'hidden' : 'visible';
        if (cardVis[i] !== vis) { cardVis[i] = vis; cards[i].style.visibility = vis; }
      }
      describe(faceFor(ringNow));
    }

    // stack
    if (stackScene && stackObj && planes.length) {
      var sp = clamp((readings.vh * .9 - readings.stackTop) / (readings.vh * .75), 0, 1);
      spread = lerp(spread, sp, 1 - Math.pow(.5, dt * 6));
      stackObj.style.transform =
        'rotateX(' + (58 - spread * 40).toFixed(2) + 'deg) rotateZ(' + (-32 + spread * 14).toFixed(2) + 'deg)';
      for (var j = 0; j < planes.length; j++) {
        planes[j].style.transform = 'translateZ(' + (-j * 150 * spread).toFixed(1) + 'px)';
      }
    }

    requestAnimationFrame(frame);
  }

  // Scrolling hands the ring back to the page.
  window.addEventListener('scroll', function () { ringLocked = false; }, { passive: true });

  if (!reduced) {
    requestAnimationFrame(frame);
  } else {
    /* Static, lit, and scheduled exactly once. The pose is real 3D — a
       photograph of a lit solid — because Reduce Motion governs animation,
       not static rendering, and flattening the object outright would take
       the geometry the light needs with it. */
    if (device) {
      device.style.transform = 'rotateX(' + REST_X + 'deg) rotateY(' + REST_Y + 'deg)';
      lightDevice(REST_X, REST_Y, 0);
    }
    describe(0);
    if (bar) {
      window.addEventListener('scroll', function () {
        bar.classList.toggle('is-stuck', window.scrollY > 8);
      }, { passive: true });
    }
  }

}());
