// Smooth scroll
var lenis = new Lenis({ autoRaf: true, lerp: 0.1, wheelMultiplier: 1 });

// Theme toggle
document.getElementById('theme-toggle').addEventListener('click', (e) => {
  e.stopPropagation();
  const isDark = document.documentElement.dataset.theme === 'dark';
  document.documentElement.dataset.theme = isDark ? '' : 'dark';
  localStorage.setItem('theme', document.documentElement.dataset.theme);
});

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

// Header scroll show/hide (default — pages with data-custom-scroll handle their own)
var lastScrollY = window.scrollY;
if (!document.body.hasAttribute('data-custom-scroll')) {
  (function() {
    var header = document.querySelector('header');
    window.addEventListener('scroll', function() {
      header.classList.toggle('scrolled', window.scrollY > 0);
      header.classList.toggle('hidden', window.scrollY > lastScrollY && window.scrollY > 50);
      lastScrollY = window.scrollY;
    });
  })();
}
