// Visualização compartilhada pelo CTF e pelo terminal de prática:
// modo celular (abas), tamanho da fonte, teclado virtual e barra de teclas.

import { shouldUseMobile, clampFont } from './ui.js';

const $ = (sel) => document.querySelector(sel);

function loadUi(key) {
  try { return JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { return {}; }
}
function saveUi(key, ui) {
  try { localStorage.setItem(key, JSON.stringify(ui)); } catch (e) { /* navegação privada */ }
}

// app precisa de: term (Terminal). Define app.mobile e app.setTab.
export function setupView(app, { uiKey = 'pinguim-ctf-ui' } = {}) {
  const ui = loadUi(uiKey);
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const applyFont = () => {
    document.documentElement.style.setProperty('--term-font', clampFont(ui.font || (app.mobile ? 13 : 14.5)) + 'px');
  };
  const setTab = (tab) => {
    document.body.dataset.tab = tab || '';
    for (const b of document.querySelectorAll('#mtabs button')) b.classList.toggle('active', b.dataset.tab === tab);
    if (tab === 'terminal' || !tab) setTimeout(() => { app.term.scrollToEnd(); app.term.focus(); }, 0);
  };
  const setMobile = (on) => {
    app.mobile = on;
    document.body.classList.toggle('mobile-mode', on);
    $('#btn-mobile').setAttribute('aria-pressed', String(on));
    $('#btn-mobile span').textContent = on ? 'Modo computador' : 'Modo celular';
    setTab(on ? 'terminal' : null);
    applyFont();
  };
  app.setTab = setTab;
  $('#btn-mobile').addEventListener('click', () => { ui.mobile = !app.mobile; saveUi(uiKey, ui); setMobile(ui.mobile); });
  $('#font-down').addEventListener('click', () => { ui.font = clampFont((ui.font || (app.mobile ? 13 : 14.5)) - 1); saveUi(uiKey, ui); applyFont(); });
  $('#font-up').addEventListener('click', () => { ui.font = clampFont((ui.font || (app.mobile ? 13 : 14.5)) + 1); saveUi(uiKey, ui); applyFont(); });
  for (const b of document.querySelectorAll('#mtabs button')) b.addEventListener('click', () => setTab(b.dataset.tab));
  // no celular, o teclado virtual encolhe a tela: o terminal acompanha a área visível
  if (window.visualViewport) {
    const fit = () => document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
    window.visualViewport.addEventListener('resize', fit);
    fit();
  }
  setMobile(shouldUseMobile({ saved: ui.mobile, width: window.innerWidth, coarse }));
}

export function setupKeybar(term) {
  for (const b of document.querySelectorAll('#keybar button')) {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => term.virtualKey(b.dataset.key));
  }
}
