import { showPopup } from './ui.js';

function $(sel) { return document.querySelector(sel); }
function setText(sel, v) { const el = $(sel); if (el && v != null) el.textContent = v; }
function setPlaceholder(sel, v) { const el = $(sel); if (el && v != null) el.setAttribute('placeholder', v); }
function setAttr(sel, name, value) { const el = $(sel); if (el && value != null) el.setAttribute(name, value); }

function encodeMailtoBody(lines) {
  return encodeURIComponent(lines.join('\n'));
}

async function sendFormspree(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error('Formspree error');
}

async function onSubmit(config) {
  const name = $('#name').value.trim();
  const email = $('#email').value.trim();
  const company = $('#company').value.trim();
  const subject = $('#subject').value.trim();
  const message = $('#message').value.trim();

  if (!name || !email || !subject || !message) {
    showPopup('Completa los campos obligatorios: Nombre, Email, Asunto y Mensaje.');
    return;
  }

  const emailRegex = /.+@.+\..+/;
  if (!emailRegex.test(email)) {
    showPopup('Ingresa un email válido.');
    return;
  }

  const payload = { name, email, company, subject, message, source: 'Testados Contacto' };

  try {
    if (config.method === 'formspree' && config.formspreeEndpoint) {
      await sendFormspree(config.formspreeEndpoint, payload);
      showPopup(config.successMessage || 'Mensaje enviado. ¡Gracias!');
      $('#contactForm').reset();
      return;
    }
  } catch (e) {
    console.error('Error enviando con Formspree', e);
    showPopup(config.errorMessage || 'No se pudo enviar el mensaje.');
    return;
  }

  // Fallback MAILTO
  const to = config.recipient || 'contacto@ejemplo.com';
  const body = encodeMailtoBody([
    `Nombre: ${name}`,
    `Email: ${email}`,
    company ? `Empresa: ${company}` : '',
    '',
    message
  ].filter(Boolean));
  const url = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${body}`;
  window.location.href = url;
}

async function init() {
  try {
    const res = await fetch('/content/contacto.json', { cache: 'no-cache' });
    const cfg = await res.json();

    // Header: actualizar alt/title del logo sin reemplazar la imagen
    setAttr('#brand', 'title', cfg.brand || 'Testados');
    const brandImg = document.querySelector('#brand img');
    if (brandImg && (cfg.brand || 'Testados')) brandImg.alt = cfg.brand || 'Testados';

    // Textos
    setText('#pageTitle', cfg.title);
    setText('#pageSubtitle', cfg.subtitle);
    setText('#labelName', cfg.fields?.name?.label);
    setText('#labelEmail', cfg.fields?.email?.label);
    setText('#labelCompany', cfg.fields?.company?.label);
    setText('#labelSubject', cfg.fields?.subject?.label);
    setText('#labelMessage', cfg.fields?.message?.label);
    setPlaceholder('#name', cfg.fields?.name?.placeholder);
    setPlaceholder('#email', cfg.fields?.email?.placeholder);
    setPlaceholder('#company', cfg.fields?.company?.placeholder);
    setPlaceholder('#subject', cfg.fields?.subject?.placeholder);
    setPlaceholder('#message', cfg.fields?.message?.placeholder);
    setText('#sendBtn', cfg.buttonText || 'Enviar');

    // Marcar elementos revelables
    document.querySelector('#pageTitle')?.classList.add('reveal');
    document.querySelector('#pageSubtitle')?.classList.add('reveal');
    document.querySelector('.contact-wrapper')?.classList.add('reveal');
    observeAllReveals();

    // Submit
    $('#contactForm').addEventListener('submit', (e) => {
      e.preventDefault();
      onSubmit(cfg);
    });
import { observeReveal, observeAllReveals } from './reveal.js';
  } catch (e) {
    console.error('No se pudo cargar contacto.json', e);
  }
}

document.addEventListener('DOMContentLoaded', init);
