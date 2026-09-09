/* Sunday — light build.

   Three real objects in three cameras: a device you can pick up and turn,
   a cylinder of screens, and a stack of layers pulled apart in depth. All
   of them are built from planes in preserve-3d space and driven from one
   rAF loop, so there is a single frame budget for the page rather than
   one per effect.

   Progressive enhancement: every section reads and every link works with
   this file absent. Under Reduce Motion the loop never starts — the HIG
   asks for z-axis depth animation to be avoided outright, and this page is
   almost entirely z-axis, so the stylesheet flattens the scenes and this
   file stays out of the way. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp  = function (a, b, t) { return a + (b - a) * t; };

  /* ── entrance ────────────────────────────────────────────────
     Brief and precise, and it never gates anything: the content is
     already there, this only uncovers it. */

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

  /* ── sticky bar hairline ─────────────────────────────────── */

  var bar = document.getElementById('bar');

  /* ── object 1 · the device ───────────────────────────────────
     A solid with six faces. It has a resting attitude, a slow idle
     drift, and it can be picked up and turned — the rotation tracks
     the pointer on the axis it is dragged along, and carries its
     momentum when released, because motion the HIG calls "realistic
     and reversible along the gesture axis" is the difference between
     turning an object and scrubbing an animation. */

  var device = document.getElementById('device');
  var deviceShadow = document.getElementById('deviceShadow');
  var heroScene = document.getElementById('heroScene');
  var dragHint = document.getElementById('dragHint');

  var rot = { x: -8, y: -26 };        // where it is
  var vel = { x: 0, y: 0 };           // where it is going
  var held = false, touched = false;
  var last = { x: 0, y: 0 }, lastT = 0;

  function pointerDown(e) {
    held = true;
    device.classList.add('is-held');
    last.x = e.clientX; last.y = e.clientY; lastT = e.timeStamp;
    vel.x = vel.y = 0;
    device.setPointerCapture && device.setPointerCapture(e.pointerId);
    if (!touched) {
      touched = true;
      if (dragHint) dragHint.classList.add('is-gone');
    }
  }

  function pointerMove(e) {
    if (!held) return;
    var dx = e.clientX - last.x, dy = e.clientY - last.y;
    var dt = Math.max(e.timeStamp - lastT, 1);
    // Horizontal drag turns it about Y, vertical about X. Same axis out
    // as in, so letting go and pushing back undoes it.
    rot.y += dx * .38;
    rot.x = clamp(rot.x - dy * .3, -62, 62);
    vel.y = (dx * .38) / dt * 16;
    vel.x = (-dy * .3) / dt * 16;
    last.x = e.clientX; last.y = e.clientY; lastT = e.timeStamp;
  }

  function pointerUp(e) {
    if (!held) return;
    held = false;
    device.classList.remove('is-held');
    device.releasePointerCapture && e.pointerId != null &&
      device.releasePointerCapture(e.pointerId);
  }

  if (device && !reduced) {
    device.addEventListener('pointerdown', pointerDown);
    window.addEventListener('pointermove', pointerMove, { passive: true });
    window.addEventListener('pointerup', pointerUp);
    window.addEventListener('pointercancel', pointerUp);
    // Keyboard is a first-class way to turn it, not an afterthought.
    device.tabIndex = 0;
    device.addEventListener('keydown', function (e) {
      var step = e.shiftKey ? 15 : 6;
      if (e.key === 'ArrowLeft')  { rot.y -= step; e.preventDefault(); }
      if (e.key === 'ArrowRight') { rot.y += step; e.preventDefault(); }
      if (e.key === 'ArrowUp')    { rot.x = clamp(rot.x - step, -62, 62); e.preventDefault(); }
      if (e.key === 'ArrowDown')  { rot.x = clamp(rot.x + step, -62, 62); e.preventDefault(); }
      if (!touched) { touched = true; if (dragHint) dragHint.classList.add('is-gone'); }
    });
  }

  function paintDevice(t, dt) {
    if (!device) return;

    if (!held) {
      // Momentum, then a slow idle drift so the object never looks dead.
      rot.y += vel.y;
      rot.x += vel.x;
      vel.y *= .94; vel.x *= .94;
      if (Math.abs(vel.y) < .004) vel.y = 0;
      if (Math.abs(vel.x) < .004) vel.x = 0;

      if (!touched) rot.y += dt * 6;                 // 6°/s until first touched
      // Ease the tilt back towards its resting attitude, gently enough
      // that it reads as the object settling rather than snapping.
      rot.x = lerp(rot.x, -8 + Math.sin(t / 2600) * 3, 1 - Math.pow(.5, dt * 1.6));
    }

    var float = Math.sin(t / 2200) * 8;
    device.style.transform =
      'translateY(' + float.toFixed(2) + 'px) ' +
      'rotateX(' + rot.x.toFixed(2) + 'deg) rotateY(' + rot.y.toFixed(2) + 'deg)';

    if (deviceShadow) {
      // The shadow answers to the object: it slides with the turn and
      // tightens as the object rises.
      var lift = (float + 8) / 16;
      var skew = Math.sin(rot.y * Math.PI / 180);
      deviceShadow.style.transform =
        'translate(' + (skew * 26).toFixed(1) + 'px, ' + (300 + lift * 8).toFixed(1) + 'px) ' +
        'scale(' + (1 - lift * .12).toFixed(3) + ', 1)';
      deviceShadow.style.opacity = (0.5 - lift * .16).toFixed(3);
    }
  }

  /* ── object 2 · the ring ─────────────────────────────────────
     Six screens standing on a cylinder. Scroll turns it; the one
     nearest the camera is the one being described. */

  var ringScene = document.getElementById('ringScene');
  var ring = document.getElementById('ring');
  var cards = ring ? [].slice.call(ring.children) : [];
  var ringTitle = document.getElementById('ringTitle');
  var ringNote = document.getElementById('ringNote');
  var ringDots = document.getElementById('ringDots');

  var N = cards.length;
  var STEP = N ? 360 / N : 60;
  var RADIUS = 330;
  var ringTarget = 0, ringNow = 0, ringFace = -1, ringLocked = false;

  cards.forEach(function (card, i) {
    card.style.transform = 'rotateY(' + (i * STEP) + 'deg) translateZ(' + RADIUS + 'px)';
  });

  if (ringDots && N) {
    cards.forEach(function (card, i) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', card.getAttribute('data-label'));
      b.addEventListener('click', function () {
        // A tap is a direct request: go there and hold it until the
        // reader scrolls again, rather than fighting the scroll.
        ringTarget = -i * STEP;
        ringLocked = true;
      });
      li.appendChild(b);
      ringDots.appendChild(li);
    });
  }

  function faceFor(angle) {
    var idx = Math.round(-angle / STEP) % N;
    return (idx + N) % N;
  }

  function paintRing(dt) {
    if (!ring || !ringScene || !N) return;

    if (!ringLocked) {
      var r = ringScene.getBoundingClientRect();
      var vh = window.innerHeight;
      // Progress of the scene across the viewport, 0 as it enters, 1 as
      // it leaves. One full turn of the cylinder over that travel.
      var p = clamp((vh - r.top) / (vh + r.height), 0, 1);
      ringTarget = -p * 360;
    }

    // Chase rather than track, so a flick spins it up and it settles.
    ringNow = lerp(ringNow, ringTarget, 1 - Math.pow(.5, dt * 7));
    ring.style.transform = 'translateZ(-' + RADIUS + 'px) rotateY(' + ringNow.toFixed(2) + 'deg)';

    // Dim the screens facing away — depth, not decoration: it is what
    // makes the far side read as the far side.
    for (var i = 0; i < N; i++) {
      var a = (i * STEP + ringNow) * Math.PI / 180;
      var facing = Math.cos(a);                       // 1 towards camera
      cards[i].style.opacity = (0.22 + Math.max(facing, 0) * 0.78).toFixed(3);
    }

    var f = faceFor(ringNow);
    if (f !== ringFace) {
      ringFace = f;
      if (ringTitle) ringTitle.textContent = cards[f].getAttribute('data-label');
      if (ringNote) ringNote.textContent = cards[f].getAttribute('data-note');
      if (ringDots) {
        [].forEach.call(ringDots.querySelectorAll('button'), function (b, i) {
          b.setAttribute('aria-current', i === f ? 'true' : 'false');
        });
      }
    }
  }

  // Any scroll hands control back to the page.
  window.addEventListener('scroll', function () { ringLocked = false; }, { passive: true });

  /* ── object 3 · the stack ────────────────────────────────────
     Three layers at one depth, pulled apart into three as the section
     crosses the viewport. The separation is the point: they are not
     three cards, they are three planes at different distances. */

  var stackScene = document.getElementById('stackScene');
  var stackObj = document.getElementById('stackObj');
  var planes = stackObj ? [].slice.call(stackObj.children) : [];
  var spread = 0;

  function paintStack(dt) {
    if (!stackScene || !stackObj || !planes.length) return;

    var r = stackScene.getBoundingClientRect();
    var vh = window.innerHeight;
    var p = clamp((vh * .9 - r.top) / (vh * .75), 0, 1);
    spread = lerp(spread, p, 1 - Math.pow(.5, dt * 6));

    stackObj.style.transform =
      'rotateX(' + (58 - spread * 40).toFixed(2) + 'deg) rotateZ(' + (-32 + spread * 14).toFixed(2) + 'deg)';

    for (var i = 0; i < planes.length; i++) {
      var z = -i * 150 * spread;
      planes[i].style.transform = 'translateZ(' + z.toFixed(1) + 'px)';
      planes[i].style.opacity = (1 - i * .12 * spread).toFixed(3);
    }
  }

  /* ── one loop ────────────────────────────────────────────────
     Everything above is painted from here. The loop runs only while
     the page is visible: a background tab throttles rAF anyway, and
     there is nothing to animate for someone who is not looking. */

  var prev = 0;

  function frame(t) {
    var dt = prev ? Math.min((t - prev) / 1000, .05) : 1 / 60;
    prev = t;

    if (bar) bar.classList.toggle('is-stuck', window.scrollY > 8);

    paintDevice(t, dt);
    paintRing(dt);
    paintStack(dt);

    requestAnimationFrame(frame);
  }

  if (!reduced) {
    requestAnimationFrame(frame);
  } else if (bar) {
    window.addEventListener('scroll', function () {
      bar.classList.toggle('is-stuck', window.scrollY > 8);
    }, { passive: true });
  }

  /* Videos: autoplay is muted and looping, and only while on screen, so
     nothing plays for a section nobody is looking at. */
  if ('IntersectionObserver' in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          if (v.preload === 'none') { v.preload = 'auto'; v.load(); }
          v.play().catch(function () {});
        } else { v.pause(); }
      });
    }, { rootMargin: '200px 0px', threshold: .1 });
    [].forEach.call(document.querySelectorAll('video'), function (v) { vo.observe(v); });
  }

}());
