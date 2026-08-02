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

    var chatLine = $('#chatLine', root), chatO = $('#chatO', root), oRing = $('#oRing', root);
    var drift = { x: 0, y: 0 }, oW = 0;

    // Where the glyph hands over to the ring. Text is only scaled this far
    // because past a few multiples it is a stretched bitmap, not type.
    var TEXT_MAX = 5;

    function measure() {
      if (!chatLine || !chatO) return;
      set(chatLine, '--zoom', '1'); set(chatLine, '--tx', '0px'); set(chatLine, '--ty', '0px');
      var lr = chatLine.getBoundingClientRect(), or_ = chatO.getBoundingClientRect();
      set(chatLine, '--ox', ((or_.left + or_.width/2 - lr.left) / lr.width * 100).toFixed(2) + '%');
      set(chatLine, '--oy', ((or_.top + or_.height*0.52 - lr.top) / lr.height * 100).toFixed(2) + '%');
      // Scaling about the letter pins it where it sits, so the zoom would
      // head into a corner. Measure its offset from the stage centre.
      var st = chatLine.closest('.stage').getBoundingClientRect();
      drift.x = (st.left + st.width/2) - (or_.left + or_.width/2);
      drift.y = (st.top + st.height/2) - (or_.top + or_.height*0.52);
      oW = or_.width;
    }

    var moves = {
      chat: function (q) {                          // drive through a letterform
        // Held readable through the arrival, then driven into the letter.
        var z = ease(span(q,.30,.80)), c = ease(span(q,.30,.52));
        set(chatLine,'--zoom', (1 + z * (TEXT_MAX - 1)).toFixed(3));
        set(chatLine,'--tx',(drift.x*c).toFixed(1)+'px');
        set(chatLine,'--ty',(drift.y*c).toFixed(1)+'px');
        chatLine.style.opacity = (1 - span(q,.62,.76)).toFixed(3);

        // The ring picks the "o" up where the glyph leaves off and keeps
        // going on geometry rather than transform, so its edge stays sharp
        // right up to the moment it clears the screen.
        var rt = span(q,.60,1);
        if (rt <= 0) { oRing.style.opacity = '0'; return; }
        var diag = Math.hypot(innerWidth, innerHeight);
        var d0 = oW * TEXT_MAX * 0.88;
        var d = d0 * Math.pow((diag * 1.6) / d0, ease(rt));
        oRing.style.width = d.toFixed(1) + 'px';
        oRing.style.height = d.toFixed(1) + 'px';
        oRing.style.borderWidth = (d * 0.185).toFixed(1) + 'px';
        oRing.style.opacity = span(q,.60,.68).toFixed(3);
      },
      see: function (q, s) {                        // an aperture opens
        set($('.lens',s),'--slit',(50 - ease(span(q,.03,.46))*50).toFixed(2)+'%');
      },
      hear: function (q, s) {                       // a ripple spreads outward
        set($('.ripple',s),'--r',(ease(span(q,.03,.44))*82).toFixed(1)+'%');
        [].forEach.call(s.querySelectorAll('.ring'), function (r, i) {
          var t = span(q, .03 + i*.06, .42 + i*.06);
          set(r,'--rs',(t*3.4).toFixed(2));
          set(r,'--ro',(Math.sin(t*Math.PI)*.5).toFixed(2));
        });
      },
      watch: function (q, s) {                      // frames flick past, one settles
        var strip = $('.strip',s), w = strip.firstElementChild.offsetWidth + 14;
        var t = ease(span(q,.03,.48));
        set(strip,'--sx',((1-t)*w*1.9).toFixed(1)+'px');
        set(strip,'--so',(.1 + t*.28).toFixed(2));
      },
      read: function (q, s) {                       // lines reveal down the page
        var t = ease(span(q,.04,.50));
        set($('.phone',s),'--unread',((1-t)*100).toFixed(1)+'%');
        var rule = $('.rule',s);
        set(rule,'--ruleY',(t*100).toFixed(1)+'%');
        set(rule,'--ruleO',(Math.sin(clamp(t,0,1)*Math.PI)*.9).toFixed(2));
      },
      search: function (q, s) {                     // a lens sweeps, then opens out
        var t = span(q,.03,.56);
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
      locate: function (q, s) {                     // drops in and settles on a pin
        var t = outc(span(q,.03,.44));
        set($('.drop',s),'--dy',((1-t)*-55).toFixed(1)+'vh');
        var k = span(q,.34,.50), qq = span(q,.36,.64);
        var pin = $('.pin',s), pulse = $('.pulse',s);
        set(pin,'--ps',k.toFixed(2)); set(pin,'--po',(k*.9).toFixed(2));
        set(pulse,'--pulse',(qq*2.6).toFixed(2));
        set(pulse,'--pulseO',(Math.sin(qq*Math.PI)*.6).toFixed(2));
      },
      calc: function (q, s) {                       // counts up to the answer
        // Deliberately a count rather than a digit scramble: scroll can stop
        // anywhere, and a frozen scramble reads as a wrong answer where a
        // frozen count still reads as working.
        $('#calcNum', s).textContent = String(Math.round(ease(span(q,.04,.52)) * 4410));
      },
      remember: function (q, s) {                   // earlier screens recede behind
        set($('.deck',s),'--spread', ease(span(q,.04,.46)).toFixed(3));
      },
      think: function (q, s) {                      // unfolds from a vertical seam
        var t = ease(span(q,.04,.50));
        set($('.fold',s),'--seam',((1-t)*50).toFixed(2)+'%');
        set($('.seamline',s),'--seamO',(Math.sin(clamp(t,0,1)*Math.PI)*.9).toFixed(2));
      },
      know: function (q, s) {                       // blooms from a point of light
        var b = span(q,.03,.40), f = span(q,.26,.56);
        set($('.bloom',s),'--bs',(1 + b*b*30).toFixed(2));
        set($('.bloom',s),'--bo',Math.sin(b*Math.PI).toFixed(2));
        set($('.final',s),'--fo', f.toFixed(2));
      }
    };

    var steps = [].slice.call(root.querySelectorAll('.step')).map(function (el) {
      return { el: el, stage: $('.stage', el), fade: $('[data-fade]', el),
               cap: $('[data-cap]', el), move: moves[el.id] };
    });

    /* Animations follow a smoothed scroll position rather than the live one.
       Tied directly to scroll, a fast flick completes a transition in two or
       three frames — you arrive at the end state having seen nothing move.
       Chasing a lagged value instead gives every transition a floor on how
       long it can take, however hard you throw the page. */
    var TAU = 0.45;                 // ~1s to substantially settle
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
        if (s.fade) s.fade.style.opacity = span(q,.94,1).toFixed(3);
        if (s.cap)  s.cap.style.opacity  = (span(q,.08,.22) * (1 - span(q,.86,.96))).toFixed(3);
      }
    }

    function frame(t) {
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 1 / 60;
      lastT = t;
      var target = window.scrollY;
      smoothY += (target - smoothY) * (1 - Math.exp(-dt / TAU));
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

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-stuck', y > 24);

    if (hero && !reduced) {
      // Swing the hero frame open over the first stretch of scroll.
      var u = Math.min(y / Math.max(hero.offsetHeight * 0.35, 1), 1);
      hero.style.setProperty('--unfold', (u * u * (3 - 2 * u)).toFixed(3));
    }

    if (sticky && hero) {
      // Surface the bar once the hero's own CTA has scrolled away — but not
      // over the walkthrough, where it sits on top of every step.
      var walkEl = document.getElementById('walk');
      var inWalk = false;
      if (walkEl) {
        var wr = walkEl.getBoundingClientRect();
        inWalk = wr.top < window.innerHeight * 0.5 && wr.bottom > window.innerHeight * 0.5;
      }
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
