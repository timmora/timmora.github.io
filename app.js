// Reload + Lenis: browser scroll restoration can leave the page partway down; manual avoids that.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Smooth scroll
var lenis = new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 1 });

(function alignLenisWithScrollStart() {
  // If the URL has a hash (e.g. landing on index.html#portfolio from a case
  // study), instantly position at that section so Lenis doesn't fight the
  // browser's default hash jump. Otherwise, snap to top.
  if (window.location.hash) {
    var target = document.querySelector(window.location.hash);
    if (target && typeof lenis.scrollTo === 'function') {
      function jumpToHash() { lenis.scrollTo(target, { immediate: true }); }
      jumpToHash();
      requestAnimationFrame(jumpToHash);
    }
    return;
  }
  function snap() {
    window.scrollTo(0, 0);
    if (typeof lenis.scrollTo === 'function') {
      lenis.scrollTo(0, { immediate: true });
    }
  }
  snap();
  requestAnimationFrame(snap);
})();

// When a folder is open, Lenis stops so the folder overlay can scroll natively
(function syncLenisWhenFolderOpen() {
  if (typeof lenis === 'undefined' || !lenis.stop) return;
  function sync() {
    if (document.body.classList.contains('portfolio-folder-open')) {
      lenis.stop();
    } else {
      lenis.start();
    }
  }
  sync();
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

// Reveal spacer (index & about pages)
var reveal = document.querySelector('.section-reveal');
var spacer = document.getElementById('reveal-spacer');
if (reveal && spacer) {
  function updateSpacer() {
    spacer.style.height = reveal.offsetHeight + 'px';
  }
  updateSpacer();
  window.addEventListener('resize', updateSpacer);
}

// Animate portfolio items individually as each enters the viewport
(function() {
  var portfolio = document.getElementById('portfolio');
  if (!portfolio) return;
  var items = [portfolio.querySelector('.portfolio-header')]
    .concat(Array.from(portfolio.querySelectorAll('.folder-stack .folder')))
    .filter(Boolean);
  items.forEach(function(el) { el.classList.add('scroll-hidden'); });
  function check() {
    var remaining = false;
    items.forEach(function(el) {
      if (el.classList.contains('has-revealed') || el.classList.contains('is-visible')) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 0.88) {
        el.classList.add('is-visible');
        el.addEventListener('animationend', function() {
          el.classList.add('has-revealed');
          el.classList.remove('scroll-hidden', 'is-visible');
        }, { once: true });
      } else {
        remaining = true;
      }
    });
    if (!remaining) lenis.off('scroll', check);
  }
  lenis.on('scroll', check);
})();

// Smooth scroll anchor links via Lenis
document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
  anchor.addEventListener('click', function(e) {
    var target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      lenis.scrollTo(target);
    }
  });
});

// Header scroll state (e.g. shadow)
(function() {
  var header = document.querySelector('header');
  window.addEventListener('scroll', function() {
    header.classList.toggle('scrolled', window.scrollY > 0);
  });
})();

// Generic .reveal scroll-in animation.
// Elements inside .section-reveal (about page's fixed panel) are always in
// viewport, so they're animated when #reveal-spacer enters view instead.
(function() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.reveal').forEach(function(el) { el.classList.add('in'); });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting) return;
      if (e.target.id === 'reveal-spacer') {
        var panel = document.querySelector('.section-reveal');
        if (panel) {
          panel.querySelectorAll('.reveal').forEach(function(el) { el.classList.add('in'); });
        }
      } else {
        e.target.classList.add('in');
      }
      observer.unobserve(e.target);
    });
  }, { threshold: 0.07 });

  document.querySelectorAll('.reveal').forEach(function(el) {
    if (el.closest('.section-reveal')) return;
    observer.observe(el);
  });

  var spacer = document.getElementById('reveal-spacer');
  if (spacer && document.querySelector('.section-reveal .reveal')) {
    observer.observe(spacer);
  }
})();

// Randomize highlight angles
function randomHighlightAngle(selector, onHover) {
  document.querySelectorAll(selector).forEach(function(el) {
    function setAngle() {
      el.style.setProperty('--highlight-angle', (Math.random() * 6 - 3).toFixed(1) + 'deg');
    }
    if (onHover) el.addEventListener('mouseenter', setAngle);
    else setAngle();
  });
}
