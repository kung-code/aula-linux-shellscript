// Página de preparação pré-aula: visuais interativos + terminais simulados embutidos.
// Nada é salvo: sem progresso, sem respostas, sem cadastro.

import { Terminal } from '../../docs/ctf/js/terminal.js';
import { Shell } from '../../docs/ctf/js/shell/interpreter.js';
import { commands } from '../../docs/ctf/js/shell/commands.js';
import { buildSystem } from '../../docs/ctf/js/shell/system.js';
import { C } from '../../docs/ctf/js/shell/util.js';
import { LAYERS, JOURNEY } from '../../docs/slides/layers.js';
import { permString, permOctal, octalToBits, escapeHtml } from '../../docs/slides/deck.js';
import { splitWords, resolveSteps, STREAM_SCENARIOS, streamRoute } from './logic.js';
import { GLOSSARIO, setupPrepFiles } from './content.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, REDUCED ? 0 : ms));
const $ = (sel, root = document) => root.querySelector(sel);
const icon = (name) => '<svg class="i" aria-hidden="true"><use href="#' + name + '"/></svg>';

// ---------- máquina simulada compartilhada pelos terminais da página ----------
const vfs = buildSystem();
setupPrepFiles(vfs, '/home/aluno');

function mountTerminal(host) {
  const cmds = host.dataset.cmds.split('||');
  host.innerHTML =
    '<div class="mt-chrome" aria-hidden="true"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span>Experimente: toque num comando e aperte Enter</span></div>' +
    '<div class="mt-chips"></div>' +
    '<div class="mt-holder"><div class="mt-term"></div></div>';
  const chips = $('.mt-chips', host);
  const term = new Terminal($('.mt-term', host), {
    onTab: (line) => shell.complete(line),
    onInterrupt: () => shell.interrupt(),
  });
  const io = {
    write: (s) => term.write(s),
    writeErr: (s) => term.write(s),
    readLine: (p) => term.readLine(p, { history: false }),
    edit: (opts) => term.edit(opts),
    clear: () => term.clear(),
    get columns() { return term.columns; },
  };
  const shell = new Shell({ vfs, io, commands });
  shell.history = term.history;
  for (const c of cmds) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'mt-chip';
    b.textContent = c;
    b.addEventListener('click', () => { term.setInput(c); term.focus(); });
    chips.append(b);
  }
  term.write(C.gray + 'Terminal simulado. Os comandos funcionam como no Linux de verdade.' + C.reset + '\n');
  (async () => {
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
    }
  })();
}

// ---------- diagrama das camadas ----------
function mountLayers(host) {
  let step = 0;
  host.innerHTML =
    '<div class="ly-stack">' + LAYERS.map((l) =>
      '<button type="button" class="ly ly-' + l.id + '" data-id="' + l.id + '">' + icon(l.icon) +
      '<span><b>' + l.name + '</b><small>' + l.sub + '</small></span></button>' +
      (l.id === 'apps' ? '<div class="ly-sys"><span>chamadas de sistema</span></div>' : '')).join('') +
      '<div class="ly-token" aria-hidden="true">ls -l</div>' +
    '</div>' +
    '<div class="ly-side"><div class="ly-panel" aria-live="polite"></div>' +
    '<div class="ctrl"><button type="button" data-act="prev">‹ Voltar</button><span class="ctrl-n"></span><button type="button" data-act="next" class="primary">Próximo passo ›</button></div></div>';
  const panel = $('.ly-panel', host);
  const token = $('.ly-token', host);
  const render = (pickId) => {
    const btns = host.querySelectorAll('.ly');
    btns.forEach((b) => b.classList.remove('active', 'visited', 'picked'));
    if (pickId) {
      const l = LAYERS.find((x) => x.id === pickId);
      host.querySelector('.ly-' + pickId).classList.add('picked');
      panel.innerHTML = '<small class="ly-k">Camada</small><h3>' + l.name + '</h3><p>' + l.desc + '</p>';
    } else if (step === 0) {
      token.classList.remove('show');
      panel.innerHTML = '<small class="ly-k">O caminho de um comando</small><h3>Do teclado ao disco</h3><p>Toque em <b>Próximo passo</b> para seguir o <code>ls -l</code> descendo pelas camadas e voltando com a resposta. Ou toque numa camada para saber o que ela faz.</p>';
    } else {
      const j = JOURNEY[step - 1];
      const seen = new Set(JOURNEY.slice(0, step).map((x) => x.layer));
      btns.forEach((b) => { if (seen.has(b.dataset.id)) b.classList.add('visited'); if (b.dataset.id === j.layer) b.classList.add('active'); });
      const t = host.querySelector('.ly-' + j.layer);
      token.style.transform = 'translateY(' + (t.offsetTop + t.offsetHeight / 2) + 'px)';
      token.textContent = j.dir === 'up' ? (j.layer === 'user' ? 'resultado' : 'dados') : 'ls -l';
      token.classList.toggle('up', j.dir === 'up');
      token.classList.add('show');
      panel.innerHTML = '<small class="ly-k">Passo ' + step + ' de ' + JOURNEY.length + (j.dir === 'up' ? ' · subindo' : ' · descendo') + '</small><p>' + j.text + '</p>';
    }
    panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
    $('.ctrl-n', host).textContent = step + '/' + JOURNEY.length;
    $('[data-act="prev"]', host).disabled = step === 0;
    $('[data-act="next"]', host).textContent = step >= JOURNEY.length ? 'Recomeçar ↺' : 'Próximo passo ›';
  };
  host.addEventListener('click', (e) => {
    const ly = e.target.closest('.ly');
    if (ly) { render(ly.dataset.id); return; }
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'next') step = step >= JOURNEY.length ? 0 : step + 1;
    else step = Math.max(0, step - 1);
    render();
  });
  render();
}

// ---------- como o shell separa as palavras ----------
function mountSplit(host) {
  const presets = ['cat meu arquivo.txt', 'cat "meu arquivo.txt"', 'ls -l /etc', 'cp "foto 1.jpg" fotos/'];
  host.innerHTML =
    '<label class="sp-label" for="sp-in">Digite uma linha de comando:</label>' +
    '<input id="sp-in" class="sp-in" spellcheck="false" autocomplete="off" autocapitalize="off">' +
    '<div class="sp-presets">' + presets.map((p) => '<button type="button">' + escapeHtml(p) + '</button>').join('') + '</div>' +
    '<div class="sp-words" aria-live="polite"></div><p class="sp-note"></p>';
  const input = $('.sp-in', host);
  const out = $('.sp-words', host);
  const note = $('.sp-note', host);
  const render = () => {
    let words;
    try { words = splitWords(input.value); } catch (e) { out.innerHTML = ''; note.textContent = 'Aspas abertas e não fechadas: o shell ficaria esperando o resto da linha.'; return; }
    out.innerHTML = words.map((w, i) => '<span class="sp-w' + (i === 0 ? ' cmd' : w.startsWith('-') ? ' opt' : '') + '" style="--i:' + i + '"><small>' + (i === 0 ? 'comando' : w.startsWith('-') ? 'opção' : 'argumento ' + i) + '</small>' + escapeHtml(w) + '</span>').join('');
    const args = Math.max(0, words.length - 1);
    note.textContent = words.length ? 'O shell entrega ao programa "' + words[0] + '" ' + args + (args === 1 ? ' argumento.' : ' argumentos.') + (words.some((w) => w.includes(' ')) ? ' As aspas mantiveram o espaço dentro de um argumento só.' : '') : '';
  };
  input.value = presets[0];
  input.addEventListener('input', render);
  host.querySelectorAll('.sp-presets button').forEach((b, i) => b.addEventListener('click', () => { input.value = presets[i]; render(); }));
  render();
}

// ---------- como o shell encontra o programa ----------
function mountPath(host) {
  const PATH = ['/usr/local/bin', '/usr/bin', '/bin'];
  const cases = ['ls', 'ola.sh', './ola.sh', 'LS'];
  host.innerHTML =
    '<div class="pa-top"><span>Você digitou:</span>' + cases.map((c) => '<button type="button" data-c="' + c + '">' + c + '</button>').join('') + '</div>' +
    '<div class="pa-steps" aria-live="polite"></div><p class="pa-result"></p>';
  const stepsEl = $('.pa-steps', host);
  const result = $('.pa-result', host);
  let run = 0;
  const play = async (cmd) => {
    const my = ++run;
    host.querySelectorAll('.pa-top button').forEach((b) => b.classList.toggle('on', b.dataset.c === cmd));
    const r = resolveSteps(cmd, PATH, (p) => { const n = vfs.tryLookup(p); return !!n && n.type === 'file'; }, '/home/aluno');
    stepsEl.innerHTML = '';
    result.textContent = '';
    result.className = 'pa-result';
    if (r.direct) {
      stepsEl.innerHTML = '<div class="pa-s info">Tem uma <code>/</code> no nome: o shell <b>não</b> consulta o PATH e vai direto ao caminho indicado.</div>';
      await sleep(500);
    }
    for (const s of r.steps) {
      if (my !== run) return;
      const row = document.createElement('div');
      row.className = 'pa-s';
      row.innerHTML = '<span class="pa-dir">' + escapeHtml(s.dir || s.path) + '</span><span class="pa-q">procurando…</span>';
      stepsEl.append(row);
      await sleep(550);
      if (my !== run) return;
      row.classList.add(s.found ? 'found' : 'miss');
      row.querySelector('.pa-q').innerHTML = s.found ? '✓ achei <code>' + escapeHtml(s.path) + '</code>' : '✗ não está aqui';
    }
    await sleep(250);
    if (my !== run) return;
    if (r.result) { result.innerHTML = '▶ Executa <code>' + escapeHtml(r.result) + '</code>'; result.classList.add('ok'); }
    else {
      result.innerHTML = '<code>' + escapeHtml(cmd) + ': comando não encontrado</code>' +
        (cmd === 'ola.sh' ? ' · o arquivo existe na sua pasta, mas ela não está no PATH. Use <code>./ola.sh</code>.' : cmd === 'LS' ? ' · para o Linux, <code>LS</code> e <code>ls</code> são nomes diferentes.' : '');
      result.classList.add('err');
    }
  };
  host.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) play(b.dataset.c); });
  play('ls');
}

// ---------- entrada, saída e erros ----------
function mountStreams(host) {
  const labels = { padrao: 'Sem redirecionar', arquivo: 'Saída para arquivo  >', erros: 'Erros para arquivo  2>', pipe: 'Ligar a outro programa  |' };
  host.innerHTML =
    '<div class="st-tabs">' + Object.keys(STREAM_SCENARIOS).map((k) => '<button type="button" data-s="' + k + '">' + escapeHtml(labels[k]) + '</button>').join('') + '</div>' +
    '<div class="st-cmd"><span class="st-p">$</span> <code></code></div>' +
    '<div class="st-diagram">' +
      '<div class="st-node st-in"><small>stdin (0)</small>teclado</div>' +
      '<div class="st-pipe st-pin"><i></i><i></i></div>' +
      '<div class="st-node st-prog"><small>programa</small><b>ls</b></div>' +
      '<div class="st-lanes">' +
        '<div class="st-lane out"><span class="st-tag">stdout (1)</span><div class="st-pipe"><i></i><i></i><i></i></div><div class="st-dest"></div></div>' +
        '<div class="st-lane err"><span class="st-tag">stderr (2)</span><div class="st-pipe"><i></i><i></i><i></i></div><div class="st-dest"></div></div>' +
      '</div>' +
    '</div>' +
    '<p class="st-note" aria-live="polite"></p>';
  const show = (name) => {
    const s = streamRoute(name);
    host.querySelectorAll('.st-tabs button').forEach((b) => b.classList.toggle('on', b.dataset.s === name));
    $('.st-cmd code', host).textContent = s.cmd;
    const dest = (lane, where) => {
      const el = $('.st-lane.' + lane + ' .st-dest', host);
      el.className = 'st-dest ' + (where.startsWith('tela') ? 'screen' : where.startsWith('arquivo') ? 'file' : 'prog');
      el.textContent = where;
      el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
    };
    dest('out', s.stdout);
    dest('err', s.stderr);
    $('.st-note', host).textContent = s.note;
  };
  host.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) show(b.dataset.s); });
  show('padrao');
}

// ---------- permissões (opcional) ----------
function mountPerm(host) {
  const bits = octalToBits(host.dataset.initial || '754');
  const groups = ['dono', 'grupo', 'outros'];
  host.innerHTML = '<div class="pm-groups">' + groups.map((g, gi) =>
    '<div class="pm-g pm-' + gi + '"><small>' + g + '</small><div>' +
    ['r', 'w', 'x'].map((b, bi) => '<button type="button" data-i="' + (gi * 3 + bi) + '" aria-label="' + g + ' ' + { r: 'ler', w: 'escrever', x: 'executar' }[b] + '"><b>' + b + '</b><small>' + [4, 2, 1][bi] + '</small></button>').join('') +
    '</div><span class="pm-sum"></span></div>').join('') + '</div><div class="pm-out"><code class="pm-str"></code><code class="pm-cmd"></code></div>';
  const render = () => {
    host.querySelectorAll('[data-i]').forEach((b, i) => { b.classList.toggle('on', bits[i]); b.setAttribute('aria-pressed', String(bits[i])); });
    const oct = permOctal(bits);
    host.querySelectorAll('.pm-g').forEach((g, gi) => {
      const parts = [4, 2, 1].filter((v, bi) => bits[gi * 3 + bi]);
      $('.pm-sum', g).textContent = (parts.length ? parts.join('+') : '0') + ' = ' + oct[gi];
    });
    $('.pm-str', host).textContent = permString(bits);
    $('.pm-cmd', host).textContent = 'chmod ' + oct + ' arquivo';
  };
  host.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) { bits[+b.dataset.i] = !bits[+b.dataset.i]; render(); } });
  render();
}

// ---------- glossário em balões ----------
function setupGlossary() {
  const box = $('#gloss');
  let current = null;
  const hide = () => { box.hidden = true; if (current) current.setAttribute('aria-expanded', 'false'); current = null; };
  document.addEventListener('click', (e) => {
    const g = e.target.closest('.g');
    if (!g) { if (!e.target.closest('#gloss')) hide(); return; }
    if (current === g) { hide(); return; }
    const def = GLOSSARIO[g.dataset.g];
    if (!def) return;
    current = g;
    g.setAttribute('aria-expanded', 'true');
    box.innerHTML = '<b>' + escapeHtml(def[0]) + '</b> ' + escapeHtml(def[1]);
    box.hidden = false;
    const r = g.getBoundingClientRect();
    const w = Math.min(300, window.innerWidth - 24);
    box.style.width = w + 'px';
    box.style.left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2)) + 'px';
    box.style.top = (r.bottom + window.scrollY + 8) + 'px';
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('resize', hide);
  for (const g of document.querySelectorAll('.g')) { g.setAttribute('aria-expanded', 'false'); g.setAttribute('aria-controls', 'gloss'); }
}

// ---------- revelação ao rolar e destaque do tema atual ----------
function setupScroll() {
  const items = document.querySelectorAll('.reveal');
  if (REDUCED || typeof IntersectionObserver !== 'function') { items.forEach((el) => el.classList.add('in')); }
  else {
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
    }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach((el) => io.observe(el));
  }
  const links = document.querySelectorAll('[data-spy]');
  if (typeof IntersectionObserver === 'function') {
    const spy = new IntersectionObserver((entries) => {
      for (const en of entries) if (en.isIntersecting) links.forEach((a) => a.classList.toggle('on', a.dataset.spy === en.target.id));
    }, { rootMargin: '-45% 0px -50% 0px' });
    document.querySelectorAll('.topic[id]').forEach((s) => spy.observe(s));
  }
}

document.querySelectorAll('.v-layers').forEach(mountLayers);
document.querySelectorAll('.v-split').forEach(mountSplit);
document.querySelectorAll('.v-path').forEach(mountPath);
document.querySelectorAll('.v-streams').forEach(mountStreams);
document.querySelectorAll('.v-perm').forEach(mountPerm);
document.querySelectorAll('.mini-term').forEach(mountTerminal);
setupGlossary();
setupScroll();
