import { trackEvent } from './metrics.js';

const headerTemplate = `
  <div class="site-header__inner">
    <a href="/" id="brand" class="brand"><img src="/header.png" alt="Testados" class="brand-logo"></a>
    <nav class="site-nav" data-nav-root></nav>
  </div>
`;

const publicNavTemplate = `
  <a href="#app" id="navKnowApp" class="nav-link">Conoce la app</a>
  <a href="/contacto" id="navContact" class="nav-link">Contacto</a>
  <div class="nav-download">
    <button id="navDownloads" class="nav-link nav-link--ghost nav-download__toggle" type="button" aria-haspopup="menu" aria-expanded="false">Descargas</button>
    <div class="nav-download__menu" role="menu" hidden>
      <a class="nav-download__option" role="menuitem" data-download-id="ruta_subida" href="/content/ejemplos/ruta_para_subir_ejemplo.csv" download>Ejemplo de ruta para subir</a>
      <a class="nav-download__option" role="menuitem" data-download-id="ruta_procesada" href="/content/ejemplos/ruta_procesada_ejemplo.csv" download>Ejemplo de ruta procesada</a>
    </div>
  </div>
  <a href="/login" id="navLogin" class="nav-link nav-link--primary">Acceso a clientes</a>
`;

const authNavTemplate = `
  <a href="#" id="navBack" class="nav-link nav-link--ghost">Volver</a>
  <a href="#" id="navLogout" class="nav-link nav-link--primary">Cerrar sesión</a>
`;

const footerTemplate = `
  <div class="site-footer__inner">
    <span>© <span id="year"></span> Testados</span>
    <div class="site-footer__links">
      <a class="footer-link" href="/politica">Política de privacidad</a>
    </div>
    <a class="footer-store" href="https://play.google.com/store/apps/details?id=pd.testados" target="_blank" rel="noopener noreferrer">
      <img src="/content/icons/disponible-en-google-play-badge.png" alt="Disponible en Google Play" class="footer-store__img" />
    </a>
  </div>
`;

const whatsappTemplate = `
  <a id="waFloat" class="whatsapp-float" target="_blank" rel="noopener noreferrer" href="#" title="Escríbenos por WhatsApp" aria-label="WhatsApp">
    <img src="/content/icons/WhatsApp_icon.png" alt="WhatsApp" class="whatsapp-icon-img" />
  </a>
`;

const AUTH_PAGES = new Set(['gestionar-rutas', 'localidades', 'mapa']);
let downloadsMenuListenerAttached = false;

function updateLayoutMetrics() {
  const header = document.querySelector('.site-header');
  const footer = document.querySelector('.site-footer');
  if (header) {
    document.documentElement.style.setProperty('--layout-header-height', `${header.offsetHeight}px`);
  }
  if (footer) {
    document.documentElement.style.setProperty('--layout-footer-height', `${footer.offsetHeight}px`);
  }
}

function paintHeader() {
  const header = document.querySelector('[data-component="site-header"]');
  if (header && !header.dataset.rendered) {
    header.innerHTML = headerTemplate;
    header.dataset.rendered = 'true';
  }
}

function renderNav(page) {
  const nav = document.querySelector('.site-nav[data-nav-root]');
  if (!nav) return;

  const requiresAuth = AUTH_PAGES.has(page);
  nav.innerHTML = requiresAuth ? authNavTemplate : publicNavTemplate;

  if (requiresAuth) {
    const navBack = document.getElementById('navBack');
    const navLogout = document.getElementById('navLogout');
    navBack?.addEventListener('click', (event) => {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('layout:back'));
    });
    navLogout?.addEventListener('click', (event) => {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent('layout:logout'));
    });
  } else {
    const navKnowApp = document.getElementById('navKnowApp');
    if (navKnowApp) {
      navKnowApp.href = page === 'landing' ? '#app' : '/#app';
    }
    if (page !== 'landing') {
      document.querySelector('.nav-download')?.remove();
    }
  }

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      trackEvent('cta_click', {
        id: link.id || null,
        label: link.textContent?.trim() || null,
        href: link.getAttribute('href') || null
      });
    });
  });

  if (!requiresAuth && page === 'landing') {
    setupDownloadsMenu();
  }
}

function closeDownloadsMenu(except = null) {
  document.querySelectorAll('.nav-download').forEach((wrapper) => {
    const menu = wrapper.querySelector('.nav-download__menu');
    const toggle = wrapper.querySelector('.nav-download__toggle');
    if (!menu || !toggle || wrapper === except) return;
    menu.classList.remove('is-open');
    menu.setAttribute('hidden', 'true');
    toggle.setAttribute('aria-expanded', 'false');
  });
}

function setupDownloadsMenu() {
  const wrapper = document.querySelector('.nav-download');
  if (!wrapper || wrapper.dataset.bound === 'true') return;
  const toggle = wrapper.querySelector('.nav-download__toggle');
  const menu = wrapper.querySelector('.nav-download__menu');
  if (!toggle || !menu) return;

  wrapper.dataset.bound = 'true';

  toggle.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    const isOpen = menu.classList.contains('is-open');
    closeDownloadsMenu(wrapper);
    if (isOpen) {
      menu.classList.remove('is-open');
      menu.setAttribute('hidden', 'true');
      toggle.setAttribute('aria-expanded', 'false');
      return;
    }
    menu.classList.add('is-open');
    menu.removeAttribute('hidden');
    toggle.setAttribute('aria-expanded', 'true');
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      closeDownloadsMenu();
      trackEvent('download_example', {
        id: link.dataset.downloadId || null,
        href: link.getAttribute('href')
      });
    });
  });

  if (!downloadsMenuListenerAttached) {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest('.nav-download')) {
        closeDownloadsMenu();
      }
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeDownloadsMenu();
      }
    });
    downloadsMenuListenerAttached = true;
  }
}

function paintFooter() {
  const footer = document.querySelector('[data-component="site-footer"]');
  if (footer && !footer.dataset.rendered) {
    footer.innerHTML = footerTemplate;
    footer.dataset.rendered = 'true';
  }
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const storeLink = footer?.querySelector('.footer-store');
  storeLink?.addEventListener('click', () => {
    trackEvent('cta_click', { id: 'footer_store', label: 'google_play', href: storeLink.href });
  });
}

function paintWhatsapp(page) {
  const current = document.getElementById('waFloat');
  if (page !== 'landing') {
    current?.remove();
    return;
  }

  if (current) return;

  const container = document.querySelector('[data-component="floating-whatsapp"]') || document.body;
  if (container === document.body) {
    document.body.insertAdjacentHTML('beforeend', whatsappTemplate);
  } else {
    container.innerHTML = whatsappTemplate;
  }

  const waAnchor = document.getElementById('waFloat');
  waAnchor?.addEventListener('click', () => {
    trackEvent('cta_click', { id: 'waFloat', label: 'whatsapp', href: waAnchor.href });
  });
}

function highlightActiveNav(page) {
  const navMap = {
    landing: 'navKnowApp',
    contacto: 'navContact',
    login: 'navLogin'
  };
  const activeId = navMap[page];
  if (!activeId) return;
  const link = document.getElementById(activeId);
  if (link) {
    link.classList.add('nav-link--active');
    link.setAttribute('aria-current', 'page');
  }
}

async function hydrateFromContent() {
  try {
    const res = await fetch('/content/landing.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('No se pudo cargar landing.json');
    const data = await res.json();

    const brandAnchor = document.getElementById('brand');
    const brandImg = brandAnchor?.querySelector('img');
    if (brandAnchor && data.brand) brandAnchor.title = data.brand;
    if (brandImg && data.brand) brandImg.alt = data.brand;

    const navKnowApp = document.getElementById('navKnowApp');
    if (navKnowApp && data.nav?.knowApp) navKnowApp.textContent = data.nav.knowApp;

    const navContact = document.getElementById('navContact');
    if (navContact && data.nav?.contact) navContact.textContent = data.nav.contact;

    const navLogin = document.getElementById('navLogin');
    if (navLogin && data.nav?.customerAccess) {
      navLogin.textContent = data.nav.customerAccess;
    }

    const number = data.contact?.whatsapp?.number;
    const message = data.contact?.whatsapp?.message || 'Hola';
    if (number) {
      const waLink = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
      const waAnchor = document.getElementById('waFloat');
      if (waAnchor) waAnchor.href = waLink;
    }
  } catch (err) {
    console.warn('[layout] No se pudo hidratar desde landing.json', err);
  } finally {
    updateLayoutMetrics();
  }
}

function applyLayout() {
  const page = document.body.dataset.page;
  paintHeader();
  renderNav(page);
  paintFooter();
  paintWhatsapp(page);
  highlightActiveNav(page);
  hydrateFromContent();
  updateLayoutMetrics();
  trackEvent('page_view', { page });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', applyLayout);
} else {
  applyLayout();
}

window.addEventListener('resize', updateLayoutMetrics);
