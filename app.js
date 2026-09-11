// Reload + Lenis: browser scroll restoration can leave the page partway down; manual avoids that.
if ('scrollRestoration' in history) {
  history.scrollRestoration = 'manual';
}

// Lenis is tuned for the wheel (lerp + wheelMultiplier) and on touch it fights
// native momentum and the collapsing address bar. Run it only for fine pointers
// and let phones/tablets scroll natively. The typeof check is not paranoia:
// Lenis is a CDN global, and without it a failed request throws here and takes
// every behavior below this line down with it.
var lenis = (typeof Lenis === 'function' && window.matchMedia('(pointer: fine)').matches)
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
      var jumpToHash = function() { scroller.scrollTo(target, { immediate: true }); };
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

// Clicking "Home" while already on the home page scrolls up instead of
// re-navigating. Both paths are normalized so /index.html and / compare equal.
(function() {
  var homeLink = document.querySelector('nav a[href="/"], nav a[href="index.html"]');
  if (!homeLink) return;
  function normalize(path) { return path.replace(/\/index\.html$/, '/'); }
  homeLink.addEventListener('click', function(e) {
    if (normalize(window.location.pathname) === normalize(new URL(homeLink.href).pathname)) {
      e.preventDefault();
      scroller.scrollTo(0);
    }
  });
})();

(function() {
  var portfolioSection = document.getElementById('portfolio');
  if (!portfolioSection) return;
  var portfolioLink = document.querySelector('nav a[href="#portfolio"]');
  var homeLink = document.querySelector('nav a[href="/"], nav a[href="index.html"]');
  if (!portfolioLink || !homeLink || !('IntersectionObserver' in window)) return;
  new IntersectionObserver(function(entries) {
    var visible = entries[0].isIntersecting;
    portfolioLink.classList.toggle('nav-active', visible);
    homeLink.classList.toggle('nav-active', !visible);
  }, { rootMargin: '0px 0px -50% 0px', threshold: 0 }).observe(portfolioSection);
})();

// The skip link is excluded deliberately: preventDefault would scroll without
// moving focus, which is the one thing a skip link exists to do.
document.querySelectorAll('a[href^="#"]:not(.hero-peek-tab):not(.skip-link)').forEach(function(anchor) {
  anchor.addEventListener('click', function(e) {
    var target = document.querySelector(this.getAttribute('href'));
    if (target) {
      e.preventDefault();
      scroller.scrollTo(target);
    }
  });
});

// Hero drawer tabs: scroll to the portfolio stack. The folders themselves are
// left alone — hover is the only thing that moves them.
(function() {
  var portfolio = document.getElementById('portfolio');
  if (!portfolio) return;
  document.querySelectorAll('.hero-peek-tab[data-folder]').forEach(function(tab) {
    tab.addEventListener('click', function(e) {
      e.preventDefault();
      scroller.scrollTo(portfolio, { duration: 0.7 });
    });
  });
})();

// Header scroll state (e.g. shadow)
(function() {
  var header = document.querySelector('header');
  if (!header) return;
  var wasScrolled = false;
  window.addEventListener('scroll', function() {
    var isScrolled = window.scrollY > 0;
    if (isScrolled !== wasScrolled) {
      header.classList.toggle('scrolled', isScrolled);
      wasScrolled = isScrolled;
    }
  }, { passive: true });
})();

// Generic .reveal scroll-in animation.
(function() {
  var items = document.querySelectorAll('.reveal');
  if (!items.length) return;
  if (!('IntersectionObserver' in window)) {
    items.forEach(function(el) { el.classList.add('in'); });
    return;
  }

  var observer = new IntersectionObserver(function(entries) {
    entries.forEach(function(e) {
      if (!e.isIntersecting) return;
      e.target.classList.add('in');
      observer.unobserve(e.target);
    });
  }, { threshold: 0.07 });

  items.forEach(function(el) { observer.observe(el); });
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

// Case-study contents rail: highlight the section currently under the reader.
// The rootMargin band is narrow and centered, so the active dot tracks what's
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

// Hero paper clip — a clip swinging from the pointer on an invisible string.
// Unlike a follower easing toward a target, this is a driven pendulum: the
// cursor is the anchor, gravity pulls the clip down, and the anchor's own
// acceleration is what swings it. The overshoot on a direction change and the
// swing that outlives your cursor stopping both fall out of the physics rather
// than being animated.
(function () {
  var hero = document.getElementById('hero');
  var layer = document.getElementById('hero-light');
  var clip = layer && layer.querySelector('.hero-clip');
  var swing = layer && layer.querySelector('.clip-swing');
  if (!hero || !layer || !clip || !swing) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var STRING = 16;      // px from cursor to the top of the clip; matches --string
  var CLIP_H = 42;      // clip artwork height; matches --clip-h
  var GRAVITY = 1.7;    // how hard it hangs — higher pulls back to vertical sooner
  var DRIVE = 0.55;     // how much the cursor's acceleration throws it
  var DRIVE_MAX = 4;    // px/frame^2 — pointer noise past this is not real motion
  var DAMP = 0.945;     // energy kept per frame — lower kills the swing sooner
  var OMEGA_MAX = 0.16; // rad/frame — caps how far a hard fling can throw it
  var HOLD_X = 8;       // px the string hangs to the right of the cursor
  var ANCHOR_EASE = 0.4;
  var BITE_EASE = 0.16;
  var BITE_HOLD = 950;  // ms the clip stays on a tab before letting go

  var tx = 0, ty = 0;           // where the string is being held
  var ax = 0, ay = 0;           // where the anchor actually is
  var pvx = 0, pvy = 0;         // previous anchor velocity, for acceleration
  var drvX = 0, drvY = 0;       // smoothed drive, so pointer noise is not force
  var theta = 0, omega = 0;     // pendulum angle and angular velocity
  var last = 0;
  var raf = 0;
  var running = false;
  var visible = true;
  var placed = false;
  var biteUntil = -Infinity;
  var biteX = 0, biteY = 0;

  // The nearest drawer tab to the pointer, in hero-local coordinates. The clip
  // aims a little above the tab's top edge so the tab overlaps its lower half.
  function nearestTab(x) {
    var tabs = hero.querySelectorAll('.hero-peek-tab');
    if (!tabs.length) return null;
    var rect = hero.getBoundingClientRect();
    var best = null, bestD = Infinity;
    for (var i = 0; i < tabs.length; i++) {
      var r = tabs[i].getBoundingClientRect();
      var cx = r.left + r.width / 2 - rect.left;
      var d = Math.abs(cx - x);
      if (d < bestD) { bestD = d; best = { x: cx, y: r.top - rect.top }; }
    }
    return best;
  }

  function clamp(v, lim) { return v < -lim ? -lim : (v > lim ? lim : v); }

  function frame(now) {
    // Step in frame-units so the swing runs at the same rate on a 120Hz screen
    // as a 60Hz one, and so a dropped frame does not launch it.
    var dt = last ? Math.min(2, Math.max(0.5, (now - last) / 16.67)) : 1;
    last = now;

    var biting = now < biteUntil;
    var goX = biting ? biteX : tx + HOLD_X;
    var goY = biting ? biteY : ty;
    var ease = biting ? BITE_EASE : ANCHOR_EASE;

    var px = ax, py = ay;
    ax += (goX - ax) * ease;
    ay += (goY - ay) * ease;

    // Anchor acceleration is the difference between this frame's velocity and
    // the last one's — that is the force the string transmits to the clip.
    var vx = ax - px, vy = ay - py;
    // Pointer samples arrive unevenly — several in one frame, then none — so
    // the raw second derivative is mostly noise. Clamp it, then low-pass it:
    // what drives the swing should be the gesture, not the sampling.
    drvX += (clamp(vx - pvx, DRIVE_MAX) - drvX) * 0.25;
    drvY += (clamp(vy - pvy, DRIVE_MAX) - drvY) * 0.25;
    pvx = vx; pvy = vy;

    if (biting) {
      // Held against the tab: kill the swing so it sits square on the edge.
      theta += (0 - theta) * 0.25 * dt;
      omega *= 0.6;
      drvX = drvY = 0;
    } else {
      // theta is measured from straight down. Gravity restores it, the anchor's
      // horizontal acceleration drives it, and nothing clamps it — swing it hard
      // enough and it goes over the top and keeps rotating.
      var alpha = (-GRAVITY * Math.sin(theta) - DRIVE * drvX * Math.cos(theta) +
                   DRIVE * drvY * Math.sin(theta)) / STRING;
      omega = clamp((omega + alpha * dt) * Math.pow(DAMP, dt), OMEGA_MAX);
      theta += omega * dt;
    }

    clip.style.transform = 'translate3d(' + ax.toFixed(1) + 'px,' + ay.toFixed(1) + 'px,0)';
    swing.style.transform = 'rotate(' + (theta * 180 / Math.PI).toFixed(2) + 'deg)';

    var settled = Math.abs(theta) < 0.002 && Math.abs(omega) < 0.002 &&
      Math.abs(goX - ax) < 0.4 && Math.abs(goY - ay) < 0.4;
    if ((!settled || biting) && visible) raf = requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running || !visible) return;
    running = true;
    last = 0; // the gap since the loop last ran is not a timestep
    raf = requestAnimationFrame(frame);
  }

  hero.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    var rect = hero.getBoundingClientRect();
    tx = e.clientX - rect.left;
    ty = e.clientY - rect.top;
    // First sighting: hang it under the cursor rather than swinging it in from
    // the top-left corner.
    if (!placed) { placed = true; ax = tx + HOLD_X; ay = ty; }
    layer.classList.add('lit');
    start();
  });

  hero.addEventListener('pointerleave', function () { layer.classList.remove('lit'); });

  hero.addEventListener('pointerdown', function (e) {
    if (e.pointerType === 'touch') return;
    var rect = hero.getBoundingClientRect();
    var x = e.clientX - rect.left;
    var tab = nearestTab(x);
    if (!tab) return;
    biteX = tab.x;
    biteY = tab.y - CLIP_H * 0.55 - STRING;
    biteUntil = performance.now() + BITE_HOLD;
    layer.classList.remove('biting');
    void layer.offsetWidth; // restart the animation on a repeat click
    layer.classList.add('biting');
    start();
  });

  layer.addEventListener('animationend', function () { layer.classList.remove('biting'); });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting;
      if (!visible) { cancelAnimationFrame(raf); running = false; }
      else if (placed) start();
    }).observe(hero);
  }
})();

// Portfolio folder stack (home page). The four case-study folders are real
// anchors, so navigation, middle-click and keyboard activation are the
// browser's job — this only adds the hover peek. The Toolkit folder has no
// page of its own, so it acts as a button that opens an overlay panel.
(function() {
  var overlay = document.getElementById('folder-overlay');
  var portfolioSection = document.getElementById('portfolio');
  var folders = document.querySelectorAll('.folder');
  if (!overlay || !portfolioSection || !folders.length) return;

  function closeOverlay() {
    var panel = overlay.querySelector('.folder-panel.active');
    var openFolder = document.querySelector('.folder.open');
    if (panel) panel.classList.remove('visible');
    overlay.classList.remove('active');
    portfolioSection.classList.remove('has-open-folder');
    document.body.classList.remove('portfolio-folder-open');
    if (openFolder) openFolder.classList.remove('open');
    if (toolkitTrigger) {
      toolkitTrigger.setAttribute('aria-expanded', 'false');
      // Send focus back to what opened the panel, so keyboard users are not
      // dropped at the top of the document.
      toolkitTrigger.focus();
      toolkitTrigger = null;
    }
    if (panel) {
      panel.addEventListener('transitionend', function h() {
        panel.classList.remove('active');
        panel.removeEventListener('transitionend', h);
      });
    }
  }

  var toolkitTrigger = null;

  function openToolkit(folder) {
    var panel = overlay.querySelector('.folder-panel[data-folder="toolkit"]');
    if (!panel) return;
    toolkitTrigger = folder;
    folder.setAttribute('aria-expanded', 'true');
    folder.classList.add('open');
    overlay.classList.add('active');
    portfolioSection.classList.add('has-open-folder');
    document.body.classList.add('portfolio-folder-open');
    panel.classList.add('active');
    // Two frames: the first commits .active's layout, the second starts the
    // transition to .visible. With one frame the browser coalesces them.
    requestAnimationFrame(function() {
      requestAnimationFrame(function() { panel.classList.add('visible'); });
    });
  }

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeOverlay();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && overlay.classList.contains('active')) closeOverlay();
  });

  folders.forEach(function(folder) {
    var href = folder.getAttribute('href');
    var folderKey = folder.dataset.folder;
    var tab = folder.querySelector('.folder-tab');

    if (tab) {
      tab.addEventListener('mouseenter', function() {
        if (href || folderKey === 'toolkit') folder.classList.add('peeking');
      });
      tab.addEventListener('mouseleave', function() {
        folder.classList.remove('peeking');
      });
    }

    // Anchors navigate on their own; only the Toolkit trigger needs handlers,
    // including the Enter/Space that a real <button> would give for free.
    if (!href && folderKey === 'toolkit') {
      folder.addEventListener('click', function() { openToolkit(folder); });
      folder.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
          e.preventDefault();
          openToolkit(folder);
        }
      });
    }
  });
})();

// Home page subtitle: cycles roles with a blur crossfade.
(function() {
  var el = document.getElementById('subtitle-rotator');
  if (!el) return;
  var roles = ['Frontend Engineer', 'UI/UX Designer', 'Creator'];
  var i = 0;

  el.textContent = roles[0];
  el.classList.add('blur-in');
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  setInterval(function() {
    el.classList.add('blur-out');
    el.classList.remove('blur-in');
    // Matches the blur-out transition, so the text swaps while it is invisible.
    setTimeout(function() {
      i = (i + 1) % roles.length;
      el.textContent = roles[i];
      el.classList.remove('blur-out');
      el.classList.add('blur-in');
    }, 400);
  }, 2800);
})();

// Blog envelopes. Hovering lifts the flap and peeks the letter; clicking opens
// the full article as a "paper" laid over the stack.
(function() {
  var stack = document.querySelector('.envelope-stack');
  var overlay = document.getElementById('paper-overlay');
  var blogSection = document.getElementById('blog');
  var envelopes = document.querySelectorAll('.envelope');
  if (!stack || !overlay || !blogSection || !envelopes.length) return;

  var header = document.querySelector('.blog-header');
  if (header) {
    header.addEventListener('animationend', function() {
      this.style.animation = 'none';
    }, { once: true });
  }

  // .loading suppresses hover until the last envelope has finished dealing in.
  stack.classList.add('loading');
  envelopes[envelopes.length - 1].addEventListener('animationend', function() {
    stack.classList.remove('loading');
  }, { once: true });

  // The flap is drawn with left/right borders, so its size comes from the
  // envelope's measured width rather than a percentage.
  function setFlapSizes() {
    envelopes.forEach(function(envelope) {
      envelope.style.setProperty('--flap-size', (envelope.offsetWidth / 2) + 'px');
    });
  }
  setFlapSizes();
  window.addEventListener('resize', setFlapSizes);

  var PEEK_DURATION = 500;
  var activePaper = null;
  var activeTrigger = null;
  var opening = false;

  function closePaper(immediate) {
    if (activePaper) {
      var paper = activePaper;
      activePaper = null;
      paper.classList.remove('visible');
      if (immediate) {
        paper.classList.remove('active');
        paper.style.width = '';
      } else {
        paper.addEventListener('transitionend', function onEnd(e) {
          if (e.target !== paper || e.propertyName !== 'transform') return;
          paper.removeEventListener('transitionend', onEnd);
          paper.classList.remove('active');
          paper.style.width = '';
        });
      }
    }
    var openEnvelope = document.querySelector('.envelope.open');
    if (openEnvelope) openEnvelope.classList.remove('open', 'peeking');
    if (activeTrigger) {
      activeTrigger.setAttribute('aria-expanded', 'false');
      // Return focus to the envelope that was opened, rather than dropping
      // keyboard users back at the top of the document.
      activeTrigger.focus();
      activeTrigger = null;
    }
    stack.classList.remove('has-open');
    blogSection.classList.remove('has-open-envelope');
    overlay.classList.remove('active');
    document.body.classList.remove('blog-paper-open');
  }

  envelopes.forEach(function(envelope) {
    var peekTimeout = null;
    var peekStart = 0;

    envelope.addEventListener('mouseenter', function() {
      if (activePaper || opening) return;
      envelope.classList.add('peeking');
      peekStart = Date.now();
    });

    envelope.addEventListener('mouseleave', function() {
      if (activePaper || opening) return;
      if (!envelope.classList.contains('peeking')) return;
      clearTimeout(peekTimeout);
      peekTimeout = setTimeout(function() {
        envelope.classList.remove('peeking');
        envelope.classList.add('closing');
        var flap = envelope.querySelector('.envelope-flap');
        flap.addEventListener('transitionend', function handler() {
          envelope.classList.remove('closing');
          flap.removeEventListener('transitionend', handler);
        });
      }, PEEK_DURATION);
    });

    function openPaper() {
      if (activePaper || opening) return;
      clearTimeout(peekTimeout);
      opening = true;
      var wasPeeking = envelope.classList.contains('peeking');
      envelope.classList.add('peeking');
      if (!wasPeeking) peekStart = Date.now();

      var paper = overlay.querySelector('.paper[data-entry="' + envelope.dataset.entry + '"]');
      if (!paper) { opening = false; return; }
      // Let the flap finish opening before the paper slides out, whether the
      // click followed a hover or arrived cold.
      var delay = Math.max(0, PEEK_DURATION - (Date.now() - peekStart));

      setTimeout(function() {
        var overlayPad = 48;
        var maxPaperW = Math.max(280, document.documentElement.clientWidth - overlayPad);
        var targetPaperW = Math.max(envelope.offsetWidth, 920);
        paper.style.width = Math.min(targetPaperW, maxPaperW) + 'px';
        envelope.classList.add('open');
        stack.classList.add('has-open');
        blogSection.classList.add('has-open-envelope');
        overlay.classList.add('active');
        paper.classList.add('active');
        activePaper = paper;
        activeTrigger = envelope;
        envelope.setAttribute('aria-expanded', 'true');
        opening = false;
        document.body.classList.add('blog-paper-open');
        requestAnimationFrame(function() {
          requestAnimationFrame(function() { paper.classList.add('visible'); });
        });
      }, delay);
    }

    envelope.addEventListener('click', openPaper);
    envelope.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        openPaper();
      }
    });
  });

  document.addEventListener('click', function(e) {
    if (!activePaper) return;
    if (!activePaper.contains(e.target)) closePaper();
  });

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && activePaper) closePaper();
  });

  // The paper's width is computed once on open, so a width change has to
  // close it. Height changes must not: on mobile the collapsing URL bar
  // fires resize during ordinary scrolling, which slammed the article
  // shut mid-read.
  var lastPaperWidth = window.innerWidth;
  window.addEventListener('resize', function() {
    if (window.innerWidth === lastPaperWidth) return;
    lastPaperWidth = window.innerWidth;
    if (activePaper) closePaper(true);
  });
})();
