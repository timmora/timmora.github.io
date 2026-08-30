// Reload + Lenis: browser scroll restoration can leave the page partway down; manual avoids that.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Lenis is tuned for the wheel (lerp + wheelMultiplier) and on touch it fights
// native momentum and the collapsing address bar. Run it only for fine pointers
// and let phones/tablets scroll natively.
var lenis = window.matchMedia('(pointer: fine)').matches
  ? new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 1 })
  : null;

// Shim over Lenis so the call sites below stay identical whether or not smooth
// scrolling is running. Native equivalents where Lenis is absent.
var scroller = (function() {
  function targetTop(target) {
    if (typeof target === 'number') return target;
    return target.getBoundingClientRect().top + window.pageYOffset;
  }
  // Native smooth scrolling has no completion event, so watch for the position
  // to hold steady for a few frames. Capped so the callback always fires.
  function whenSettled(cb) {
    var last = null, still = 0, frames = 0, fired = false;
    function fire() { if (!fired) { fired = true; cb(); } }
    // rAF is throttled in background tabs, so a timer backs it up: the
    // callback has to run even if the user switches away mid-scroll.
    setTimeout(fire, 1500);
    (function tick() {
      if (fired) return;
      var y = window.pageYOffset;
      still = (y === last) ? still + 1 : 0;
      last = y;
      if (still >= 3 || ++frames > 180) { fire(); return; }
      requestAnimationFrame(tick);
    })();
  }
  return {
    scrollTo: function(target, opts) {
      opts = opts || {};
      if (lenis) { lenis.scrollTo(target, opts); return; }
      window.scrollTo({
        top: targetTop(target),
        behavior: opts.immediate ? 'auto' : 'smooth'
      });
      if (typeof opts.onComplete === 'function') {
        opts.immediate ? opts.onComplete() : whenSettled(opts.onComplete);
      }
    },
    on: function(ev, fn) {
      lenis ? lenis.on(ev, fn) : window.addEventListener(ev, fn, { passive: true });
    },
    off: function(ev, fn) {
      lenis ? lenis.off(ev, fn) : window.removeEventListener(ev, fn);
    },
    stop: function() { if (lenis) lenis.stop(); },
    start: function() { if (lenis) lenis.start(); }
  };
})();

(function alignLenisWithScrollStart() {
  // If the URL has a hash (e.g. landing on index.html#portfolio from a case
  // study), instantly position at that section so Lenis doesn't fight the
  // browser's default hash jump. Otherwise, snap to top.
  if (window.location.hash) {
    var target = document.querySelector(window.location.hash);
    if (target) {
      function jumpToHash() { scroller.scrollTo(target, { immediate: true }); }
      jumpToHash();
      requestAnimationFrame(jumpToHash);
    }
    return;
  }
  function snap() {
    window.scrollTo(0, 0);
    scroller.scrollTo(0, { immediate: true });
  }
  snap();
  requestAnimationFrame(snap);
})();

// When a folder is open, Lenis stops so the folder overlay can scroll natively
(function syncLenisWhenFolderOpen() {
  function sync() {
    if (document.body.classList.contains('portfolio-folder-open') || document.body.classList.contains('blog-paper-open')) {
      scroller.stop();
    } else {
      scroller.start();
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

(function() {
  var portfolio = document.getElementById('portfolio');
  if (!portfolio) return;
  var items = [portfolio.querySelector('.portfolio-header')]
    .concat(Array.from(portfolio.querySelectorAll('.folder-stack .folder')))
    .filter(Boolean);
  items.forEach(function(el) { el.classList.add('scroll-hidden'); });
  var threshold = window.innerHeight * 0.88;
  window.addEventListener('resize', function() { threshold = window.innerHeight * 0.88; });
  function check() {
    var remaining = false;
    items.forEach(function(el) {
      if (el.classList.contains('has-revealed') || el.classList.contains('is-visible')) return;
      if (el.getBoundingClientRect().top < threshold) {
        el.classList.add('is-visible');
        el.addEventListener('animationend', function() {
          el.classList.add('has-revealed');
          el.classList.remove('scroll-hidden', 'is-visible');
        }, { once: true });
      } else {
        remaining = true;
      }
    });
    if (!remaining) scroller.off('scroll', check);
  }
  scroller.on('scroll', check);
  check();
})();

(function() {
  var homeLink = document.querySelector('nav a[href="index.html"]');
  if (homeLink) {
    homeLink.addEventListener('click', function(e) {
      if (window.location.pathname.replace(/\/index\.html$/, '/') === new URL(homeLink.href).pathname.replace(/\/index\.html$/, '/')) {
        e.preventDefault();
        scroller.scrollTo(0);
      }
    });
  }
})();

(function() {
  var portfolioSection = document.getElementById('portfolio');
  if (!portfolioSection) return;
  var portfolioLink = document.querySelector('nav a[href="#portfolio"]');
  var homeLink = document.querySelector('nav a[href="index.html"]');
  if (!portfolioLink || !homeLink) return;
  new IntersectionObserver(function(entries) {
    var visible = entries[0].isIntersecting;
    portfolioLink.classList.toggle('nav-active', visible);
    homeLink.classList.toggle('nav-active', !visible);
  }, { rootMargin: '0px 0px -50% 0px', threshold: 0 }).observe(portfolioSection);
})();

document.querySelectorAll('a[href^="#"]:not(.hero-peek-tab)').forEach(function(anchor) {
  anchor.addEventListener('click', function(e) {
    var target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      scroller.scrollTo(target);
    }
  });
});

// Hero drawer tabs: scroll to the portfolio, then pulse the matching folder
// so the clicked tab visibly "arrives" as its folder in the stack.
(function() {
  var portfolio = document.getElementById('portfolio');
  if (!portfolio) return;
  var pulseTimer;
  document.querySelectorAll('.hero-peek-tab[data-folder]').forEach(function(tab) {
    var folder = document.querySelector('.folder[data-folder="' + tab.dataset.folder + '"]');
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      // Explicit duration keeps onComplete prompt — lerp-mode scrolling has a
      // long settling tail that would delay the pulse.
      scroller.scrollTo(portfolio, {
        duration: 0.7,
        onComplete: function() {
          // .peeking = already hovered; hover owns the folder, skip the pulse
          if (!folder || folder.classList.contains('open') || folder.classList.contains('peeking')) return;
          clearTimeout(pulseTimer);
          document.querySelectorAll('.folder.hero-pulse').forEach(function(f) {
            f.classList.remove('hero-pulse');
          });
          void folder.offsetWidth; // restart the animation on repeat clicks
          folder.classList.add('hero-pulse');
          pulseTimer = setTimeout(function() {
            folder.classList.remove('hero-pulse');
          }, 1250);
        }
      });
    });
  });
})();

// Header scroll state (e.g. shadow)
(function() {
  var header = document.querySelector('header');
  var wasScrolled = false;
  window.addEventListener('scroll', function() {
    var isScrolled = window.scrollY > 0;
    if (isScrolled !== wasScrolled) {
      header.classList.toggle('scrolled', isScrolled);
      wasScrolled = isScrolled;
    }
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

// Case study walkthrough videos: play while scrolled into view, pause
// otherwise. Muted/inline so the browser allows autoplay without a gesture;
// controls stay on so a visitor can unmute or scrub manually.
(function() {
  var videos = document.querySelectorAll('.cs-screen-video[data-autoplay-in-view]');
  if (!videos.length || !('IntersectionObserver' in window)) return;
  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      var video = entry.target;
      if (entry.isIntersecting) {
        video.play().catch(function() {});
      } else {
        video.pause();
      }
    });
  }, { threshold: 0.4 });
  videos.forEach(function(video) { observer.observe(video); });
})();

function randomHighlightAngle(selector, onHover) {
  document.querySelectorAll(selector).forEach(function(el) {
    function setAngle() {
      el.style.setProperty('--highlight-angle', (Math.random() * 6 - 3).toFixed(1) + 'deg');
    }
    if (onHover) el.addEventListener('mouseenter', setAngle);
    else setAngle();
  });
}

// Case-study contents rail: highlight the section currently under the reader.
// The rootMargin band is narrow and centred, so the active dot tracks what's
// actually being read rather than whatever merely touched the viewport edge.
(function() {
  var links = document.querySelectorAll('.cs-rail-link[data-rail]');
  var sections = document.querySelectorAll('.cs-section[id]');
  if (!links.length || !sections.length || !('IntersectionObserver' in window)) return;

  function paint(id) {
    links.forEach(function(link) {
      link.classList.toggle('is-active', link.getAttribute('data-rail') === id);
    });
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(entry) {
      if (entry.isIntersecting) paint(entry.target.id);
    });
  }, { rootMargin: '-42% 0px -52% 0px', threshold: 0 });

  sections.forEach(function(section) { observer.observe(section); });
  paint(sections[0].id);
})();

// Click-to-zoom for case-study captures. Full-window app screenshots render
// ~410px wide in the main column, so detail lives behind a click.
(function() {
  var figures = document.querySelectorAll('[data-zoom]');
  if (!figures.length) return;
  var overlay = null;

  function close() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    document.body.style.overflow = '';
  }

  function open(src, alt) {
    close();
    overlay = document.createElement('div');
    overlay.className = 'cs-zoom';
    var img = document.createElement('img');
    img.src = src;
    img.alt = alt || '';
    overlay.appendChild(img);
    overlay.addEventListener('click', close);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
  }

  figures.forEach(function(figure) {
    figure.addEventListener('click', function() {
      var img = figure.querySelector('img');
      if (img) open(img.getAttribute('src'), img.getAttribute('alt'));
    });
  });

  window.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') close();
  });
})();
