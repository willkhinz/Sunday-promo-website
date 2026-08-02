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

  function onScroll() {
    var y = window.scrollY || window.pageYOffset;
    if (header) header.classList.toggle('is-stuck', y > 24);

    if (sticky && hero) {
      // Surface the bar once the hero's own CTA has scrolled away.
      var past = y > hero.offsetHeight * 0.72;
      sticky.classList.toggle('is-visible', past);
      sticky.setAttribute('aria-hidden', past ? 'false' : 'true');
    }
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
  window.addEventListener('resize', syncStickyHeight, { passive: true });

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
