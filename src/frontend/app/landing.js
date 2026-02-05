import { observeReveal, observeAllReveals } from './reveal.js';

function $(sel) { return document.querySelector(sel); }
function setText(sel, value) { const el = $(sel); if (el && value != null) el.textContent = value; }
function setAttr(sel, name, value) { const el = $(sel); if (el && value != null) el.setAttribute(name, value); }
function setHref(sel, value) { const el = $(sel); if (el && value) el.setAttribute('href', value); }

function waLink(number, message) {
  const msg = encodeURIComponent(message || 'Hola');
  return `https://wa.me/${number}?text=${msg}`;
}

function makeFeatureCard({ icon, title, description }, index = 0) {
  const article = document.createElement('article');
  article.className = 'feature-card reveal';

  const isPath = typeof icon === 'string' && icon.includes('/');
  const iconContainer = document.createElement('div');
  if (isPath) {
    const img = document.createElement('img');
    img.className = 'feature-card__iconimg';
    img.src = icon;
    img.alt = '';
    iconContainer.appendChild(img);
  } else {
    const div = document.createElement('div');
    div.className = 'feature-card__icon';
    div.setAttribute('aria-hidden', 'true');
    div.textContent = icon || '';
    iconContainer.appendChild(div);
  }

  const h3 = document.createElement('h3');
  h3.textContent = title || '';
  const p = document.createElement('p');
  p.textContent = description || '';

  article.appendChild(iconContainer.firstChild);
  article.appendChild(h3);
  article.appendChild(p);
  article.style.transitionDelay = `${index * 80}ms`;
  observeReveal(article);
  return article;
}

function makeVideoCard({ id, title }, index = 0) {
  const article = document.createElement('article');
  article.className = 'video-card reveal';
  const src = id ? `https://www.youtube.com/embed/${id}` : '';
  article.innerHTML = `
    <div class="video-embed">
      <iframe class="video-frame" src="${src}" title="${title || ''}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
    </div>
    <h3></h3>
  `;
  article.querySelector('h3').textContent = title || '';
  article.style.transitionDelay = `${index * 100}ms`;
  observeReveal(article);
  return article;
}

async function loadContent() {
  try {
    const res = await fetch('/content/landing.json', { cache: 'no-cache' });
    const data = await res.json();

    // Brand y navegación
    // Marca: actualizar alt/title del logo sin sobreescribir la imagen
    setAttr('#brand', 'title', data.brand);
    const brandImg = document.querySelector('#brand img');
    if (brandImg && data.brand) brandImg.alt = data.brand;
    setText('#navKnowApp', data.nav?.knowApp);
    setText('#navContact', data.nav?.contact);
    setText('#navLogin', data.nav?.customerAccess);

    // Hero
    setText('#heroTitle', data.hero?.title);
    setText('#heroDesc', data.hero?.description);
    const hero = document.querySelector('.hero');
    if (hero && data.hero?.banner) {
      hero.classList.add('has-image');
      hero.style.setProperty('--hero-bg-image', `url('${data.hero.banner}')`);
    }

    // Features
    const fg = document.getElementById('featuresGrid');
    if (fg && Array.isArray(data.features)) {
      fg.innerHTML = '';
      data.features.forEach((f, i) => fg.appendChild(makeFeatureCard(f, i)));
    }

    // Formato de archivo para subir rutas
    setText('#sampleTitle', data.uploadSample?.title);
    setText('#sampleSubtitle', data.uploadSample?.subtitle);
    const sampleImage = document.getElementById('sampleImage');
    const samplePreview = document.getElementById('samplePreview');
    if (sampleImage) {
      if (data.uploadSample?.image) {
        sampleImage.src = data.uploadSample.image;
        sampleImage.alt = data.uploadSample.imageAlt || data.uploadSample.title || '';
        sampleImage.hidden = false;
      } else {
        sampleImage.hidden = true;
      }
    }
    if (samplePreview) {
      if (data.uploadSample?.image) {
        samplePreview.hidden = true;
      } else {
        samplePreview.textContent = data.uploadSample?.preview || '';
        samplePreview.hidden = !data.uploadSample?.preview;
      }
    }

    // App overview
    setText('#appTitle', data.app?.title);
    setText('#appSubtitle', data.app?.subtitle);
    const vg = document.getElementById('videoGrid');
    if (vg && Array.isArray(data.app?.videos)) {
      vg.innerHTML = '';
      data.app.videos.forEach((v, i) => vg.appendChild(makeVideoCard(v, i)));
    }

    // Contacto
    setText('#contactTitle', data.contact?.title);
    setText('#contactSubtitle', data.contact?.subtitle);
    setText('#contactCta', data.contact?.ctaText);
    const number = data.contact?.whatsapp?.number;
    const message = data.contact?.whatsapp?.message;
    const link = number ? waLink(number, message) : '#';
    setHref('#contactCta', link);
    setHref('#waFloat', link);

    // Asegurar que todo lo que tenga .reveal se observe (por si cambió el DOM)
    observeAllReveals();
  } catch (e) {
    console.error('No se pudo cargar landing.json', e);
  }
}

document.addEventListener('DOMContentLoaded', loadContent);
