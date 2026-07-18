/* Protein Note LP — scroll engine (no dependencies)
   Writes progress (--p: 0..1) to [data-scene] elements; all motion lives in CSS.
   Progress modes:
     default    : 0 when the scene's top enters the viewport bottom → 1 when its bottom leaves the top
     data-pin   : 0..1 across the pinned wrapper's extra height
     data-exit  : 0 while fully in view at top → 1 once scrolled fully past (hero)
     data-enter : 0 when the top touches the viewport bottom → 1 when it reaches the top (final CTA) */
(function () {
  // Without IntersectionObserver the enhanced mode can't run; stay on the static no-JS page.
  if (!('IntersectionObserver' in window)) return;

  var root = document.documentElement;
  root.classList.add('js');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) root.classList.add('reduced');

  function clamp01(v) {
    return v < 0 ? 0 : v > 1 ? 1 : v;
  }

  /* Gallery dots (functional navigation — runs in reduced-motion mode too) */
  var track = document.getElementById('screenshotsTrack');
  var dotsContainer = document.getElementById('screenshotsDots');
  if (track && dotsContainer) {
    var images = track.querySelectorAll('img');
    var dots = [];
    images.forEach(function (img, i) {
      var dot = document.createElement('button');
      dot.setAttribute('aria-label', 'スクリーンショット ' + (i + 1));
      if (i === 0) dot.classList.add('active');
      dot.addEventListener('click', function () {
        img.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'center', block: 'nearest' });
      });
      dotsContainer.appendChild(dot);
      dots.push(dot);
    });
    var trackObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var idx = Array.prototype.indexOf.call(images, entry.target);
            dots.forEach(function (d, j) {
              d.classList.toggle('active', j === idx);
            });
          }
        });
      },
      { root: track, threshold: 0.6 }
    );
    images.forEach(function (img) {
      trackObserver.observe(img);
    });
  }

  if (reduced) return; // static page: no scrub engine, reveals, count-up, or floating CTA

  /* Scrub engine */
  var scenes = [];
  document.querySelectorAll('[data-scene]').forEach(function (el) {
    scenes.push({ el: el, last: '' });
  });
  var floatCta = document.getElementById('floatCta');
  var vh = window.innerHeight;
  var ticking = false;

  function update() {
    ticking = false;
    var y = window.scrollY;
    var maxScroll = root.scrollHeight - vh;
    var finalTop = Infinity;

    // read phase: all rects first, no style writes in between
    var values = [];
    scenes.forEach(function (scene) {
      var el = scene.el;
      var r = el.getBoundingClientRect();
      var p;
      if (el.hasAttribute('data-pin')) {
        var travel = r.height - vh;
        p = travel > 0 ? clamp01(-r.top / travel) : 0;
      } else if (el.hasAttribute('data-exit')) {
        p = clamp01(-r.top / r.height);
      } else if (el.hasAttribute('data-enter')) {
        p = clamp01((vh - r.top) / vh);
      } else {
        p = clamp01((vh - r.top) / (vh + r.height));
      }
      if (el.hasAttribute('data-enter')) finalTop = r.top;
      values.push(p.toFixed(4));
    });

    // write phase
    scenes.forEach(function (scene, i) {
      if (values[i] !== scene.last) {
        scene.last = values[i];
        scene.el.style.setProperty('--p', values[i]);
      }
    });
    root.style.setProperty('--sp', maxScroll > 0 ? clamp01(y / maxScroll).toFixed(4) : '0');

    if (floatCta) {
      floatCta.classList.toggle('show', y > vh * 0.8 && finalTop > vh * 0.9);
    }
  }

  function requestUpdate() {
    if (!ticking) {
      ticking = true;
      window.requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener(
    'resize',
    function () {
      vh = window.innerHeight;
      requestUpdate();
    },
    { passive: true }
  );

  /* Reveal-on-enter (also drives the voice-bubble stagger via .voice-demo.in-view) */
  var revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
  );
  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    revealObserver.observe(el);
  });

  /* Stat count-up */
  var counters = document.querySelectorAll('[data-count]');
  if (counters.length) {
    var countObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          countObserver.unobserve(el);
          var target = parseInt(el.getAttribute('data-count'), 10);
          var suffix = el.getAttribute('data-suffix') || '';
          var start = null;
          var DURATION = 1000;
          function step(ts) {
            if (start === null) start = ts;
            var t = Math.min((ts - start) / DURATION, 1);
            var eased = 1 - Math.pow(1 - t, 3);
            el.textContent = Math.round(target * eased) + suffix;
            if (t < 1) window.requestAnimationFrame(step);
          }
          window.requestAnimationFrame(step);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach(function (el) {
      countObserver.observe(el);
    });
  }

  update();
})();
