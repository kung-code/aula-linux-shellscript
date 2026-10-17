import { clampIndex, parseHash, formatTime, copyText, highlightBash, navNext, navPrev, escapeHtml } from './deck.js';
import { TerminalPlayer, ScriptPlayer, LayersDiagram, PermBuilder, icon } from './players.js';
import { runDemos, makeDemoIo } from './demo-runner.js';
import { buildSystem } from '../ctf/js/shell/system.js';
import { Shell } from '../ctf/js/shell/interpreter.js';
import { commands } from '../ctf/js/shell/commands.js';

const deck = document.getElementById('deck');
const slides = Array.from(document.querySelectorAll('.slide'));
const total = slides.length;
const bar = document.getElementById('bar');
const counter = document.getElementById('counter');
const stepHint = document.getElementById('step-hint');
const notesPanel = document.getElementById('notes-panel');
let current = -1;
let showNotes = false;

// ---------- artes (templates SVG) ----------
for (const host of document.querySelectorAll('[data-art]')) {
  const tpl = document.getElementById('art-' + host.dataset.art);
  if (tpl) host.append(tpl.content.cloneNode(true));
}

// ---------- componentes ----------
const steppables = slides.map(() => []);
const register = (comp) => {
  const idx = slides.indexOf(comp.el.closest('.slide'));
  if (idx >= 0) steppables[idx].push(comp);
};

const specs = [];
const targets = [];
for (const pre of document.querySelectorAll('pre[data-demo]')) {
  const kind = pre.dataset.demo;
  const text = pre.querySelector('code').textContent;
  specs.push({ kind, text, name: pre.dataset.name, input: pre.dataset.input });
  if (kind === 'cmds') { const p = new TerminalPlayer(pre); targets.push(p); register(p); }
  else if (kind === 'script') { const p = new ScriptPlayer(pre); targets.push(p); register(p); }
  else targets.push(null); // 'file': continua como código estático
}

for (const host of document.querySelectorAll('.layers-diagram')) register(new LayersDiagram(host));
for (const host of document.querySelectorAll('.perm-builder')) new PermBuilder(host);

// Código estático: realce + copiar + nome do arquivo
for (const pre of document.querySelectorAll('pre.code')) {
  const code = pre.querySelector('code');
  const raw = code.textContent;
  code.innerHTML = highlightBash(raw);
  if (pre.dataset.name) pre.insertAdjacentHTML('afterbegin', '<div class="code-name">' + icon('i-file') + escapeHtml(pre.dataset.name) + '</div>');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'copy';
  btn.innerHTML = icon('i-copy') + '<span>Copiar</span>';
  btn.setAttribute('aria-label', 'Copiar código');
  btn.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(copyText(raw)); btn.classList.add('ok'); } catch (e) { btn.classList.add('err'); }
    setTimeout(() => btn.classList.remove('ok', 'err'), 1200);
  });
  pre.append(btn);
}

// Gera a saída real de todos os exemplos no shell simulado (mesmo motor do CTF)
(async () => {
  const io = makeDemoIo({ columns: 64 });
  const shell = new Shell({ vfs: buildSystem(), io, commands });
  const results = await runDemos(specs, shell, io);
  results.forEach((r, i) => { if (targets[i]) targets[i].setResult(r); });
  updateHud();
})();

// ---------- revelação escalonada do texto ----------
const REVEAL_SEL = [
  ':scope > :not(.notes):not(.two):not(.grid):not(.agenda):not(.flow):not(.cards)',
  ':scope > .two > *', ':scope > .cards > *', '.grid > *', '.agenda > *', '.flow > *',
  '.bullets > li', '.steps > li', '.poll > li', '.tbl tr', '.tree .tl', '.reveal-item',
].join(',');
for (const s of slides) {
  Array.from(s.querySelectorAll(REVEAL_SEL)).forEach((el, i) => {
    el.classList.add('rv');
    el.style.setProperty('--d', String(Math.min(i, 18) * 70));
  });
}

// ---------- navegação ----------
function go(i, { dir = 1, complete = false } = {}) {
  i = clampIndex(i, total);
  if (i === current) return;
  deck.style.setProperty('--dir', String(dir));
  const prev = slides[current];
  if (prev) {
    prev.classList.remove('active', 'revealed');
    prev.classList.add('leaving');
    setTimeout(() => prev.classList.remove('leaving'), 700);
    for (const c of steppables[current]) if (c.stopAuto) c.stopAuto();
  }
  current = i;
  const s = slides[current];
  s.classList.remove('leaving');
  s.scrollTop = 0;
  for (const c of steppables[current]) (complete ? c.complete() : c.reset());
  s.classList.add('active');
  void s.offsetWidth;
  s.classList.add('revealed');
  bar.style.width = ((current + 1) / total) * 100 + '%';
  counter.textContent = current + 1 + ' / ' + total;
  document.title = (s.dataset.title ? s.dataset.title + ' · ' : '') + 'Linux & Shell Script';
  history.replaceState(null, '', '#/' + (current + 1));
  renderNotes();
  updateHud();
}

function states() { return steppables[current].map((c) => ({ step: c.step, total: c.total })); }

async function nextAction() {
  const k = navNext(states());
  if (k >= 0) {
    const c = steppables[current][k];
    if (c.stopAuto) c.stopAuto();
    const p = c.next();
    updateHud();
    await p;
    updateHud();
  } else go(current + 1, { dir: 1 });
}

function prevAction() {
  const k = navPrev(states());
  if (k >= 0) { steppables[current][k].prev(); updateHud(); }
  else if (current > 0) go(current - 1, { dir: -1, complete: true });
}

function updateHud() {
  const pending = steppables[current] ? steppables[current].find((c) => c.step < c.total) : null;
  if (pending) {
    stepHint.hidden = false;
    stepHint.innerHTML = icon('i-step-next') + '<span>passo ' + pending.step + '/' + pending.total + '</span>';
  } else stepHint.hidden = true;
}

function renderNotes() {
  notesPanel.hidden = !showNotes;
  if (!showNotes) return;
  const n = slides[current].querySelector('.notes');
  const next = slides[current + 1];
  notesPanel.innerHTML = '';
  const h = document.createElement('b');
  h.textContent = 'Notas do professor';
  const p = document.createElement('p');
  p.textContent = n ? n.textContent : '(sem notas neste slide)';
  const nx = document.createElement('p');
  nx.className = 'next';
  nx.textContent = next ? 'Próximo: ' + (next.dataset.title || '') : 'Último slide';
  notesPanel.append(h, p, nx);
}

document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  switch (e.key) {
    case 'ArrowRight': case 'PageDown': case ' ': case 'Enter':
      e.preventDefault();
      if (e.shiftKey) go(current + 1, { dir: 1 }); else nextAction();
      break;
    case 'ArrowLeft': case 'PageUp': case 'Backspace':
      e.preventDefault();
      if (e.shiftKey) go(current - 1, { dir: -1, complete: true }); else prevAction();
      break;
    case 'Home': go(0, { dir: -1 }); break;
    case 'End': go(total - 1, { dir: 1 }); break;
    case 'n': case 'N': showNotes = !showNotes; renderNotes(); break;
    case 'f': case 'F': toggleFullscreen(); break;
    case 'p': case 'P': {
      const c = steppables[current].find((x) => x.toggleAuto);
      if (c) c.toggleAuto();
      break;
    }
    case 't': case 'T': {
      const t = slides[current].querySelector('.timer');
      if (t && t.toggle) t.toggle();
      break;
    }
  }
});
document.getElementById('prev').addEventListener('click', prevAction);
document.getElementById('next').addEventListener('click', nextAction);
document.getElementById('toggle-notes').addEventListener('click', () => { showNotes = !showNotes; renderNotes(); });
document.getElementById('fullscreen').addEventListener('click', toggleFullscreen);
window.addEventListener('hashchange', () => {
  const i = parseHash(location.hash, total);
  if (i !== current) go(i, { dir: i > current ? 1 : -1 });
});

let touchX = null;
document.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
document.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 60) (dx < 0 ? nextAction() : prevAction());
  touchX = null;
});

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
}

// ---------- cronômetros dos exercícios ----------
for (const el of document.querySelectorAll('.timer')) {
  const totalSec = parseInt(el.dataset.seconds, 10) || 300;
  let left = totalSec;
  let handle = null;
  const R = 52;
  const C = 2 * Math.PI * R;
  el.innerHTML =
    '<div class="timer-dial"><svg class="timer-ring" viewBox="0 0 120 120" aria-hidden="true"><circle class="tr-bg" cx="60" cy="60" r="' + R + '"/>' +
    '<circle class="tr-fg" cx="60" cy="60" r="' + R + '" stroke-dasharray="' + C + '" stroke-dashoffset="0"/></svg>' +
    '<div class="timer-time" role="timer"></div></div>' +
    '<div class="timer-btns"><button type="button" class="t-start">' + icon('i-play') + '<span>Iniciar</span></button>' +
    '<button type="button" class="t-reset" aria-label="Zerar">' + icon('i-replay') + '</button></div>';
  const time = el.querySelector('.timer-time');
  const start = el.querySelector('.t-start');
  const ring = el.querySelector('.tr-fg');
  const render = () => {
    time.textContent = left > 0 ? formatTime(left) : 'Tempo!';
    ring.style.strokeDashoffset = String(C * (1 - left / totalSec));
    el.classList.toggle('ending', left > 0 && left <= 30);
    el.classList.toggle('over', left <= 0);
  };
  const setBtn = (running) => { start.innerHTML = icon(running ? 'i-pause' : 'i-play') + '<span>' + (running ? 'Pausar' : 'Iniciar') + '</span>'; };
  const stop = () => { clearInterval(handle); handle = null; setBtn(false); };
  el.toggle = () => {
    if (handle) { stop(); return; }
    if (left <= 0) left = totalSec;
    setBtn(true);
    const end = Date.now() + left * 1000;
    handle = setInterval(() => {
      left = Math.max(0, (end - Date.now()) / 1000);
      render();
      if (left <= 0) stop();
    }, 200);
  };
  start.addEventListener('click', el.toggle);
  el.querySelector('.t-reset').addEventListener('click', () => { stop(); left = totalSec; render(); });
  render();
}

go(parseHash(location.hash, total));
