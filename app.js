// Smooth scroll
var lenis = new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 1 });

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

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = isDark ? '' : 'dark';
  localStorage.setItem('theme', document.documentElement.dataset.theme);
});

(function syncThemeWithOs() {
  function apply() {
    if (localStorage.getItem('theme') !== null) return;
    document.documentElement.dataset.theme = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : '';
  }
  var mq = matchMedia('(prefers-color-scheme: dark)');
  if (mq.addEventListener) mq.addEventListener('change', apply);
  else mq.addListener(apply);
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

// Header scroll state (e.g. shadow)
(function() {
  var header = document.querySelector('header');
  window.addEventListener('scroll', function() {
    header.classList.toggle('scrolled', window.scrollY > 0);
  });
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
