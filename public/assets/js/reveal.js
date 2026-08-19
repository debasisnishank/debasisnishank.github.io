// Scroll-reveal: fade + rise elements into view as they enter the viewport.
// - Respects prefers-reduced-motion (reveals everything immediately).
// - Safety net ensures content is never left hidden if anything misfires.
// NOTE: keep SEL in sync with the reveal CSS list in BaseLayout.astro.
(function () {
  var SEL = '.hero__content, .section__header, .now__main, .research__item, ' +
    '.research__publications, .project-card, .moto-intro, .moto-card, .moto-links, ' +
    '.cv-timeline__item, .about__content > p, .project-content > *, .project-hero__header';

  var els = Array.prototype.slice.call(document.querySelectorAll(SEL));
  if (!els.length) return;

  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('is-visible'); });
    return;
  }

  // Stagger children within grids / lists so cards arrive one after another.
  document.querySelectorAll('.projects__grid, .moto-grid, .cv-timeline').forEach(function (grid) {
    Array.prototype.slice.call(grid.children).forEach(function (child, i) {
      child.style.transitionDelay = Math.min(i * 70, 350) + 'ms';
    });
  });

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.05 });

  els.forEach(function (el) { io.observe(el); });

  // Safety net: reveal anything still hidden after 2.5s no matter what.
  window.setTimeout(function () {
    els.forEach(function (el) { el.classList.add('is-visible'); });
  }, 2500);
})();
