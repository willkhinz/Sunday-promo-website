/* Sunday — promo site
   Progressive enhancement only: every section is readable and the CTAs
   all work with this file absent. */

(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    var outc  = function (t) { return 1 - Math.pow(1 - t, 3); };
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
       the screen edges; the closed box is a frame around the copy. */
    function measureLocate() {
      var ret = $('#locate .reticle', root);
      if (!ret) return;
      var st = ret.parentNode, cs = getComputedStyle(st);
      var free = st.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var w1 = Math.min(st.clientWidth * .90, 360);
      loc = { w0: st.clientWidth - 26, h0: Math.max(free - 22, 240),
              w1: w1, h1: Math.min(w1 * .60, free - 60) };
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
      var ext = chatL2.getExtentOfChar(idx);

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

    var moves = {
      chat: function (q) {                          // drive through a letterform
        if (!zoom) return;
        var r = span(q, .24, 1), t = zin(r);
        // Geometric, not linear: equal scroll buys equal magnification, so
        // the approach holds one apparent speed instead of crawling for
        // most of the runway and then lunging the last few percent.
        var vw = zoom.W * Math.pow(zoom.vwEnd / zoom.W, t);
        var vh = vw * (zoom.H / zoom.W);
        // Lock onto the letter over the first half; after that it is
        // dead ahead and the move is a straight push in.
        var c = ease(clamp(r / .5, 0, 1));
        var cx = zoom.W / 2 + (zoom.cx - zoom.W / 2) * c;
        var cy = zoom.H / 2 + (zoom.cy - zoom.H / 2) * c;
        chatSvg.setAttribute('viewBox',
          (cx - vw/2).toFixed(3) + ' ' + (cy - vh/2).toFixed(3) + ' ' +
          vw.toFixed(3) + ' ' + vh.toFixed(3));
      },
      see: function (q, s) {                        // an aperture opens
        set($('.lens',s),'--slit',(50 - ease(span(q,0,.46))*50).toFixed(2)+'%');
      },
      hear: function (q, s) {                       // a ripple spreads outward
        set($('.ripple',s),'--r',(ease(span(q,0,.44))*82).toFixed(1)+'%');
        [].forEach.call(s.querySelectorAll('.ring'), function (r, i) {
          var t = span(q, i*.06, .42 + i*.06);
          set(r,'--rs',(t*3.4).toFixed(2));
          set(r,'--ro',(Math.sin(t*Math.PI)*.5).toFixed(2));
        });
      },
      watch: function (q, s) {                      // frames flick past, one settles
        var strip = $('.strip',s), w = strip.firstElementChild.offsetWidth + 14;
        var t = ease(span(q,0,.48));
        set(strip,'--sx',((1-t)*w*1.9).toFixed(1)+'px');
        set(strip,'--so',(.1 + t*.28).toFixed(2));
      },
      read: function (q, s) {                       // lines reveal down the page
        var t = ease(span(q,0,.50));
        set($('.phone',s),'--unread',((1-t)*100).toFixed(1)+'%');
        var rule = $('.rule',s);
        set(rule,'--ruleY',(t*100).toFixed(1)+'%');
        set(rule,'--ruleO',(Math.sin(clamp(t,0,1)*Math.PI)*.9).toFixed(2));
      },
      search: function (q, s) {                     // a lens sweeps, then opens out
        var t = span(q,0,.56);
        // Hold the lens small while it travels, or it covers the viewport
        // before the sweep is legible; only widen once it has crossed.
        var sweep = ease(clamp(t/.72,0,1)), open = ease(clamp((t-.72)/.28,0,1));
        var r = 104 + open * Math.max(innerWidth, innerHeight) * 1.3;
        var lx = 16 + sweep * 68;
        var el = $('.scan',s), halo = $('.halo',s);
        set(el,'--lens',r.toFixed(0)+'px');   set(el,'--lx',lx.toFixed(1)+'%');
        set(halo,'--lens',r.toFixed(0)+'px'); set(halo,'--lx',lx.toFixed(1)+'%');
        set(halo,'--haloO',((1-open)*.75).toFixed(2));
      },
      locate: function (q, s) {                     // a viewfinder closing on a fix
        if (!loc) return;
        var ret = $('.reticle',s), t = outc(span(q,0,.48));
        set(ret,'--rw',(loc.w0 + (loc.w1 - loc.w0) * t).toFixed(1)+'px');
        set(ret,'--rh',(loc.h0 + (loc.h1 - loc.h0) * t).toFixed(1)+'px');
        // The brackets are the mechanism, not the message: up quickly,
        // then out once they have closed, leaving the line they found.
        set(ret,'--ro',(Math.min(t/.14,1) * (1 - span(q,.56,.72))).toFixed(3));
        set($('.fix',s),'--fxo', ease(span(q,.30,.58)).toFixed(3));
      },
      calc: function (q, s) {                       // counts up to the answer
        // Deliberately a count rather than a digit scramble: scroll can stop
        // anywhere, and a frozen scramble reads as a wrong answer where a
        // frozen count still reads as working.
        $('#calcNum', s).textContent = String(Math.round(ease(span(q,0,.52)) * 4410));
      },
      remember: function (q, s) {                   // earlier screens recede behind
        set($('.deck',s),'--spread', ease(span(q,0,.46)).toFixed(3));
      },
      think: function (q, s) {                      // unfolds from a vertical seam
        var t = ease(span(q,0,.50));
        set($('.fold',s),'--seam',((1-t)*50).toFixed(2)+'%');
        set($('.seamline',s),'--seamO',(Math.sin(clamp(t,0,1)*Math.PI)*.9).toFixed(2));
      },
      know: function (q, s) {                       // blooms from a point of light
        var b = span(q,0,.40), f = span(q,.26,.56);
        set($('.bloom',s),'--bs',(1 + b*b*30).toFixed(2));
        set($('.bloom',s),'--bo',Math.sin(b*Math.PI).toFixed(2));
        set($('.final',s),'--fo', f.toFixed(2));
      }
    };

    /* Most steps hold their label until the screen is nearly black. Chat
       ends inside a letter that fills the frame in white, and grey type on
       white is unreadable, so its label leaves before the flare. */
    var capOut = { chat: [.70, .79] };

    var steps = [].slice.call(root.querySelectorAll('.step')).map(function (el) {
      return { el: el, stage: $('.stage', el), fade: $('[data-fade]', el),
               cap: $('[data-cap]', el), move: moves[el.id],
               co: capOut[el.id] || [.86, .96] };
    });

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

    /* Steps overlap by a viewport, so a stage is pinned for its whole
       effective length and hands straight over to the next. Progress is
       therefore just position through that pinned run. */
    function paint(y) {
      var vh = window.innerHeight, sy = window.scrollY;
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i], r = s.el.getBoundingClientRect();
        if (r.bottom < -vh || r.top > vh * 2) continue;   // nowhere near the viewport
        var runway = r.height - vh;
        if (runway <= 0) continue;
        // Off the smoothed position, not the live rect.
        var raw = (y - (r.top + sy)) / runway;
        // Overlapping the steps means the next stage is already sliding up
        // behind the current one; show a stage only across its own run or it
        // bleeds into its neighbour.
        var live = raw > -0.002 && raw < 1.002;
        if (s.stage) s.stage.style.visibility = live ? 'visible' : 'hidden';
        if (!live) continue;
        var q = clamp(raw, 0, 1);
        if (s.move) s.move(q, s.el);
        // Black is now only the last sliver, where one step has finished
        // and the next has already taken over the screen.
        if (s.fade) s.fade.style.opacity = span(q,.96,1).toFixed(3);
        if (s.cap)  s.cap.style.opacity  = (span(q,.08,.22) * (1 - span(q,s.co[0],s.co[1]))).toFixed(3);
      }
    }

    function frame(t) {
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 1 / 60;
      lastT = t;
      var target = window.scrollY;
      var diff = target - smoothY;
      var step = diff * (1 - Math.exp(-dt / TAU));
      // A step's runway is ~1.5 viewport heights; this rate lets the chase
      // cross the whole thing in ~2.4s, so no single hand-off inside it —
      // each spans a fraction of the runway — can finish in under a second,
      // however abruptly the actual scroll position moves.
      var cap = window.innerHeight * 0.62 * dt;
      if (step > cap) step = cap; else if (step < -cap) step = -cap;
      smoothY += step;
      if (Math.abs(target - smoothY) < 0.4) { smoothY = target; running = false; }
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

    return { render: render, measure: measure };
  }());

  var walkEl = document.getElementById('walk');

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;

    if (hero && !reduced) {
      // Swing the hero frame open over the first stretch of scroll.
      var u = Math.min(y / Math.max(hero.offsetHeight * 0.35, 1), 1);
      hero.style.setProperty('--unfold', (u * u * (3 - 2 * u)).toFixed(3));
    }

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
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      onScroll();
      ticking = false;
    });
  }, { passive: true });

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

  /* ── carousel dots ─────────────────────────────────────── */

  var carousel = document.getElementById('carousel');
  var dotsWrap = document.getElementById('dots');
  var slides = carousel ? Array.prototype.slice.call(carousel.querySelectorAll('.slide')) : [];

  if (carousel && dotsWrap && slides.length > 1) {
    slides.forEach(function (slide, i) {
      var dot = document.createElement('button');
      dot.type = 'button';
      dot.className = 'dot' + (i === 0 ? ' is-active' : '');
      dot.setAttribute('aria-label', 'Go to screenshot ' + (i + 1) + ' of ' + slides.length);
      dot.addEventListener('click', function () {
        carousel.scrollTo({
          left: slide.offsetLeft - (carousel.clientWidth - slide.clientWidth) / 2,
          behavior: reduced ? 'auto' : 'smooth'
        });
      });
      dotsWrap.appendChild(dot);
    });

    dotsWrap.removeAttribute('aria-hidden');
    var dots = Array.prototype.slice.call(dotsWrap.children);

    if ('IntersectionObserver' in window) {
      // Track whichever slide is nearest the centre of the viewport.
      var slideObserver = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var idx = slides.indexOf(entry.target);
          if (idx < 0) return;
          dots.forEach(function (d, i) { d.classList.toggle('is-active', i === idx); });
        });
      }, { root: carousel, threshold: 0.6 });

      slides.forEach(function (s) { slideObserver.observe(s); });
    }

    // Arrow keys when the carousel itself has focus.
    carousel.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      var step = slides[0].getBoundingClientRect().width + 18;
      carousel.scrollBy({
        left: e.key === 'ArrowRight' ? step : -step,
        behavior: reduced ? 'auto' : 'smooth'
      });
    });
  }
}());
