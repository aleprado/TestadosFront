const options = { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.05 };

const observer = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
      // Dejar de observar una vez visible para no recalcular
      observer.unobserve(entry.target);
    }
  }
}, options);

export function observeReveal(el) {
  if (!el) return;
  el.classList.add('reveal');
  observer.observe(el);
}

export function observeAllReveals(root = document) {
  root.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  // Forzar visibilidad inmediata para elementos ya en viewport como fallback
  const vh = window.innerHeight || document.documentElement.clientHeight;
  root.querySelectorAll('.reveal').forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.top < vh * 0.9 && rect.bottom > 0) {
      el.classList.add('is-visible');
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  // Activar modo reveal solo si JS carga correctamente
  document.documentElement.classList.add('js-reveal');
  observeAllReveals();
});
