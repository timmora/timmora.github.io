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

// When an overlay is open, Lenis stops so the overlay can scroll natively and
// the wheel stops moving the page behind it. The CSS overflow lock alone does
// not do that: Lenis drives window.scrollTo, which overflow does not block.
(function syncLenisWhenFolderOpen() {
  var OVERLAY_CLASSES = ['portfolio-folder-open', 'blog-paper-open', 'cs-zoom-open'];
  function sync() {
    if (OVERLAY_CLASSES.some(function(c) { return document.body.classList.contains(c); })) {
      scroller.stop();
    } else {
      scroller.start();
    }
  }
  sync();
  new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
})();

// iOS Safari only applies :active to elements when a touch listener exists
// somewhere on the page; without one, the press states in styles.css never
// show on a phone — the one device where hover gives no feedback either.
document.addEventListener('touchstart', function() {}, { passive: true });

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
  // Two thresholds, not one: the tab now resizes rather than just deepening
  // its shadow, and a single boundary makes that flap while a trackpad idles
  // on top of it. It shrinks at 24px and only expands again below 8px.
  var SHRINK_AT = 24;
  var GROW_AT = 8;
  var wasScrolled = false;
  window.addEventListener('scroll', function() {
    var y = window.scrollY;
    var isScrolled = wasScrolled ? y > GROW_AT : y > SHRINK_AT;
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

// Header name: the letters lean toward the pointer as it moves across the
// header, and spring back upright when it goes. Each letter is its own spring
// (Apple-style response/damping), so the lean follows the pointer without
// lag, can change direction mid-swing, and the return carries a small wobble.
(function() {
  var name = document.querySelector('.header-name');
  var header = document.querySelector('header');
  if (!name || !header) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  // Kept gentle on purpose: letters on either side of the pointer tip toward
  // each other, and past ~10deg the "m" and "M" meet and close the word gap.
  var MAX_LEAN = 9;    // deg, reached by a letter one REACH from the pointer
  var REACH = 22;      // px; past about three of these a letter barely stirs
  var FALLOFF_Y = 40;  // px above or below the name before the pull fades
  var RESPONSE = 0.35; // s — how quickly a letter gets where it is going
  var DAMPING = 0.7;   // under 1, so the return overshoots a touch
  var K = Math.pow(2 * Math.PI / RESPONSE, 2);
  var C = 4 * Math.PI * DAMPING / RESPONSE;

  // Split into letters. The link keeps the name as its accessible label, so
  // screen readers hear "Tim Mora", not seven separate characters.
  var text = name.textContent;
  name.setAttribute('aria-label', text.trim());
  name.textContent = '';
  var letters = [];
  text.split('').forEach(function(ch) {
    if (ch === ' ') { name.appendChild(document.createTextNode(' ')); return; }
    var span = document.createElement('span');
    span.className = 'header-name-letter';
    span.setAttribute('aria-hidden', 'true');
    span.textContent = ch;
    name.appendChild(span);
    letters.push({ el: span, a: 0, v: 0, target: 0 });
  });

  var px = null, py = null, raf = 0, last = 0;

  function aim() {
    var r = name.getBoundingClientRect();
    var cy = r.top + r.height / 2;
    letters.forEach(function(l) {
      if (px === null) { l.target = 0; return; }
      var cx = r.left + l.el.offsetLeft + l.el.offsetWidth / 2;
      // Derivative-of-Gaussian falloff: a letter right under the pointer
      // stands straight, its neighbours lean in hardest one REACH out, and
      // the pull fades smoothly beyond that. Positive rotates the top right.
      var d = (px - cx) / REACH;
      var pull = d * Math.exp(0.5 * (1 - d * d));
      var dy = (py - cy) / FALLOFF_Y;
      l.target = MAX_LEAN * pull * Math.exp(-dy * dy);
    });
  }

  function frame(now) {
    var dt = last ? Math.min(0.032, (now - last) / 1000) : 1 / 60;
    last = now;
    var moving = false;
    letters.forEach(function(l) {
      // Two half-steps keep the stiff spring stable through a slow frame.
      for (var i = 0; i < 2; i++) {
        l.v += (-K * (l.a - l.target) - C * l.v) * dt / 2;
        l.a += l.v * dt / 2;
      }
      if (Math.abs(l.a - l.target) > 0.01 || Math.abs(l.v) > 0.05) moving = true;
      else { l.a = l.target; l.v = 0; }
      l.el.style.transform = l.a ? 'rotate(' + l.a.toFixed(2) + 'deg)' : '';
    });
    if (moving) { raf = requestAnimationFrame(frame); } else { raf = 0; last = 0; }
  }

  function kick() { if (!raf) raf = requestAnimationFrame(frame); }

  header.addEventListener('pointermove', function(e) {
    if (e.pointerType === 'touch') return;
    px = e.clientX; py = e.clientY;
    aim(); kick();
  });
  header.addEventListener('pointerleave', function() {
    px = py = null;
    aim(); kick();
  });
})();

// Case-study deep dives are <details>, which snap open and shut. This grows
// and shrinks them instead. Every run starts from the element's live height,
// so clicking again mid-way turns it around rather than restarting or
// jumping. Without JS they are still plain, working <details>.
(function() {
  var deeps = document.querySelectorAll('details.cs-deep');
  if (!deeps.length || !Element.prototype.animate) return;
  var EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  deeps.forEach(function(el) {
    var summary = el.querySelector('summary');
    if (!summary) return;
    var run = null, fade = null;
    var wantOpen = el.open;

    function body() { return el.querySelectorAll(':scope > :not(summary)'); }

    summary.addEventListener('click', function(e) {
      e.preventDefault();
      wantOpen = !wantOpen;
      el.classList.toggle('is-closing', !wantOpen);

      if (reduceMotion.matches) {
        // No growing; the content just fades in over the switch.
        el.open = wantOpen;
        el.classList.remove('is-closing');
        if (wantOpen) body().forEach(function(n) { n.animate({ opacity: [0, 1] }, { duration: 180 }); });
        return;
      }

      var from = el.getBoundingClientRect().height; // live, even mid-run
      if (run) run.cancel();
      if (fade) fade.forEach(function(a) { a.cancel(); });
      el.open = false;
      var closedH = el.getBoundingClientRect().height;
      el.open = true;
      var openH = el.getBoundingClientRect().height;
      var to = wantOpen ? openH : closedH;

      // Longer blocks get a little more time, so a tall code sample isn't
      // whipped open at the same rate as a two-line note.
      var duration = Math.min(560, 280 + Math.abs(to - from) * 0.3);
      el.style.overflow = 'hidden';
      run = el.animate({ height: [from + 'px', to + 'px'] }, { duration: duration, easing: EASE });
      // The content fades in behind the growing edge, and out ahead of the
      // shrinking one, so text never gets sliced mid-line at full strength.
      fade = Array.prototype.map.call(body(), function(n) {
        var start = +getComputedStyle(n).opacity;
        return n.animate({ opacity: [start, wantOpen ? 1 : 0] },
          { duration: wantOpen ? duration : duration * 0.6, easing: 'ease', fill: 'forwards' });
      });
      run.onfinish = function() {
        run = null;
        if (fade) fade.forEach(function(a) { a.cancel(); });
        fade = null;
        el.style.overflow = '';
        el.classList.remove('is-closing');
        el.open = wantOpen;
      };
    });
  });
})();

// Click-to-zoom for case-study captures. Full-window app screenshots render
// ~410px wide in the main column, so detail lives behind a click.
//
// The enlarged screenshot is a sheet: it rises from the bottom edge and
// leaves the way it came. It can be dragged down to dismiss — it tracks the
// pointer 1:1, a flick carries its speed into the exit, and a short pull
// springs back. Every animation starts from wherever the sheet is on screen
// right now, so it can be caught or turned around at any point.
(function() {
  var figures = document.querySelectorAll('[data-zoom]');
  if (!figures.length) return;
  // The iOS sheet curve: leaves fast, settles long. Its starting slope is
  // 0.72 / 0.32 = 2.25x its average speed, which is what lets a drag's
  // release velocity be handed to it (see durationFor).
  var EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
  var EASE_SLOPE = 0.72 / 0.32;
  var OPEN_MS = 460, CLOSE_MS = 320, SETTLE_MS = 380;
  var DRAG_SLOP = 10; // px of travel before a press counts as a drag
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var overlay = null, big = null, flight = null, returnFocus = null;
  var drag = null, swallowClick = false;

  function currentY() {
    var t = getComputedStyle(big).transform;
    return t && t !== 'none' ? new DOMMatrix(t).m42 : 0;
  }

  // Far enough down that the sheet, shadow included, is below the fold.
  function belowFold() {
    return window.innerHeight - big.offsetTop + 60;
  }

  // A duration that makes the curve's opening speed match the pointer's, so
  // there is no seam between letting go and the sheet moving on its own.
  // Only applies when the flick is heading the same way; otherwise, and for
  // a slow release, the normal duration is used.
  function durationFor(distance, velocity, fallback) {
    if (!velocity || distance * velocity <= 0) return fallback;
    return Math.max(140, Math.min(fallback, EASE_SLOPE * Math.abs(distance) / Math.abs(velocity)));
  }

  function slide(toY, duration, done) {
    var fromY = currentY(); // read before cancelling, or it reads the end state
    if (flight) flight.cancel();
    big.style.transform = 'translateY(' + toY + 'px)';
    flight = big.animate(
      [{ transform: 'translateY(' + fromY + 'px)' }, { transform: 'translateY(' + toY + 'px)' }],
      { duration: duration, easing: EASE }
    );
    flight.onfinish = function() { flight = null; if (done) done(); };
  }

  // Past the top edge the sheet resists more the further it is pulled.
  function rubberband(over, dimension) {
    var c = 0.55;
    return (over * dimension * c) / (dimension + c * Math.abs(over));
  }

  function teardown() {
    overlay.remove();
    overlay = big = flight = drag = null;
    document.body.classList.remove('cs-zoom-open');
    if (returnFocus) { returnFocus.focus({ preventScroll: true }); returnFocus = null; }
  }

  function close(velocity) {
    if (!overlay || overlay.classList.contains('is-closing')) return;
    overlay.classList.add('is-closing');
    overlay.classList.remove('is-open', 'is-dragging');
    if (reduceMotion.matches || !big.animate) {
      // No travel: sheet and scrim fade out together.
      if (big.animate) big.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: 'forwards' });
      setTimeout(teardown, 200);
      return;
    }
    var to = belowFold();
    slide(to, durationFor(to - currentY(), velocity, CLOSE_MS), teardown);
  }

  function onPointerDown(e) {
    if (e.button !== 0 || overlay.classList.contains('is-closing')) return;
    swallowClick = false; // a stale flag from a drag that ended with no click
    var y = currentY();
    // Caught mid-flight: pin it where it is and hand it to the pointer.
    if (flight) { flight.cancel(); flight = null; big.style.transform = 'translateY(' + y + 'px)'; }
    drag = { id: e.pointerId, originY: e.clientY, baseY: y, y: y, active: false, samples: [] };
    big.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e) {
    if (!drag || e.pointerId !== drag.id || overlay.classList.contains('is-closing')) return;
    var dy = e.clientY - drag.originY;
    if (!drag.active) {
      if (Math.abs(dy) < DRAG_SLOP) return;
      // Re-anchor at the point it became a drag, so the sheet doesn't jump
      // by the slop distance the moment it starts following.
      drag.active = true;
      drag.originY = e.clientY;
      dy = 0;
      overlay.classList.add('is-dragging');
    }
    var y = drag.baseY + dy;
    if (y < 0) y = rubberband(y, window.innerHeight);
    drag.y = y;
    big.style.transform = 'translateY(' + y + 'px)';
    // The scrim thins as the sheet is pulled away, so the page behind
    // previews what letting go will reveal.
    overlay.style.setProperty('--scrim', Math.max(0, 1 - Math.max(0, y) / belowFold()).toFixed(3));
    drag.samples.push({ t: e.timeStamp, y: e.clientY });
    while (drag.samples.length > 2 && e.timeStamp - drag.samples[0].t > 80) drag.samples.shift();
  }

  function onPointerUp(e) {
    if (!drag || e.pointerId !== drag.id) return;
    var d = drag;
    drag = null;
    if (!d.active) {
      // A tap, not a drag; the click that follows will close the sheet. If
      // the press pinned it mid-rise and no click comes (pointercancel),
      // this sends it the rest of the way up rather than stranding it.
      if (currentY() !== 0) slide(0, SETTLE_MS);
      return;
    }
    swallowClick = true; // the click that follows a drag is not a tap
    overlay.classList.remove('is-dragging');
    var s = d.samples, v = 0;
    if (s.length > 1) {
      var first = s[0], last = s[s.length - 1];
      v = (last.y - first.y) / Math.max(1, last.t - first.t); // px/ms
    }
    // Decide from where the gesture is heading, not where it let go: Apple's
    // momentum projection (deceleration rate 0.998) says where a flick at this
    // speed would come to rest.
    var projected = d.y + v * 0.998 / (1 - 0.998);
    if (v >= 0 && projected > belowFold() * 0.3) {
      close(v);
    } else {
      slide(0, durationFor(-d.y, v, SETTLE_MS));
    }
  }

  function open(source) {
    if (overlay) return;
    returnFocus = document.activeElement;
    overlay = document.createElement('div');
    overlay.className = 'cs-zoom';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Enlarged screenshot. Press Escape, click, or drag down to close.');
    overlay.tabIndex = -1;
    big = document.createElement('img');
    big.src = source.currentSrc || source.src;
    big.alt = source.alt || '';
    big.draggable = false; // the browser's own image drag would steal the gesture

    overlay.appendChild(big);
    overlay.addEventListener('click', function() {
      if (swallowClick) { swallowClick = false; return; }
      close();
    });
    big.addEventListener('pointerdown', onPointerDown);
    big.addEventListener('pointermove', onPointerMove);
    big.addEventListener('pointerup', onPointerUp);
    big.addEventListener('pointercancel', onPointerUp);
    document.body.appendChild(overlay);
    document.body.classList.add('cs-zoom-open');

    // Size it up front from the thumbnail's natural dimensions, so its resting
    // position is known before it paints and the rise can be measured. The
    // room comes from the overlay's own padding, which widens around a notch.
    var nw = source.naturalWidth, nh = source.naturalHeight;
    if (nw && nh) {
      var cs = getComputedStyle(overlay);
      var roomW = overlay.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      var roomH = overlay.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      var fit = Math.min(1, roomW / nw, roomH / nh);
      big.style.width = Math.round(nw * fit) + 'px';
      big.style.height = Math.round(nh * fit) + 'px';
    }

    overlay.focus({ preventScroll: true });

    // Next frame, so the scrim's transition sees a starting state to leave.
    requestAnimationFrame(function() { if (overlay) overlay.classList.add('is-open'); });

    if (!big.animate) return;
    if (reduceMotion.matches) {
      big.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200 });
      return;
    }
    big.style.transform = 'translateY(' + belowFold() + 'px)';
    slide(0, OPEN_MS);
  }

  figures.forEach(function(figure) {
    figure.addEventListener('click', function() {
      // data-zoom sits on a wrapper (.cs-shot, .cs-figure) where the caption is
      // a sibling, and on the <img> itself where it isn't — panel grids put the
      // image and its caption in one card, so the whole card must not be hot.
      var img = figure.matches('img') ? figure : figure.querySelector('img');
      if (img) open(img);
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
      panel.addEventListener('transitionend', function h(e) {
        // Child transitions bubble up here, so only the panel's own fade counts.
        if (e.target !== panel || e.propertyName !== 'opacity') return;
        panel.removeEventListener('transitionend', h);
        // Reopened mid-close: the fade that just ended was the way back in,
        // and hiding now would blank the panel under a live overlay.
        if (panel.classList.contains('visible')) return;
        panel.classList.remove('active');
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

  // Grace period before a peeked envelope closes once the pointer leaves, so
  // skimming across the stack doesn't flap every envelope shut behind it.
  var PEEK_CLOSE_DELAY = 500;
  var activePaper = null;
  var activeTrigger = null;

  function closePaper(immediate) {
    if (activePaper) {
      var paper = activePaper;
      activePaper = null;
      paper.classList.remove('visible');
      if (immediate) {
        paper.classList.remove('active');
        paper.style.width = '';
      } else {
        // Listens for opacity, not transform: reduced motion drops the slide
        // but keeps the fade, so transform may never transition at all.
        paper.addEventListener('transitionend', function onEnd(e) {
          if (e.target !== paper || e.propertyName !== 'opacity') return;
          paper.removeEventListener('transitionend', onEnd);
          // Reopened before the fade-out finished — leave it on screen.
          if (paper.classList.contains('visible')) return;
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

    envelope.addEventListener('mouseenter', function() {
      if (activePaper) return;
      // Back inside before the grace period ran out: the pending close is
      // stale, and letting it fire would shut the flap under the pointer.
      clearTimeout(peekTimeout);
      envelope.classList.add('peeking');
    });

    envelope.addEventListener('mouseleave', function() {
      if (activePaper) return;
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
      }, PEEK_CLOSE_DELAY);
    });

    // Opens on the spot. It used to hold the paper back until the flap had
    // finished, which cost a keyboard or touch visitor half a second of
    // nothing; the flap now opens alongside the paper instead of before it.
    function openPaper() {
      if (activePaper) return;
      clearTimeout(peekTimeout);
      var paper = overlay.querySelector('.paper[data-entry="' + envelope.dataset.entry + '"]');
      if (!paper) return;

      var overlayPad = 48;
      var maxPaperW = Math.max(280, document.documentElement.clientWidth - overlayPad);
      var targetPaperW = Math.max(envelope.offsetWidth, 920);
      paper.style.width = Math.min(targetPaperW, maxPaperW) + 'px';
      envelope.classList.add('peeking', 'open');
      stack.classList.add('has-open');
      blogSection.classList.add('has-open-envelope');
      overlay.classList.add('active');
      paper.classList.add('active');
      activePaper = paper;
      activeTrigger = envelope;
      envelope.setAttribute('aria-expanded', 'true');
      document.body.classList.add('blog-paper-open');
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { paper.classList.add('visible'); });
      });
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
    // The click that opened the paper bubbles here too. Once a paper is up the
    // envelopes sit under the overlay, so any click on one is that same click.
    if (e.target.closest('.envelope')) return;
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
