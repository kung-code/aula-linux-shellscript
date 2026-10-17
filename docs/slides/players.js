// Componentes interativos dos slides. Todos os "steppables" expõem:
//   step, total, next(), prev(), complete(), reset()
// e são controlados pelas setas do teclado (ver slides.js).

import { splitCommands, copyText, highlightBash, ansiToHtml, escapeHtml, permString, permOctal, octalToBits } from './deck.js';
import { LAYERS, JOURNEY } from './layers.js';

const REDUCED = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function icon(name, cls = 'i') {
  return '<svg class="' + cls + '" aria-hidden="true"><use href="#' + name + '"/></svg>';
}

function controls(withPlay = true) {
  return '<div class="tp-ctrl">' +
    '<button type="button" class="tp-btn" data-act="prev" aria-label="Passo anterior" title="Passo anterior (←)">' + icon('i-step-prev') + '</button>' +
    '<button type="button" class="tp-btn tp-next" data-act="next" aria-label="Próximo passo" title="Próximo passo (→)">' + icon('i-step-next') + '<span>próximo</span></button>' +
    (withPlay ? '<button type="button" class="tp-btn" data-act="play" aria-label="Reproduzir tudo" title="Reproduzir tudo">' + icon('i-play') + '</button>' : '') +
    '<button type="button" class="tp-btn" data-act="reset" aria-label="Recomeçar" title="Recomeçar">' + icon('i-replay') + '</button>' +
    '<span class="tp-count" aria-live="polite"></span>' +
    '<button type="button" class="tp-btn tp-copy" data-act="copy" aria-label="Copiar comandos" title="Copiar">' + icon('i-copy') + '</button>' +
    '</div>';
}

// Base com reprodução automática, cancelamento de animação e botões.
class Steppable {
  bind(el, copySource) {
    this.el = el;
    el.querySelector('.tp-ctrl').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      e.stopPropagation();
      const act = b.dataset.act;
      if (act === 'next') { this.stopAuto(); this.next(); }
      else if (act === 'prev') { this.stopAuto(); this.prev(); }
      else if (act === 'reset') { this.stopAuto(); this.reset(); }
      else if (act === 'play') this.toggleAuto();
      else if (act === 'copy') this.copy(b, copySource);
    });
  }

  updateCount() {
    const c = this.el.querySelector('.tp-count');
    if (c) c.textContent = this.step + ' / ' + this.total;
    this.el.classList.toggle('is-done', this.step >= this.total);
    this.el.classList.toggle('is-start', this.step === 0);
    const play = this.el.querySelector('[data-act="play"]');
    if (play) play.innerHTML = icon(this.auto ? 'i-pause' : 'i-play');
  }

  async copy(btn, source) {
    try {
      await navigator.clipboard.writeText(copyText(source()));
      btn.classList.add('ok');
    } catch (e) { btn.classList.add('err'); }
    setTimeout(() => btn.classList.remove('ok', 'err'), 1200);
  }

  cancel() { if (this.anim) this.anim.cancelled = true; this.anim = null; }

  async toggleAuto() {
    if (this.auto) { this.stopAuto(); return; }
    this.auto = true;
    if (this.step >= this.total) this.reset();
    this.updateCount();
    while (this.auto && this.step < this.total) {
      await this.next();
      if (!this.auto) break;
      await sleep(900);
    }
    this.auto = false;
    this.updateCount();
  }

  stopAuto() { this.auto = false; this.updateCount(); }

  reset() { this.cancel(); this.step = 0; this.render(); }
  complete() { this.cancel(); this.step = this.total; this.render(); }
  prev() {
    if (this.step === 0) return;
    this.cancel();
    this.step--;
    this.render();
  }
}

function cmdHtml(cmd) {
  const lines = cmd.split('\n');
  return highlightBash(lines[0]) + lines.slice(1).map((l) => '\n<span class="tp-ps2">&gt; </span>' + highlightBash(l)).join('');
}

function outHtml(out, animate) {
  if (!out) return '';
  const lines = out.replace(/\n$/, '').split('\n');
  return '<div class="tp-out' + (animate ? ' tp-anim' : '') + '">' +
    lines.map((l, i) => '<div class="tp-ol" style="--i:' + Math.min(i, 24) + '">' + (ansiToHtml(l) || '&nbsp;') + '</div>').join('') +
    '</div>';
}

// ---------- Terminal animado ("GIF" controlável) ----------
export class TerminalPlayer extends Steppable {
  constructor(pre) {
    super();
    const text = pre.querySelector('code').textContent;
    this.source = text;
    this.cmds = splitCommands(text);
    this.total = this.cmds.length;
    this.step = 0;
    this.result = null;
    const el = document.createElement('div');
    el.className = 'tplayer' + (pre.classList.contains('compact') ? ' compact' : '');
    el.innerHTML =
      '<div class="tp-chrome" aria-hidden="true"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span>' +
      '<span class="tp-title">aluno@pinguimcorp</span></div>' +
      '<div class="tp-screen" role="log" aria-label="Demonstração no terminal"></div>' +
      controls();
    pre.replaceWith(el);
    this.screen = el.querySelector('.tp-screen');
    this.screen.addEventListener('click', () => { this.stopAuto(); this.next(); });
    this.bind(el, () => this.source);
    this.render();
  }

  setResult(r) { this.result = r; this.render(); }

  promptAt(k) {
    if (!this.result) return '<span class="c-gray">carregando…</span>';
    return ansiToHtml(k < this.total ? this.result.steps[k].prompt : this.result.promptAfter);
  }

  render() {
    let html = '';
    for (let i = 0; i < this.step && this.result; i++) {
      const s = this.result.steps[i];
      html += '<div class="tp-line">' + ansiToHtml(s.prompt) + cmdHtml(s.cmd) + '</div>' + outHtml(s.out, false);
    }
    html += '<div class="tp-line tp-current">' + this.promptAt(this.step) + '<span class="tp-cursor"></span></div>';
    this.screen.innerHTML = html;
    this.scroll(false);
    this.updateCount();
  }

  scroll(smooth) {
    this.screen.scrollTo({ top: this.screen.scrollHeight, behavior: smooth && !REDUCED ? 'smooth' : 'auto' });
  }

  async next() {
    if (this.anim) { this.complete0(); return; } // pular animação em andamento
    if (this.step >= this.total || !this.result) return;
    const k = this.step;
    const s = this.result.steps[k];
    const anim = (this.anim = { cancelled: false });
    this.step++;
    this.updateCount();
    const cur = this.screen.querySelector('.tp-current');
    cur.classList.add('typing');
    const typed = document.createElement('span');
    cur.insertBefore(typed, cur.querySelector('.tp-cursor'));
    if (!REDUCED) {
      for (let i = 0; i < s.cmd.length; i++) {
        if (anim.cancelled) return;
        const ch = s.cmd[i];
        typed.textContent += ch === '\n' ? '\n> ' : ch;
        this.scroll(false);
        await sleep(ch === ' ' ? 18 : 26 + Math.random() * 34);
      }
      await sleep(180);
      if (anim.cancelled) return;
    }
    cur.classList.remove('typing', 'tp-current');
    typed.outerHTML = cmdHtml(s.cmd);
    cur.querySelector('.tp-cursor').remove();
    cur.insertAdjacentHTML('afterend', outHtml(s.out, true) + '<div class="tp-line tp-current">' + this.promptAt(this.step) + '<span class="tp-cursor"></span></div>');
    this.scroll(true);
    const lines = Math.min(24, (s.out.match(/\n/g) || []).length);
    if (!REDUCED) await sleep(120 + lines * 25);
    if (this.anim === anim) this.anim = null;
  }

  // Termina instantaneamente o passo que está sendo animado
  complete0() { this.cancel(); this.render(); }
}

// ---------- Script: editor + execução ----------
export class ScriptPlayer extends Steppable {
  constructor(pre) {
    super();
    this.source = pre.querySelector('code').textContent.replace(/\n+$/, '');
    this.name = pre.dataset.name || 'script.sh';
    this.total = 2;
    this.step = 0;
    this.result = null;
    const el = document.createElement('div');
    el.className = 'splayer';
    el.innerHTML =
      '<div class="sp-editor"><div class="sp-head">' + icon('i-file') + '<span>' + escapeHtml(this.name) + '</span><span class="sp-tag">nano</span></div>' +
      '<pre class="sp-code"></pre></div>' +
      '<div class="sp-term"><div class="tp-chrome" aria-hidden="true"><span class="dot r"></span><span class="dot y"></span><span class="dot g"></span><span class="tp-title">terminal</span></div>' +
      '<div class="tp-screen" role="log"></div></div>' +
      controls();
    pre.replaceWith(el);
    this.code = el.querySelector('.sp-code');
    this.screen = el.querySelector('.tp-screen');
    el.querySelector('.sp-editor').addEventListener('click', () => { this.stopAuto(); this.next(); });
    this.screen.addEventListener('click', () => { this.stopAuto(); this.next(); });
    this.bind(el, () => this.source);
    this.render();
  }

  setResult(r) { this.result = r; this.render(); }

  codeLines(animate) {
    return this.source.split('\n').map((l, i) =>
      '<span class="ln' + (animate ? ' ln-anim' : '') + '" style="--i:' + i + '">' + (highlightBash(l) || ' ') + '</span>').join('');
  }

  render() {
    this.code.innerHTML = this.step >= 1 ? this.codeLines(false) : '<span class="ln sp-empty"><span class="tp-cursor"></span></span>';
    const prompt = this.result ? ansiToHtml(this.result.prompt) : '';
    if (this.step >= 2 && this.result) {
      this.screen.innerHTML = '<div class="tp-line">' + prompt + cmdHtml(this.result.cmd) + '</div>' + outHtml(this.result.out, false) +
        '<div class="tp-line">' + ansiToHtml(this.result.promptAfter) + '<span class="tp-cursor"></span></div>';
    } else {
      this.screen.innerHTML = '<div class="tp-line tp-current">' + prompt + (this.step >= 1 ? '<span class="tp-cursor"></span>' : '') + '</div>';
    }
    this.el.classList.toggle('ran', this.step >= 2);
    this.updateCount();
  }

  async next() {
    if (this.anim) { this.cancel(); this.render(); return; }
    if (this.step >= this.total || !this.result) return;
    const anim = (this.anim = { cancelled: false });
    this.step++;
    if (this.step === 1) {
      this.render();
      this.code.innerHTML = this.codeLines(true); // código "digitado" linha a linha
      if (!REDUCED) await sleep(this.source.split('\n').length * 70 + 300);
    } else {
      this.el.classList.add('ran');
      this.updateCount();
      const cur = this.screen.querySelector('.tp-current');
      const cursor = cur.querySelector('.tp-cursor');
      const typed = document.createElement('span');
      cur.insertBefore(typed, cursor);
      if (!REDUCED) {
        for (const ch of this.result.cmd) {
          if (anim.cancelled) return;
          typed.textContent += ch;
          await sleep(30 + Math.random() * 30);
        }
        await sleep(160);
        if (anim.cancelled) return;
      }
      typed.outerHTML = cmdHtml(this.result.cmd);
      if (cursor) cursor.remove();
      cur.classList.remove('tp-current');
      cur.insertAdjacentHTML('afterend', outHtml(this.result.out, true) + '<div class="tp-line">' + ansiToHtml(this.result.promptAfter) + '<span class="tp-cursor"></span></div>');
      this.screen.scrollTop = this.screen.scrollHeight;
      if (!REDUCED) await sleep(300);
    }
    if (this.anim === anim) this.anim = null;
  }
}

// ---------- Diagrama interativo: camadas do Linux ----------
export class LayersDiagram extends Steppable {
  constructor(host) {
    super();
    this.total = JOURNEY.length;
    this.step = 0;
    const btn = (l, i) => '<button type="button" class="ly ly-' + l.id + '" data-id="' + l.id + '" style="--i:' + i + '">' +
      icon(l.icon, 'i ly-ico') + '<span class="ly-txt"><b>' + l.name + '</b><small>' + l.sub + '</small></span></button>';
    const group = (space, label) => '<div class="ly-group ly-group-' + space + '"><span class="ly-space">' + label + '</span><div class="ly-items">' +
      LAYERS.map((l, i) => (l.space === space ? btn(l, i) : '')).join('') + '</div></div>';
    const layersHtml = group('user', 'espaço do usuário') +
      '<div class="ly-syscall"><span>chamadas de sistema</span></div>' +
      group('kernel', 'kernel') + group('hw', 'físico');
    host.classList.add('layers');
    host.innerHTML =
      '<div class="ly-stack">' +
        layersHtml +
        '<div class="ly-token" aria-hidden="true"><span>ls -l</span></div>' +
      '</div>' +
      '<div class="ly-side">' +
        '<div class="ly-panel" aria-live="polite"></div>' +
        controls(true) +
      '</div>';
    this.stack = host.querySelector('.ly-stack');
    this.panel = host.querySelector('.ly-panel');
    this.token = host.querySelector('.ly-token');
    host.querySelector('.tp-copy').remove();
    this.stack.addEventListener('click', (e) => {
      const b = e.target.closest('.ly');
      if (b) this.showLayer(b.dataset.id);
    });
    this.bind(host, () => '');
    this.render();
  }

  showLayer(id) {
    const l = LAYERS.find((x) => x.id === id);
    for (const b of this.stack.querySelectorAll('.ly')) b.classList.toggle('picked', b.dataset.id === id);
    this.panel.innerHTML =
      '<div class="ly-kicker">Camada</div><h3>' + icon(l.icon) + l.name + '</h3><p>' + l.desc + '</p>' +
      '<ul>' + l.examples.map((e) => '<li>' + escapeHtml(e) + '</li>').join('') + '</ul>' +
      '<p class="ly-hint">Aperte → para ver a jornada de um comando pelas camadas.</p>';
    this.panel.classList.remove('swap'); void this.panel.offsetWidth; this.panel.classList.add('swap');
  }

  render() {
    const k = this.step;
    for (const b of this.stack.querySelectorAll('.ly')) b.classList.remove('active', 'visited', 'picked');
    if (k === 0) {
      this.token.classList.remove('show');
      this.panel.innerHTML =
        '<div class="ly-kicker">Diagrama interativo</div><h3>Do teclado ao hardware</h3>' +
        '<p>Cada camada só conversa com a vizinha. <b>Clique</b> numa camada para saber o que ela faz.</p>' +
        '<p class="ly-hint">Aperte → para acompanhar o que acontece quando você digita <code>ls -l</code>.</p>';
    } else {
      const j = JOURNEY[k - 1];
      const visited = new Set(JOURNEY.slice(0, k).map((x) => x.layer));
      for (const b of this.stack.querySelectorAll('.ly')) {
        if (visited.has(b.dataset.id)) b.classList.add('visited');
        if (b.dataset.id === j.layer) b.classList.add('active');
      }
      const target = this.stack.querySelector('.ly-' + j.layer);
      this.token.style.transform = 'translate(-50%, ' + (target.offsetTop + target.offsetHeight / 2) + 'px)';
      this.token.classList.add('show');
      this.token.classList.toggle('up', j.dir === 'up');
      this.token.querySelector('span').textContent = j.dir === 'up' ? (j.layer === 'user' ? 'resultado ✓' : 'dados') : 'ls -l';
      const name = LAYERS.find((x) => x.id === j.layer).name;
      this.panel.innerHTML =
        '<div class="ly-kicker">Passo ' + k + ' de ' + this.total + ' · ' + (j.dir === 'up' ? 'subindo ↑' : 'descendo ↓') + '</div>' +
        '<h3>' + name + '</h3><p>' + j.text + '</p>';
    }
    this.panel.classList.remove('swap'); void this.panel.offsetWidth; this.panel.classList.add('swap');
    this.updateCount();
  }

  async next() {
    if (this.step >= this.total) return;
    this.step++;
    this.render();
    await sleep(REDUCED ? 0 : 700);
  }
}

// ---------- Montador de permissões (chmod) ----------
export class PermBuilder {
  constructor(host) {
    this.bits = octalToBits(host.dataset.initial || '755');
    const groups = ['dono', 'grupo', 'outros'];
    host.classList.add('perm');
    host.innerHTML =
      '<div class="perm-groups">' + groups.map((g, gi) =>
        '<div class="pg pg-' + gi + '"><span class="pg-name">' + g + '</span><div class="pg-bits">' +
        ['r', 'w', 'x'].map((b, bi) => '<button type="button" class="pb" data-i="' + (gi * 3 + bi) + '" aria-label="' + g + ': ' + { r: 'ler', w: 'escrever', x: 'executar' }[b] + '">' +
          '<b>' + b + '</b><small>' + [4, 2, 1][bi] + '</small></button>').join('') +
        '</div><span class="pg-sum"></span></div>').join('') +
      '</div>' +
      '<div class="perm-out"><code class="perm-str"></code><code class="perm-cmd"></code></div>';
    host.addEventListener('click', (e) => {
      const b = e.target.closest('.pb');
      if (!b) return;
      const i = Number(b.dataset.i);
      this.bits[i] = !this.bits[i];
      this.render(host, i);
    });
    this.render(host);
  }

  render(host, changed) {
    host.querySelectorAll('.pb').forEach((b, i) => {
      b.setAttribute('aria-pressed', String(this.bits[i]));
      b.classList.toggle('on', this.bits[i]);
      if (i === changed) { b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); }
    });
    const oct = permOctal(this.bits);
    host.querySelectorAll('.pg').forEach((g, gi) => {
      const parts = [4, 2, 1].filter((v, bi) => this.bits[gi * 3 + bi]);
      g.querySelector('.pg-sum').textContent = (parts.length ? parts.join('+') : '0') + ' = ' + oct[gi];
    });
    const str = permString(this.bits);
    host.querySelector('.perm-str').innerHTML = str.split('').map((c, i) => '<span class="ps-' + (i === 0 ? 't' : Math.floor((i - 1) / 3)) + '">' + c + '</span>').join('');
    host.querySelector('.perm-cmd').textContent = 'chmod ' + oct + ' arquivo';
  }
}
