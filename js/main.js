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
  var CLIPS = {};

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

    /* Remember's column: one screen, 150 deep, run past you over the step.
       Not a wrap — the whole column goes by exactly once and the last copy
       clears the frame as the step ends, which is what hands over to the
       next one.

       The copies travel an arc, not a straight line with a corner in it.
       Y is the per-copy lift far up the column, where the run is straight
       and the projection — dividing the offset by the depth — converges it
       on a vanishing point. ARC is how far a copy has swung down by the
       time it reaches you, applied as a square that starts ARC0 copies out,
       so the bend eases in rather than switching on. Done as two rates
       either side of the camera instead, the path has a corner exactly
       where you are looking: the copy comes straight at you and then drops,
       which is the one thing it should not look like.

       OUT is how many copies' worth of travel clears the frame. It also
       bounds the swell — past it a copy is culled, well before the
       projection blows up at the perspective distance.

       N is how many copies go by, and so how long the step lasts; POOL is
       how many elements exist. Only ~50 are ever on screen, so the elements
       are recycled and N is free to be a number you would never put in the
       DOM. DIR is the one place the direction lives: +1 views the column
       from the top, so it runs away upward and the copies come at you and
       leave by the bottom; -1 is that seen from underneath. It pairs with
       `perspective-origin` in the stylesheet — one decision, two files. */
    var TUNNEL_N = 500, TUNNEL_POOL = 64, TUNNEL_Z = 60, TUNNEL_DIR = 1,
        TUNNEL_Y = 1.9, TUNNEL_ARC = 26, TUNNEL_ARC0 = 10,
        TUNNEL_FOG = 2600, TUNNEL_OUT = 8,
        /* Depth of field. SHARP copies stay in focus and everything behind
           them softens with distance, capped — a blur is rasterised at the
           card's layout size however small it ends up on screen, so the
           radius is the cost and it has to stay bounded. */
        TUNNEL_SHARP = 2, TUNNEL_BLUR = 0.55, TUNNEL_BLUR_MAX = 7;

    (function buildTunnel() {
      var deck = $('#remember .deck', root);
      var card = deck && $('.phone', deck);
      if (!card) return;
      for (var i = deck.querySelectorAll('.phone').length; i < TUNNEL_POOL; i++) {
        var clone = card.cloneNode(true);
        clone.querySelector('img').setAttribute('alt', '');   // one of a repeat
        deck.insertBefore(clone, card);
      }
    }());

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
      watch: function (q, s) {                      // a projector advancing frames
        var strip = $('.strip',s), cards = strip.children;
        var hero = $('.is-hero',strip);
        if (!hero || cards.length < 3) return;

        // Measured, not assumed: the card width is a min() of two units and
        // the gap is a stylesheet value, so both move with the viewport.
        var pitch = cards[1].offsetLeft - cards[0].offsetLeft;
        if (pitch <= 0) return;
        var heroIdx = [].indexOf.call(cards, hero);
        var first = 2;                              // frame under the playhead at rest
        var notches = heroIdx - first;

        /* The ratchet. Sampling the curve per notch rather than easing the
           whole travel is the difference between eight frames advancing and
           one long slide.

           How much of each notch the pull-down gets is the whole feel of
           this step, and it is a balance rather than a maximum. At the 42%
           it started on, a card-width was thrown in a twelfth of a second
           and the step read as eight flinches. Taken all the way to 80% the
           jolt goes, but so does the hold, and with it the projector — what
           is left is a wobbling pan. At 62% better than a third of every
           notch is still a frame sitting still under the playhead.

           Cosine rather than the shared cubic ease deliberately: it leaves
           and arrives at zero velocity, so a notch settles into its hold
           instead of stopping dead against it. */
        var f = span(q,0,W) * notches;
        var idx = Math.min(Math.floor(f), notches - 1);
        var snap = .5 - .5 * Math.cos(Math.PI * clamp((f - idx) / .62, 0, 1));
        var adv = idx + snap;

        // Where the strip has to sit for the frame `first + adv` to be centred.
        var restX = strip.offsetWidth / 2 - (hero.offsetLeft + hero.offsetWidth / 2);
        set(strip,'--sx',(restX + (notches - adv) * pitch).toFixed(1)+'px');

        /* Each frame is read as it passes: brightest under the playhead.
           Gently, though — falling off this steeply the neighbours swung
           through half their brightness on every notch, so the whole strip
           flashed in time with the advance and doubled the jolt it was
           meant to decorate. */
        var at = first + adv;
        for (var i = 0; i < cards.length; i++) {
          var near = clamp(1 - Math.abs(at - i) * .3, 0, 1);
          set(cards[i],'--co',(.14 + near * .86).toFixed(3));
          set(cards[i],'--cs',(.9 + near * .1).toFixed(3));
        }

        // Up while frames are running, gone once one has locked.
        set(s.querySelector('.playhead'),'--phO',
            (span(q,.03,.13) * (1 - span(q,.84,.96))).toFixed(3));
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
        set(halo,'--lens',r.toFixed(0)+'px');
        /* Placed off the line's own box, which is the box the mask measures
           its centre from, so the ring is concentric with the hole by
           construction. In percentages the two resolve against different
           boxes — .scan is a shrink-to-fit grid item, the halo's containing
           block is the whole stage — and the ring misses by over a hundred
           pixels. Layout offsets, not client rects: the stage carries a
           transform and these have to stay in its untransformed space. */
        halo.style.left = (el.offsetLeft + el.offsetWidth * lx / 100).toFixed(1) + 'px';
        halo.style.top  = (el.offsetTop + el.offsetHeight / 2).toFixed(1) + 'px';
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
      remember: function (q, s) {                   // travelling down an endless column
        var deck = $('.deck',s);
        var cards = deck.querySelectorAll('.phone');
        var n = cards.length;
        if (!n) return;

        var exit = TUNNEL_OUT * TUNNEL_Z;

        /* Linear, not eased: this is a scroll, not a reveal, and it should
           track the finger the whole way. It finishes a little before the
           act does so the frame is clear by the time the next step starts
           coming up out of the dark. */
        var travel = span(q, 0, .94) * (TUNNEL_N + TUNNEL_OUT) * TUNNEL_Z;

        var head = travel / TUNNEL_Z;               // copy at the camera now
        var lo = head - TUNNEL_OUT;                 // below this: already gone
        var hi = head + TUNNEL_FOG / TUNNEL_Z;      // beyond this: still dark

        for (var j = 0; j < n; j++) {
          /* Each element stands in for whichever copy of its own residue
             class currently falls inside the window. The window is smaller
             than the pool, so there is never more than one candidate, and
             sixty-four elements can carry five hundred copies past you. */
          var i = j + n * Math.ceil((lo - j) / n);
          var el = cards[j];
          if (i < 0 || i >= TUNNEL_N || i > hi) { el.style.visibility = 'hidden'; continue; }

          var u = i - head;                   // distance in copies, 0 = camera
          var d = u * TUNNEL_Z;

          /* Straight run up the column, plus an arc that eases in over the
             last ARC0 copies and keeps bending all the way out of frame.
             Squared, so its slope is zero where it starts and there is no
             seam between the straight part and the curve. */
          var bend = Math.max(0, TUNNEL_ARC0 - u);
          var ty = TUNNEL_DIR * (-TUNNEL_Y * u +
                   TUNNEL_ARC * bend * bend / (TUNNEL_ARC0 * TUNNEL_ARC0));

          // Out of the dark at the far end; on the way out it simply leaves
          // by the edge of the frame, fading only at the very last so that
          // dropping it from painting is never something you can catch.
          var op = d >= 0 ? 1 - clamp(d / TUNNEL_FOG, 0, 1)
                          : 1 - span(-d, exit * .8, exit);

          set(el,'--ty',ty.toFixed(2)+'%');
          set(el,'--tz',(-d).toFixed(1)+'px');
          set(el,'--op',op.toFixed(3));
          // Nearer paints over further. Explicit, because the deck is not a
          // preserve-3d context, so depth is not painting order.
          el.style.zIndex = String(Math.round(10000 - d));
          el.style.visibility = op > 0.004 ? 'visible' : 'hidden';

          // Cleared rather than set to blur(0) when it is in focus: a zero
          // filter still promotes the card and rasterises it apart.
          var soft = u <= TUNNEL_SHARP ? 0
                   : Math.min((u - TUNNEL_SHARP) * TUNNEL_BLUR, TUNNEL_BLUR_MAX);
          el.style.filter = soft ? 'blur(' + soft.toFixed(2) + 'px)' : '';
        }
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
      return { el: el, stage: $('.stage', el),
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
       what smoothing can't — it bounds how fast the progress through a step
       can move, so covering a runway takes a guaranteed minimum wall-clock
       time no matter how the scroll itself arrives. Smoothing still shapes
       the final approach so it decelerates into rest rather than stopping
       on a dime. */
    var TAU = 0.24;

    /* The cap is progress-per-second, not pixels-per-second. The runways
       are not the same length — Know is longer than the other ten, and all
       eleven are more than twice as long again on mobile — so a pixel cap
       would hand each of them a different minimum duration. At .85 every
       step takes at least ~1.2s however hard the page was thrown. */
    var MAX_Q_RATE = 0.85;

    /* The pin is fixed, so a stage that outlives the scroll which left it
       sits over whatever the reader actually scrolled to. A keyboard End,
       an anchor jump or a dragged scrollbar can move the page further in
       one frame than any transition should be asked to play out, so the
       chase is never allowed to fall further behind than this. */
    var MAX_LAG_VH = 3.5;

    var smoothY = null, lastT = 0, running = false;
    var activeRunway = 0;         // runway of the step in play, for the cap

    /* The eleven steps are eleven places in one space rather than eleven
       slides. Scrolling flies the camera from each to the next: the step
       you are leaving carries on past you, the one you are going to comes
       up out of the dark ahead, and the pair are on screen together for
       the whole trip. There is no cut between them, so there is nothing
       to cover — the black is the page showing through, not a plate.

       The trip costs the front of every runway. What is left plays the
       step's own move, remapped to 0..1, so every timing window in `moves`
       is unaffected by the approach existing. */
    var APPROACH = 0.28;

    /* Far enough back to be a place you travel to rather than something
       that scales up in situ; near enough past that leaving reads as going
       by it, not through it. Both stay well inside the perspective
       distance, where the projection blows up. */
    var Z_FAR = -1000, Z_NEAR = 620;

    /* A step opens from a closed frame — a shut aperture, a zero-radius
       ripple — and a closed frame is nothing at all. Held until arrival,
       the thing you are flying towards would be invisible the whole way,
       so the act starts a little before you land and is already coming
       open as it reaches you. */
    var ACT0 = APPROACH * 0.5;

    function place(st, z, op) {
      st.stage.style.transform = 'perspective(1500px) translateZ(' + z.toFixed(1) + 'px)';
      st.stage.style.opacity = op.toFixed(3);
      st.stage.style.zIndex = z > 0 ? 30 : 20;   // whatever is nearer occludes
    }

    /* The pin is `fixed`, not the stylesheet's `sticky`, and that is the
       whole point. A sticky stage is only pinned while the real scroll is
       inside its own section — so a hard flick scrolls the step clean off
       the top of the screen while its transition is still at 1%, and the
       forced pace plays out on something nobody can see. Fixed takes the
       stages out of the scroll entirely: they stay on screen until the
       transition has actually finished, however fast the page moved. */
    function paint(y) {
      var active = -1, aq = 0;
      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (s.runway <= 0) continue;
        var raw = (y - s.top) / s.runway;
        if (raw >= 0 && raw < 1) { active = i; aq = raw; }
      }
      activeRunway = active >= 0 ? steps[active].runway : 0;

      var appr = active < 0 ? 1 : span(aq, 0, APPROACH);
      var behind = appr < 1 ? active - 1 : -1;

      for (i = 0; i < steps.length; i++) {
        var st = steps[i];
        if (!st.stage) continue;
        var on = (i === active), back = (i === behind);

        st.stage.style.visibility = (on || back) ? 'visible' : 'hidden';
        st.stage.classList.toggle('is-pinned', on || back);
        if (!on && !back) continue;

        if (back) {
          /* Finished, and continuing past the camera at that finished state.
             It clears out early and quickly: held at half opacity across the
             middle of the trip it is the nearer and larger of the two, and
             every one of these frames is a dense screenshot, so the pair
             read as one muddy overlay rather than as two things at
             different distances. */
          place(st, ease(appr) * Z_NEAR, 1 - span(appr, 0, .45));
          if (st.move) st.move(1, st.el);
          if (st.cap) st.cap.style.opacity = '0';
          continue;
        }

        // Up to full while still well back, so distance is carried by scale
        // rather than by dimming — and so the label is readable in flight.
        place(st, Z_FAR * (1 - ease(appr)), span(appr, .12, .58));
        var q = clamp(span(aq, ACT0, 1), 0, 1);
        if (st.move) st.move(q, st.el);
        /* The label comes up on the approach, not on the act. A step's
           visual is still shut for most of the trip to it, so hung off the
           act there is a stretch mid-flight with the last step faded and
           the next not yet open — you travel towards nothing. The name
           arrives first and is the thing you are heading for. */
        if (st.cap)  st.cap.style.opacity  = (span(appr,.2,.8) * (1 - span(q,st.co[0],st.co[1]))).toFixed(3);
      }
    }

    function frame(t) {
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 1 / 60;
      lastT = t;
      var target = window.scrollY;

      var maxLag = window.innerHeight * MAX_LAG_VH;
      if (target - smoothY > maxLag) smoothY = target - maxLag;
      else if (smoothY - target > maxLag) smoothY = target + maxLag;

      var diff = target - smoothY;
      var step = diff * (1 - Math.exp(-dt / TAU));

      /* Only while a step is actually in play: outside the walkthrough
         nothing reads this position, so a cap there would buy nothing and
         cost the scroll its responsiveness on the way back in. */
      if (activeRunway > 0) {
        var cap = activeRunway * MAX_Q_RATE * dt;
        if (step > cap) step = cap;
        else if (step < -cap) step = -cap;
      }

      smoothY += step;

      if (Math.abs(target - smoothY) < 0.2) { smoothY = target; running = false; }

      /* One bad frame must not wedge the walkthrough. `running` is what
         stops render() from starting a second loop, so a throw between
         here and the next rAF leaves it stuck true and nothing ever
         schedules another frame again — the whole section freezes, silently
         and permanently, for the rest of the page's life. Clear it before
         the error goes on its way, so the next scroll can pick things up. */
      try {
        paint(smoothY);
      } catch (e) {
        running = false; lastT = 0;
        throw e;
      }
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

}());
