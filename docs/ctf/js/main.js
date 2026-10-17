// Liga o terminal (DOM) ao shell simulado e ao jogo.

import { Terminal } from './terminal.js';
import { Shell } from './shell/interpreter.js';
import { commands } from './shell/commands.js';
import { buildSystem } from './shell/system.js';
import { VFS } from './shell/vfs.js';
import { C } from './shell/util.js';
import { CtfGame, LEVELS } from './ctf/game.js';
import { buildCtf } from './ctf/world.js';
import { shouldUseMobile, clampFont, hintIndex, hintView } from './ui.js';

const STORAGE_KEY = 'pinguim-ctf-v1';
const UI_KEY = 'pinguim-ctf-ui'; // preferências de visualização (não são apagadas ao reiniciar o CTF)
const $ = (sel) => document.querySelector(sel);

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch (e) { return null; }
}

let saveTimer = null;
function scheduleSave(app) {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => saveNow(app), 400);
}
function saveNow(app) {
  const data = {
    nick: app.game.nick,
    state: app.game.state,
    history: app.term.history.slice(-200),
    cwd: app.shell.cwd,
  };
  try { data.vfs = app.shell.vfs.serialize(); } catch (e) { /* ignora */ }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch (e) {
    // sem espaço: salva pelo menos o progresso
    try { delete data.vfs; localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e2) { /* navegação privada */ }
  }
}

function freshVfs(nick) {
  const vfs = buildSystem();
  buildCtf(vfs, '/home/aluno', nick);
  return vfs;
}

function start(nick, saved) {
  $('#start').hidden = true;
  $('#app').hidden = false;

  let vfs = null;
  if (saved && saved.vfs) {
    try { vfs = VFS.deserialize(saved.vfs); } catch (e) { vfs = null; }
  }
  if (!vfs) vfs = freshVfs(nick);

  const app = {};
  const term = new Terminal($('#terminal'), {
    onTab: (line) => app.shell.complete(line),
    onInterrupt: () => app.shell.interrupt(),
  });
  if (saved && saved.history) term.history = saved.history.slice();

  const io = {
    write: (s) => term.write(s),
    writeErr: (s) => term.write(s),
    readLine: (prompt) => term.readLine(prompt, { history: false }),
    edit: (opts) => term.edit(opts),
    clear: () => term.clear(),
    get columns() { return term.columns; },
  };
  const shell = new Shell({ vfs, io, commands });
  shell.history = term.history;
  if (saved && saved.cwd && vfs.exists(saved.cwd)) shell.setCwd(saved.cwd);

  const game = new CtfGame(nick, saved && saved.state, () => { renderPanel(app); scheduleSave(app); });
  game.install(shell);
  Object.assign(app, { term, shell, game });
  window.__ctf = app; // útil para depuração no console

  renderPanel(app);
  setupPanel(app);
  setupHints(app);
  setupKeybar(term);
  setupView(app);

  term.write(C.bcyan + 'PinguimOS 24.04 LTS · terminal simulado no navegador' + C.reset + '\n');
  term.write(C.gray + 'Os comandos funcionam como no bash de verdade. Digite "help" para ver a lista.' + C.reset + '\n');
  term.write(saved ? 'Bem-vindo(a) de volta, ' + C.byellow + nick + C.reset + '! Seu progresso foi restaurado.\n\n'
    : 'Olá, ' + C.byellow + nick + C.reset + '! Comece com:  ' + C.bold + 'cat ~/ctf/LEIA-ME.txt' + C.reset + '\n\n');

  repl(app);
}

async function repl(app) {
  const { term, shell } = app;
  while (true) {
    let src = await term.readLine(shell.prompt());
    if (src === null) continue;
    while (shell.isIncomplete(src)) {
      const more = await term.readLine('> ', { history: false });
      if (more === null) { src = null; break; }
      src += '\n' + more;
    }
    if (src === null || !src.trim()) continue;
    await shell.run(src, { history: false });
    scheduleSave(app);
  }
}

// ---------- painel lateral ----------
function renderPanel(app) {
  const g = app.game;
  $('#nick').textContent = g.nick;
  $('#score').textContent = g.score() + ' / ' + g.maxScore();
  $('#solved').textContent = g.solvedCount() + ' / ' + LEVELS.length;
  $('#progress-bar').style.width = (100 * g.solvedCount() / LEVELS.length) + '%';
  const list = $('#levels');
  list.innerHTML = '';
  for (const l of LEVELS) {
    const li = document.createElement('li');
    li.className = 'level' + (g.isSolved(l.id) ? ' done' : '');
    const status = g.isSolved(l.id) ? '✔' : String(l.id);
    li.innerHTML =
      '<span class="lv-badge" aria-hidden="true"></span>' +
      '<div class="lv-info"><div class="lv-title"></div><div class="lv-skill"></div></div>' +
      '<div class="lv-side"><span class="lv-pts"></span><button type="button" class="lv-hint">Dica</button></div>';
    li.querySelector('.lv-badge').textContent = status;
    li.querySelector('.lv-title').textContent = 'Nível ' + l.id + ' · ' + l.title;
    li.querySelector('.lv-skill').textContent = l.skill;
    li.querySelector('.lv-pts').textContent = (g.isSolved(l.id) ? g.levelScore(l.id) : 0) + '/' + l.points + ' pts';
    const used = g.hintsUsed(l.id);
    const btn = li.querySelector('.lv-hint');
    btn.textContent = used ? 'Dica (' + used + '/' + l.hints.length + ')' : 'Dica';
    btn.setAttribute('aria-label', 'Mostrar dica do nível ' + l.id);
    btn.addEventListener('click', () => showHint(app, l.id));
    list.append(li);
  }
  const done = $('#done');
  done.hidden = !g.allSolved();
  if (g.allSolved()) $('#done-code').textContent = g.completionCode();
  $('#mt-solved').textContent = g.solvedCount() + '/' + LEVELS.length;
  if (app.hintView && !$('#hint-box').hidden) renderHint(app);
}

// ---------- visualizador de dicas (navegável) ----------
// Clicar em "Dica" abre o visualizador. Se nenhuma dica foi liberada, libera a primeira.
// As já liberadas podem ser revistas à vontade; liberar a próxima é uma ação explícita.
function showHint(app, id) {
  const g = app.game;
  if (!g.unlockedHints(id).length) g.hint(id);
  app.hintView = { level: id, index: g.unlockedHints(id).length - 1 };
  renderHint(app);
  const box = $('#hint-box');
  box.hidden = false;
  if (box.scrollIntoView) box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function renderHint(app) {
  const hv = app.hintView;
  if (!hv) return;
  const g = app.game;
  const level = LEVELS.find((l) => l.id === hv.level);
  const unlocked = g.unlockedHints(hv.level);
  const v = hintView({ index: hv.index, unlocked: unlocked.length, total: level.hints.length, solved: g.nextHintFree(hv.level) });
  hv.index = v.index;
  const box = $('#hint-box');
  box.querySelector('.hint-title').textContent = 'Nível ' + level.id + ' · ' + level.title;
  const textEl = box.querySelector('.hint-text');
  if (textEl.textContent !== (unlocked[v.index] || '')) {
    textEl.textContent = unlocked[v.index] || '';
    textEl.classList.remove('anim');
    void textEl.offsetWidth; // reinicia a animação a cada troca de dica
    textEl.classList.add('anim');
  }
  box.querySelector('.hint-count').textContent = 'Dica ' + (v.index + 1) + ' de ' + level.hints.length;
  box.querySelector('.hint-dots').innerHTML = v.dots.map((d, i) => '<span class="hd hd-' + d + '" title="Dica ' + (i + 1) + '"></span>').join('');
  $('#hint-prev').disabled = !v.canPrev;
  $('#hint-next').disabled = !v.canNext;
  const reveal = $('#hint-reveal');
  reveal.hidden = !v.canReveal;
  reveal.textContent = 'Liberar dica ' + (unlocked.length + 1) + (v.revealFree ? ' (grátis: nível resolvido)' : ' (−25% dos pontos do nível)');
}

function setupHints(app) {
  $('#hint-prev').addEventListener('click', () => { app.hintView.index = hintIndex(app.hintView.index, -1, app.game.unlockedHints(app.hintView.level).length); renderHint(app); });
  $('#hint-next').addEventListener('click', () => { app.hintView.index = hintIndex(app.hintView.index, 1, app.game.unlockedHints(app.hintView.level).length); renderHint(app); });
  $('#hint-reveal').addEventListener('click', () => {
    const id = app.hintView.level;
    app.game.hint(id);
    app.hintView.index = app.game.unlockedHints(id).length - 1;
    renderHint(app);
  });
}

// ---------- modo celular ----------
function loadUi() {
  try { return JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch (e) { return {}; }
}
function saveUi(ui) {
  try { localStorage.setItem(UI_KEY, JSON.stringify(ui)); } catch (e) { /* navegação privada */ }
}

function setupView(app) {
  const ui = loadUi();
  const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  const applyFont = () => {
    document.documentElement.style.setProperty('--term-font', clampFont(ui.font || (app.mobile ? 13 : 14.5)) + 'px');
  };
  const setMobile = (on) => {
    app.mobile = on;
    document.body.classList.toggle('mobile-mode', on);
    $('#btn-mobile').setAttribute('aria-pressed', String(on));
    $('#btn-mobile span').textContent = on ? 'Modo computador' : 'Modo celular';
    setTab(on ? 'terminal' : null);
    applyFont();
  };
  const setTab = (tab) => {
    document.body.dataset.tab = tab || '';
    for (const b of document.querySelectorAll('#mtabs button')) b.classList.toggle('active', b.dataset.tab === tab);
    if (tab === 'terminal' || !tab) setTimeout(() => { app.term.scrollToEnd(); app.term.focus(); }, 0);
  };
  app.setTab = setTab;
  $('#btn-mobile').addEventListener('click', () => { ui.mobile = !app.mobile; saveUi(ui); setMobile(ui.mobile); });
  $('#font-down').addEventListener('click', () => { ui.font = clampFont((ui.font || (app.mobile ? 13 : 14.5)) - 1); saveUi(ui); applyFont(); });
  $('#font-up').addEventListener('click', () => { ui.font = clampFont((ui.font || (app.mobile ? 13 : 14.5)) + 1); saveUi(ui); applyFont(); });
  for (const b of document.querySelectorAll('#mtabs button')) b.addEventListener('click', () => setTab(b.dataset.tab));
  // no celular, o teclado virtual encolhe a tela: o terminal acompanha a área visível
  if (window.visualViewport) {
    const fit = () => document.documentElement.style.setProperty('--vvh', window.visualViewport.height + 'px');
    window.visualViewport.addEventListener('resize', fit);
    fit();
  }
  setMobile(shouldUseMobile({ saved: ui.mobile, width: window.innerWidth, coarse }));
}

function setupPanel(app) {
  const form = $('#submit-form');
  const input = $('#flag-input');
  const fb = $('#submit-feedback');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const r = app.game.submit(input.value);
    fb.textContent = (r.ok ? '✔ ' : '✘ ') + r.message;
    fb.className = 'feedback ' + (r.ok ? 'ok' : 'err');
    if (r.ok) input.value = '';
    app.term.focus();
  });
  $('#hint-close').addEventListener('click', () => { $('#hint-box').hidden = true; app.hintView = null; if (!app.mobile) app.term.focus(); });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Reiniciar o CTF? Seu progresso e os arquivos que você criou serão apagados.')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
    location.reload();
  });
  $('#btn-nick').addEventListener('click', () => {
    if (!confirm('Trocar de codinome? As flags mudam e o progresso atual será apagado.')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
    location.reload();
  });
  window.addEventListener('beforeunload', () => saveNow(app));
}

function setupKeybar(term) {
  for (const b of document.querySelectorAll('#keybar button')) {
    b.addEventListener('mousedown', (e) => e.preventDefault());
    b.addEventListener('click', () => term.virtualKey(b.dataset.key));
  }
}

// ---------- tela inicial ----------
function init() {
  const saved = load();
  if (saved && saved.nick) { start(saved.nick, saved); return; }
  const form = $('#start-form');
  const input = $('#nick-input');
  input.focus();
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const nick = input.value.trim().replace(/\s+/g, ' ').slice(0, 24);
    if (!nick) { input.focus(); return; }
    start(nick, null);
  });
}

init();
