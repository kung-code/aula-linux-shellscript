// Terminal de prática: o mesmo shell simulado do CTF, sem jogo, para acompanhar a aula.

import { Terminal } from '../../ctf/js/terminal.js';
import { Shell } from '../../ctf/js/shell/interpreter.js';
import { commands } from '../../ctf/js/shell/commands.js';
import { buildSystem } from '../../ctf/js/shell/system.js';
import { VFS } from '../../ctf/js/shell/vfs.js';
import { C } from '../../ctf/js/shell/util.js';
import { setupView, setupKeybar } from '../../ctf/js/view.js';
import { ROTEIRO as TODO_ROTEIRO, DESAFIOS } from './roteiro.js';
import { AULA, AULAS } from '../../aula.js';

// só os comandos da aula atual
const ROTEIRO = TODO_ROTEIRO.filter((s) => s.aula === AULA);

const STORAGE_KEY = 'pinguim-terminal-v1';
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
  const data = { history: app.term.history.slice(-200), cwd: app.shell.cwd, done: app.done };
  try { data.vfs = app.shell.vfs.serialize(); } catch (e) { /* ignora */ }
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* navegação privada */ }
}

function start() {
  const saved = load();
  let vfs = null;
  if (saved && saved.vfs) {
    try { vfs = VFS.deserialize(saved.vfs); } catch (e) { vfs = null; }
  }
  if (!vfs) vfs = buildSystem();

  const app = { done: (saved && saved.done) || {} };
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
  Object.assign(app, { term, shell });
  window.__lab = app;

  renderRoteiro(app);
  renderDesafio();
  setupKeybar(term);
  setupView(app, { uiKey: 'pinguim-ctf-ui' });
  $('#btn-reset').addEventListener('click', () => {
    if (!confirm('Reiniciar o terminal? Os arquivos que você criou e o histórico serão apagados.')) return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignora */ }
    location.reload();
  });
  window.addEventListener('beforeunload', () => saveNow(app));

  term.write(C.bcyan + 'PinguimOS 24.04 LTS · terminal de prática · Aula ' + AULA + ': ' + AULAS[AULA].titulo + C.reset + '\n');
  term.write(C.gray + 'Simulador no navegador: os comandos funcionam como no bash. Digite "help" para ver a lista.' + C.reset + '\n');
  term.write(saved ? 'Seus arquivos e o histórico foram restaurados.\n\n'
    : 'Acompanhe a aula digitando aqui. Comece com: ' + C.bold + 'pwd' + C.reset + '\n\n');
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
    markDone(app, src.trim());
    scheduleSave(app);
  }
}

// Marca no roteiro os comandos que o aluno já executou
function markDone(app, src) {
  let changed = false;
  for (const sec of ROTEIRO) for (const c of sec.cmds) if (c === src && !app.done[c]) { app.done[c] = true; changed = true; }
  if (changed) renderRoteiro(app);
}

function renderDesafio() {
  const d = DESAFIOS[AULA];
  const card = $('#desafio');
  if (!d || !card) return;
  card.hidden = false;
  $('#desafio-titulo').textContent = d.titulo;
  const ol = $('#desafio-passos');
  ol.innerHTML = '';
  for (const p of d.passos) { const li = document.createElement('li'); li.textContent = p; ol.append(li); }
  $('#desafio-entrega').textContent = d.entrega;
}

function renderRoteiro(app) {
  const host = $('#roteiro');
  const total = ROTEIRO.reduce((n, s) => n + s.cmds.length, 0);
  const feitos = ROTEIRO.reduce((n, s) => n + s.cmds.filter((c) => app.done[c]).length, 0);
  $('#roteiro-count').textContent = feitos + '/' + total;
  host.innerHTML = '';
  ROTEIRO.forEach((sec, si) => {
    const det = document.createElement('details');
    det.className = 'rt-sec';
    const doneSec = sec.cmds.every((c) => app.done[c]);
    if (!doneSec && !host.querySelector('details[open]')) det.open = true;
    const sum = document.createElement('summary');
    sum.innerHTML = '<span class="rt-num"></span><span class="rt-title"></span><span class="rt-prog"></span>';
    sum.querySelector('.rt-num').textContent = String(si + 1);
    sum.querySelector('.rt-title').textContent = sec.title;
    sum.querySelector('.rt-prog').textContent = sec.cmds.filter((c) => app.done[c]).length + '/' + sec.cmds.length;
    if (doneSec) det.classList.add('done');
    det.append(sum);
    const list = document.createElement('div');
    list.className = 'rt-cmds';
    for (const c of sec.cmds) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'rt-cmd' + (app.done[c] ? ' done' : '');
      b.textContent = c;
      b.title = 'Colocar no terminal (depois aperte Enter)';
      b.addEventListener('click', () => {
        if (app.setTab && app.mobile) app.setTab('terminal');
        app.term.setInput(c);
        app.term.focus();
      });
      list.append(b);
    }
    det.append(list);
    host.append(det);
  });
}

start();
