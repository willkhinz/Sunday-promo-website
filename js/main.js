/* Sunday — promo site
   Progressive enhancement only: every section is readable and the CTAs
   all work with this file absent. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ── clips ─────────────────────────────────────────────────
     Rendered clips that stand in for the static frames. Each entry keys a
     `data-clip` slot in the markup; a slot with no entry keeps the still
     it already contains, so the page is complete with none of these
     present and adding one is a single line here.

     Deliberately not `src` attributes in the HTML: the deploy verifies
     that every referenced local path exists, so naming a file before it
     is rendered would fail the build rather than degrade quietly.

     Give each clip both an .mp4 (H.264) and a .webm (VP9). Safari needs
     the first; the second is usually the smaller file for everyone else.
     `poster` is optional — the slot's own <img> is used when it is
     absent. */
  var CLIPS = {
    hero:   { mp4: 'assets/video/hero-answer.mp4', webm: 'assets/video/hero-answer.webm' },
    answer: { mp4: 'assets/video/hero-answer.mp4', webm: 'assets/video/hero-answer.webm' },
    tune:   { mp4: 'assets/video/tune.mp4',        webm: 'assets/video/tune.webm' }
  };

  (function mountClips() {
    var slots = document.querySelectorAll('[data-clip]');
    if (!slots.length) return;

    [].forEach.call(slots, function (slot) {
      var spec = CLIPS[slot.getAttribute('data-clip')];
      if (!spec || reduced) return;         // keep the still

      var still = slot.querySelector('img');
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true;
      v.setAttribute('muted', '');          // Safari wants the attribute too
      v.setAttribute('playsinline', '');
      // Nothing downloads until the slot is close to the viewport; a clip
      // in the footer should not compete with the hero for bandwidth.
      v.preload = 'none';
      if (spec.poster) v.poster = spec.poster;
      else if (still) v.poster = still.currentSrc || still.src;
      v.setAttribute('aria-hidden', 'true');

      (spec.webm ? [['webm', 'video/webm'], ['mp4', 'video/mp4']]
                 : [['mp4', 'video/mp4']]).forEach(function (pair) {
        if (!spec[pair[0]]) return;
        var s = document.createElement('source');
        s.src = spec[pair[0]]; s.type = pair[1];
        v.appendChild(s);
      });

      slot.appendChild(v);
      slot.classList.add('has-clip');       // hides the still, shows the video

      if (!('IntersectionObserver' in window)) { v.preload = 'auto'; v.play().catch(function(){}); return; }
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
            v.play().catch(function () {});   // a blocked autoplay leaves the poster
          } else {
            v.pause();
          }
        });
      }, { rootMargin: '200px 0px', threshold: 0.15 }).observe(slot);
    });
  }());

  /* ── scroll reveal ─────────────────────────────────────── */

  var revealables = document.querySelectorAll('.reveal');

  if (reduced || !('IntersectionObserver' in window)) {
    revealables.forEach(function (el) { el.classList.add('is-in'); });
  } else {
    var revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-in');
        revealObserver.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    revealables.forEach(function (el, i) {
      // Stagger siblings so grids cascade instead of snapping in as a block.
      var prev = el.previousElementSibling;
      if (prev && prev.classList.contains('reveal')) {
        el.style.transitionDelay = Math.min(i % 6, 5) * 55 + 'ms';
      }
      revealObserver.observe(el);
    });
  }

  /* ── header background on scroll ───────────────────────── */

  var header = document.getElementById('header');
  var sticky = document.getElementById('stickyCta');
  var hero = document.getElementById('top');

  /* ── walkthrough ───────────────────────────────────────────
     Eleven actions, each handing off by its own mechanism. Driven from
     the same scroll handler as everything else rather than a second
     listener, so there is one rAF per frame for the whole page. */

  var walk = (function () {
    var root = document.getElementById('walk');
    if (!root || reduced) return { render: function () {}, measure: function () {} };

    var $ = function (s, r) { return (r || document).querySelector(s); };
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var ease  = function (t) { return t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2; };
    var span  = function (p, a, b) { return clamp((p - a) / (b - a), 0, 1); };
    var set   = function (el, k, v) { el.style.setProperty(k, v); };

    var chatSvg    = $('#chatSvg', root),
        chatKicker = $('#chatKicker', root),
        chatL1     = $('#chatL1', root),
        chatL2     = $('#chatL2', root);
    var zoom = null;   // fitted type + the letter to fly into, filled by measure()
    var loc  = null;   // the reticle's open and closed boxes, filled by measure()

    /* Where Locate's viewfinder starts and where it lands. The open box is
       the free area of the stage inset a little, so the corners begin at
       the screen edges; the closed box is a frame around the copy.

       The closed box is measured off the copy itself. It used to be a
       fixed 360px cap, which is about right for a phone and wrong for
       anything wider: on a desktop the line runs to some 800px, so the
       brackets closed to well inside the words and the step ended as four
       little squares sitting on top of the text. */
    function measureLocate() {
      var ret = $('#locate .reticle', root);
      if (!ret) return;
      var st = ret.parentNode, cs = getComputedStyle(st);
      var free = st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);

      // A Range over the contents, not the element's own box: the box is a
      // full-width block carrying the section's inline padding, so framing
      // that would put the brackets outside the screen on a phone and give
      // a misleading width everywhere. The Range gives the type's real
      // extent. (--fxo may be holding the line at zero opacity right now;
      // layout, and therefore this measurement, is unaffected.)
      var fix = $('.fix', st), tr = null;
      if (fix) {
        var rng = document.createRange();
        rng.selectNodeContents(fix);
        var rr = rng.getBoundingClientRect();
        if (rr.width > 1) tr = rr;
      }
      var pad = 30;
      var w1 = tr ? Math.min(tr.width + pad * 2, st.clientWidth - 22) : Math.min(st.clientWidth * .9, 360);
      var h1 = tr ? Math.min(tr.height + pad * 2, free - 40) : Math.min(w1 * .6, free - 60);

      loc = { w0: st.clientWidth - 26, h0: Math.max(free - 22, 240),
              w1: w1, h1: Math.max(h1, 120) };
    }

    /* Lay the three lines out in user units for a W x H viewBox. Called
       repeatedly while fitting, so it must be a pure function of fs. */
    function layout(fs, W, H) {
      var lh = fs * 1.16, kfs = Math.max(10, fs * .34), gap = fs * .52;
      var top = H / 2 - (kfs + gap + lh * 2) / 2;
      var base = top + kfs + gap + fs * .8;
      chatKicker.style.fontSize = kfs.toFixed(2) + 'px';
      chatL1.style.fontSize = chatL2.style.fontSize = fs.toFixed(2) + 'px';
      chatKicker.setAttribute('x', (W/2).toFixed(1)); chatKicker.setAttribute('y', (top + kfs).toFixed(1));
      chatL1.setAttribute('x', (W/2).toFixed(1));     chatL1.setAttribute('y', base.toFixed(1));
      chatL2.setAttribute('x', (W/2).toFixed(1));     chatL2.setAttribute('y', (base + lh).toFixed(1));
      return base + lh;
    }

    function measure() {
      measureSteps();
      measureLocate();
      if (!chatSvg || !chatL2) return;
      var r = chatSvg.getBoundingClientRect();
      var W = Math.round(r.width), H = Math.round(r.height);
      if (W < 2 || H < 2) return;

      // One user unit to one CSS pixel at rest, so the type here matches the
      // scale of the rest of the walkthrough instead of needing its own.
      chatSvg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

      var fs = Math.max(22, Math.min(W * .085, 48)), base = 0;
      for (var i = 0; i < 5; i++) {
        base = layout(fs, W, H);
        var widest = Math.max(chatL1.getComputedTextLength(), chatL2.getComputedTextLength());
        if (widest <= W * .88) break;
        fs *= (W * .88) / widest;                // shrink to fit rather than overrun
      }

      // How big the letter actually is, in ink. Neither getExtentOfChar nor
      // getBBox answers this: both report the advance box — glyph plus side
      // bearings, em ascent to descent — which for a lowercase "o" is about
      // twice as tall as the ring you can see. Sizing the zoom off that
      // stops it a full doubling short of clearing the frame. Canvas is the
      // one API that returns tight bounds, so ask it.
      var cs = getComputedStyle(chatL2);
      var mx = document.createElement('canvas').getContext('2d');
      mx.font = cs.fontStyle + ' ' + cs.fontWeight + ' ' + fs.toFixed(2) + 'px ' + cs.fontFamily;
      var m = mx.measureText('o');
      var inkW, inkH, inkMid;
      if (typeof m.actualBoundingBoxAscent === 'number') {
        inkW = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
        inkH = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent;
        inkMid = (m.actualBoundingBoxDescent - m.actualBoundingBoxAscent) / 2;   // from the baseline
      } else {
        inkW = m.width * .86; inkH = fs * .53; inkMid = -fs * .26;
      }
      if (!(inkW > 0) || !(inkH > 0)) return;

      var idx = Math.max(chatL2.textContent.indexOf('o'), 0);
      var ext;
      try {
        ext = chatL2.getExtentOfChar(idx);
      } catch (e) {
        ext = { x: W / 2 - 10, y: base, width: 20, height: 20 };
      }

      // The frame has cleared the letter once it fits inside the ink on both
      // axes; on a tall phone the vertical crossing is much the later of the
      // two, so it sets the depth. Then carry on past it, far enough that the
      // stroke is well gone and the counter — black, like the page — is all
      // that is left to hand over to the next step.
      var clear = Math.min(inkW, inkH * (W / H));
      zoom = {
        W: W, H: H,
        cx: ext.x + ext.width / 2,
        cy: base + inkMid,                      // ink centre, not the baseline
        vwEnd: Math.max(clear * .45, 0.02)
      };
    }

    /* Ease in, then hold a constant rate. Paired with the geometric zoom
       below this reads as a steady push down a tunnel. A symmetric ease
       would decelerate into the end instead, which here means idling
       inside the letter — on a black screen — for the last fifth of the
       scroll, which is exactly the dead space the runways were shortened
       to remove. */
    function zin(r) { var k = .30; return (r < k ? r*r/(2*k) : r - k/2) / (1 - k/2); }

    /* The curve every reveal runs on.

       Each step opens from a closed frame — a shut aperture, a zero-radius
       ripple, a masked page — and a closed frame is a black screen. A
       symmetric ease barely moves for its first fifth, so that fifth is
       spent looking at black, once per step, eleven times over. Measured
       across the whole walkthrough that was a fifth of the entire scroll.

       This leaves zero with real speed and still settles rather than
       stopping dead: about a sixth of the move is done in the first tenth,
       two thirds by halfway. */
    function reveal(t) { return .45 * t + .55 * (1 - Math.pow(1 - t, 2.2)); }

    /* For a move that is itself the thing worth watching, rather than a
       curtain being pulled off one. Holds a constant rate for most of its
       length and only eases over the last third, so the motion is spread
       evenly instead of being mostly over by the time you notice it. */
    function land(t) {
      var k = .32, v = 1 / (1 - k / 2), u = t - (1 - k);
      return t <= 1 - k ? v * t : v * ((1 - k) + u - u * u / (2 * k));
    }

    /* How much of a step's runway the reveal occupies. It was under half,
       which left the back two thirds of every step a frozen picture — the
       reason the transitions read as over before they started. Chat is
       the one step that already ran its whole length, and the one that
       didn't have the problem. */
    var W = .86;

    var moves = {
      chat: function (q, s) {                         // floating bubbles then zoom into letter
        if (!zoom) return;

        // User bubble pops up (0.02 → 0.12)
        // AI bubble pops up (0.10 → 0.20)
        // AI text streams (0.12 → 0.38)
        // Bubbles hold until 0.54, then fade out (0.54 → 0.66)
        var fade = 1 - span(q, .54, .66);

        var uOp = reveal(span(q, .02, .12)) * fade;
        var uEl = $('#userBubble', s);
        if (uEl) set(uEl, '--u-op', uOp.toFixed(3));

        var aOp = reveal(span(q, .10, .20)) * fade;
        var aEl = $('#aiBubble', s);
        if (aEl) set(aEl, '--a-op', aOp.toFixed(3));

        var body = $('#aiText', s);
        if (body) {
          var full = 'Sourdough fails to rise due to inactive starter yeast, improper room temperature, under-proofing, or excess hydration inhibiting gluten structure.';
          var words = full.split(' ');
          var prog = span(q, .12, .38);
          var n = Math.floor(prog * words.length);
          body.textContent = prog <= 0 ? '' : prog >= 1 ? full : words.slice(0, Math.max(1, n)).join(' ') + '\u2026';
        }

        // Zoom into letter "o" (0.48 → 1.0)
        var r = span(q, .48, 1), t = zin(r);
        var vw = zoom.W * Math.pow(zoom.vwEnd / zoom.W, t);
        var vh = vw * (zoom.H / zoom.W);
        var c = ease(clamp(r / .5, 0, 1));
        var cx = zoom.W / 2 + (zoom.cx - zoom.W / 2) * c;
        var cy = zoom.H / 2 + (zoom.cy - zoom.H / 2) * c;
        chatSvg.setAttribute('viewBox',
          (cx - vw/2).toFixed(3) + ' ' + (cy - vh/2).toFixed(3) + ' ' +
          vw.toFixed(3) + ' ' + vh.toFixed(3));
      },
      see: function (q, s) {                        // an aperture opens
        set($('.lens',s),'--slit',(50 - reveal(span(q,0,W))*50).toFixed(2)+'%');
      },
      hear: function (q, s) {                       // a ripple spreads outward
        set($('.ripple',s),'--r',(reveal(span(q,0,W))*82).toFixed(1)+'%');
        [].forEach.call(s.querySelectorAll('.ring'), function (r, i) {
          var t = span(q, i*.09, .62 + i*.09);
          set(r,'--rs',(t*3.4).toFixed(2));
          set(r,'--ro',(Math.sin(t*Math.PI)*.5).toFixed(2));
        });
      },
      watch: function (q, s) {                      // frames flick past, one settles
        var strip = $('.strip',s), w = strip.firstElementChild.offsetWidth + 14;
        var t = reveal(span(q,0,W));
        set(strip,'--sx',((1-t)*w*1.9).toFixed(1)+'px');
        set(strip,'--so',(.1 + t*.28).toFixed(2));
      },
      read: function (q, s) {                       // lines reveal down the page
        var t = reveal(span(q,0,W));
        set($('.phone',s),'--unread',((1-t)*100).toFixed(1)+'%');
        var rule = $('.rule',s);
        set(rule,'--ruleY',(t*100).toFixed(1)+'%');
        set(rule,'--ruleO',(Math.sin(clamp(t,0,1)*Math.PI)*.9).toFixed(2));
      },
      search: function (q, s) {                     // a lens sweeps, then opens out
        var t = span(q,0,W);
        // Hold the lens small while it travels, or it covers the viewport
        // before the sweep is legible; only widen once it has crossed.
        var sweep = reveal(clamp(t/.66,0,1)), open = reveal(clamp((t-.66)/.34,0,1));
        var r = 104 + open * Math.max(innerWidth, innerHeight) * 1.3;
        var lx = 16 + sweep * 68;
        var el = $('.scan',s), halo = $('.halo',s);
        set(el,'--lens',r.toFixed(0)+'px');   set(el,'--lx',lx.toFixed(1)+'%');
        set(halo,'--lens',r.toFixed(0)+'px'); set(halo,'--lx',lx.toFixed(1)+'%');
        set(halo,'--haloO',((1-open)*.75).toFixed(2));
      },
      locate: function (q, s) {                     // a viewfinder closing on a fix
        if (!loc) return;
        var ret = $('.reticle',s), t = reveal(span(q,0,W));
        set(ret,'--rw',(loc.w0 + (loc.w1 - loc.w0) * t).toFixed(1)+'px');
        set(ret,'--rh',(loc.h0 + (loc.h1 - loc.h0) * t).toFixed(1)+'px');
        // The brackets are the mechanism, not the message: up quickly,
        // then out once they have closed, leaving the line they found.
        set(ret,'--ro',(Math.min(t/.10,1) * (1 - span(q,.80,.92))).toFixed(3));
        set($('.fix',s),'--fxo', reveal(span(q,.06,.46)).toFixed(3));
      },
      calc: function (q, s) {                       // counts up to the answer
        // Deliberately a count rather than a digit scramble: scroll can stop
        // anywhere, and a frozen scramble reads as a wrong answer where a
        // frozen count still reads as working.
        $('#calcNum', s).textContent = String(Math.round(reveal(span(q,0,W)) * 4410));
      },
      remember: function (q, s) {                   // earlier screens recede behind
        set($('.deck',s),'--spread', reveal(span(q,0,W)).toFixed(3));
      },
      think: function (q, s) {                      // unfolds from a vertical seam
        var t = reveal(span(q,0,W));
        set($('.fold',s),'--seam',((1-t)*50).toFixed(2)+'%');
        set($('.seamline',s),'--seamO',(Math.sin(clamp(t,0,1)*Math.PI)*.9).toFixed(2));
      },
      know: function (q, s) {                       // the closing line folds shut
        var el = $('.final',s);
        // Up out of black almost at once, so the step never opens on
        // nothing — but that is all the reveal curve is for here.
        set(el,'--fo', reveal(span(q,0,.07)).toFixed(3));
        // The fold is the thing worth watching, so it runs at a near
        // constant rate instead. On the reveal curve it spent most of its
        // travel in the first fraction of the step, while the line was
        // still fading up — by the time you could read it, it had already
        // arrived. Over 60% of a runway that is itself the longest of the
        // eleven, this takes about two and a half seconds.
        var t = land(span(q,0,.60));
        // A couple of degrees past flat and back, so it settles like a
        // sheet pressed down rather than stopping dead in mid-air.
        var a = (1 - t) * 68 - Math.sin(span(q,.50,.72) * Math.PI) * 3.0;
        set(el,'--fold', a.toFixed(2)+'deg');
        set(el,'--lit', (1 - .5 * (1 - Math.cos(a * Math.PI / 180))).toFixed(3));
      }
    };

    /* Most steps hold their label until the screen is nearly black. Chat
       ends inside a letter that fills the frame in white, and grey type on
       white is unreadable, so its label leaves before the flare. */
    var capOut = { chat: [.70, .79] };

    var steps = [].slice.call(root.querySelectorAll('.step')).map(function (el) {
      return { el: el, stage: $('.stage', el), fade: $('[data-fade]', el),
               cap: $('[data-cap]', el), move: moves[el.id],
               co: capOut[el.id] || [.86, .96], top: 0, runway: 0 };
    });

    /* Each step's position in the document, so the paint loop can work off
       the smoothed scroll position alone. Reading live rects there would
       reintroduce the real scroll position through the back door. */
    var walkTop = 0, walkEnd = 0;

    function measureSteps() {
      var vh = window.innerHeight, sy = window.scrollY;
      steps.forEach(function (s) {
        var r = s.el.getBoundingClientRect();
        s.top = r.top + sy;
        s.runway = r.height - vh;
      });
      walkTop = steps[0].top;
      walkEnd = steps[steps.length - 1].top + steps[steps.length - 1].runway;
    }

    /* Animations follow a smoothed scroll position rather than the live one.
       Tied directly to scroll, a fast flick completes a transition in two or
       three frames — you arrive at the end state having seen nothing move.
       Exponential smoothing alone doesn't fix this: given a few hundred
       milliseconds of continuous fast scrolling (an ordinary flick, not an
       artificial instant jump) it has time to almost fully catch up, so the
       transition still reads as instant. A hard speed cap on the chase does
       what smoothing can't — it bounds how fast smoothY can move in
       px/second, so covering a step's runway takes a guaranteed minimum
       wall-clock time no matter how the scroll itself arrives. Smoothing
       still shapes the final approach so it decelerates into rest rather
       than stopping on a dime. */
    var TAU = 0.32;
    var smoothY = null, lastT = 0, running = false;

    /* Steps sit end to end along the runway, so exactly one is ever in play.
       Whichever the smoothed position is inside gets pinned and painted;
       the rest are hidden.

       The pin is `fixed`, not the stylesheet's `sticky`, and that is the
       whole point. A sticky stage is only pinned while the real scroll is
       inside its own section — so a hard flick scrolls the step clean off
       the top of the screen while its transition is still at 1%, and the
       forced pace plays out on something nobody can see. Fixed takes the
       active stage out of the scroll entirely: it stays on screen until
       its transition has actually finished, however fast the page moved. */
    function paint(y) {
      var active = -1, aq = 0;
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (s.runway <= 0) continue;
        var raw = (y - s.top) / s.runway;
        if (raw >= 0 && raw < 1) { active = i; aq = raw; }
      }
      for (i = 0; i < steps.length; i++) {
        var st = steps[i], on = (i === active);
        if (st.stage) {
          st.stage.style.visibility = on ? 'visible' : 'hidden';
          st.stage.classList.toggle('is-pinned', on);
        }
        if (!on) continue;
        var q = clamp(aq, 0, 1);
        if (st.move) st.move(q, st.el);
        if (st.fade) st.fade.style.opacity = span(q,.96,1).toFixed(3);
        if (st.cap)  st.cap.style.opacity  = (span(q,.08,.22) * (1 - span(q,st.co[0],st.co[1]))).toFixed(3);
      }
    }

    var TAU = 0.16;
    var smoothY = null, lastT = 0, running = false;

    function frame(t) {
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 1 / 60;
      lastT = t;
      var target = window.scrollY;

      var diff = target - smoothY;
      var step = diff * (1 - Math.exp(-dt / TAU));
      smoothY += step;

      if (Math.abs(target - smoothY) < 0.2) { smoothY = target; running = false; }
      paint(smoothY);
      if (running) requestAnimationFrame(frame); else lastT = 0;
    }

    function render() {
      if (smoothY === null) { smoothY = window.scrollY; paint(smoothY); return; }
      if (running) return;
      running = true;
      lastT = 0;
      requestAnimationFrame(frame);
    }

    return {
      render: render,
      measure: measure,
      getWalkBounds: function() { return { top: walkTop, end: walkEnd }; },
      getSmoothY: function() { return smoothY !== null ? smoothY : window.scrollY; }
    };
  }());

  var walkEl = document.getElementById('walk');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    // The hero frame unfolds on load, in CSS — nothing to drive here.

    // Every walkthrough step owns the whole screen. Both persistent bars get
    // out of the way for the duration and come back either side of it.
    var inWalk = false;
    if (walkEl && !reduced) {
      var wr = walkEl.getBoundingClientRect();
      inWalk = wr.top < window.innerHeight * 0.5 && wr.bottom > window.innerHeight * 0.5;
    }

    if (header) {
      header.classList.toggle('is-stuck', y > 24);
      header.classList.toggle('is-away', inWalk);
    }

    if (sticky && hero) {
      // Surface the bar once the hero's own CTA has scrolled away.
      var show = y > hero.offsetHeight * 0.72 && !inWalk;
      sticky.classList.toggle('is-visible', show);
      sticky.setAttribute('aria-hidden', show ? 'false' : 'true');
    }

    walk.render();
  }

  var ticking = false;
  window.addEventListener('scroll', function () {
    var y = window.scrollY || window.pageYOffset;

    // Enforce step pacing inside #walk: clamp fast scrolling jumps so users can't overshoot to lower sections
    if (walkEl && !reduced) {
      var bounds = walk.getWalkBounds();
      if (bounds && bounds.top > 0 && bounds.end > bounds.top) {
        var curSmooth = walk.getSmoothY();
        if (curSmooth >= bounds.top - 20 && curSmooth < bounds.end - 40) {
          var maxAhead = window.innerHeight * 1.35;
          if (y > curSmooth + maxAhead) {
            window.scrollTo(0, curSmooth + maxAhead);
            y = curSmooth + maxAhead;
          } else if (y < curSmooth - maxAhead && y > bounds.top) {
            window.scrollTo(0, Math.max(bounds.top, curSmooth - maxAhead));
            y = Math.max(bounds.top, curSmooth - maxAhead);
          }
        }
      }
    }

    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      ticking = false;
    });
  }, { passive: false });

  onScroll();

  /* Keep the footer clear of the sticky bar. */
  function syncStickyHeight() {
    if (!sticky) return;
    var visible = getComputedStyle(sticky).display !== 'none';
    document.documentElement.style.setProperty(
      '--sticky-h', visible ? sticky.offsetHeight + 'px' : '0px'
    );
  }
  syncStickyHeight();
  window.addEventListener('resize', function () {
    syncStickyHeight();
    walk.measure();
    walk.render();
  }, { passive: true });

  walk.measure();
  walk.render();
  window.addEventListener('load', function () { walk.measure(); walk.render(); });

}());
