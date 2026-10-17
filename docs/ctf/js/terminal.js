// Terminal no navegador: saída com cores ANSI, linha de entrada, histórico, Tab e editores nano/vi.

import { createVi, viKey, viPaste } from './vi.js';

const ANSI_RE = /\x1b\[([0-9;]*)m/g;
const FG = { 30: 'k', 31: 'r', 32: 'g', 33: 'y', 34: 'b', 35: 'm', 36: 'c', 37: 'w', 90: 'gray', 91: 'r', 92: 'g', 93: 'y', 94: 'b', 95: 'm', 96: 'c', 97: 'w' };
const MAX_CHUNK_LINES = 3000;
const MAX_NODES = 2500;

export class Terminal {
  constructor(root, { onTab, onInterrupt } = {}) {
    this.root = root;
    this.onTab = onTab;
    this.onInterrupt = onInterrupt;
    this.history = [];
    this.histPos = 0;
    this.pending = '';
    this.flushScheduled = false;
    this.style = { bold: false, fg: null };
    this.resolveInput = null;
    this.busy = false;

    root.classList.add('term');
    root.innerHTML = '';
    this.output = el('div', 'term-output');
    this.output.setAttribute('aria-live', 'polite');
    this.line = el('div', 'term-line');
    this.promptEl = el('span', 'term-prompt');
    this.input = el('input', 'term-input');
    Object.assign(this.input, { type: 'text', autocomplete: 'off', spellcheck: false, autocapitalize: 'off' });
    this.input.setAttribute('aria-label', 'Linha de comando');
    this.input.setAttribute('autocorrect', 'off');
    this.line.append(this.promptEl, this.input);
    this.measure = el('span', 'term-measure');
    this.measure.textContent = 'MMMMMMMMMM';
    root.append(this.output, this.line, this.measure);
    this.line.hidden = true;

    this.input.addEventListener('keydown', (e) => this.onKey(e));
    root.addEventListener('mouseup', () => {
      if (!window.getSelection || String(window.getSelection()) === '') this.focus();
    });
    document.addEventListener('keydown', (e) => {
      if (this.busy && e.ctrlKey && (e.key === 'c' || e.key === 'C') && !this.editorOpen) {
        e.preventDefault();
        if (this.onInterrupt) this.onInterrupt();
      }
    });
  }

  get columns() {
    const w = this.measure.getBoundingClientRect().width / 10 || 8;
    return Math.max(20, Math.floor((this.output.clientWidth - 4) / w));
  }

  focus() { if (!this.line.hidden && !this.editorOpen) this.input.focus({ preventScroll: true }); }

  // ---------- saída ----------
  write(text) {
    if (!text) return;
    this.pending += text;
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      const raf = typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (f) => setTimeout(f, 16);
      raf(() => this.flush());
    }
  }

  flush() {
    this.flushScheduled = false;
    let text = this.pending;
    this.pending = '';
    if (!text) return;
    const lines = text.split('\n');
    if (lines.length > MAX_CHUNK_LINES) {
      const omitted = lines.length - MAX_CHUNK_LINES;
      text = '\x1b[90m… (' + omitted + ' linhas anteriores não exibidas na tela)\x1b[0m\n' + lines.slice(-MAX_CHUNK_LINES).join('\n');
    }
    const frag = document.createDocumentFragment();
    let last = 0;
    let m;
    ANSI_RE.lastIndex = 0;
    while ((m = ANSI_RE.exec(text))) {
      if (m.index > last) frag.append(this.span(text.slice(last, m.index)));
      this.applySgr(m[1]);
      last = ANSI_RE.lastIndex;
    }
    if (last < text.length) frag.append(this.span(text.slice(last)));
    this.output.append(frag);
    while (this.output.childNodes.length > MAX_NODES) this.output.removeChild(this.output.firstChild);
    this.scrollToEnd();
  }

  span(text) {
    if (!this.style.bold && !this.style.fg) return document.createTextNode(text);
    const s = document.createElement('span');
    if (this.style.bold) s.classList.add('b');
    if (this.style.fg) s.classList.add('c-' + this.style.fg);
    s.textContent = text;
    return s;
  }

  applySgr(params) {
    const codes = params === '' ? [0] : params.split(';').map(Number);
    for (const c of codes) {
      if (c === 0) this.style = { bold: false, fg: null };
      else if (c === 1) this.style.bold = true;
      else if (c === 22) this.style.bold = false;
      else if (c === 39) this.style.fg = null;
      else if (FG[c]) this.style.fg = FG[c];
    }
  }

  clear() {
    this.pending = '';
    this.output.innerHTML = '';
  }

  scrollToEnd() { this.root.scrollTop = this.root.scrollHeight; }

  // ---------- entrada ----------
  // Mostra o prompt e espera uma linha. Resolve com a string, ou null se o usuário apertar Ctrl+C.
  readLine(promptAnsi, { history = true } = {}) {
    this.flush();
    this.style = { bold: false, fg: null };
    this.busy = false;
    this.useHistory = history;
    this.histPos = this.history.length;
    this.currentPrompt = promptAnsi;
    this.promptEl.innerHTML = '';
    const saved = this.output;
    this.output = this.promptEl;
    this.pending = promptAnsi;
    this.flush();
    this.output = saved;
    this.style = { bold: false, fg: null };
    this.input.value = '';
    this.line.hidden = false;
    this.scrollToEnd();
    this.focus();
    return new Promise((resolve) => { this.resolveInput = resolve; });
  }

  finishInput(value, suffix = '') {
    const resolve = this.resolveInput;
    this.resolveInput = null;
    this.line.hidden = true;
    this.busy = true;
    this.write(this.currentPrompt + '\x1b[0m' + (value === null ? this.input.value : value) + suffix + '\n');
    this.flush();
    if (resolve) resolve(value);
  }

  onKey(e) {
    if (!this.resolveInput) return;
    const key = e.key;
    if (key === 'Enter') {
      e.preventDefault();
      const v = this.input.value;
      if (this.useHistory && v.trim() && this.history[this.history.length - 1] !== v) this.history.push(v);
      this.finishInput(v);
    } else if (e.ctrlKey && (key === 'c' || key === 'C')) {
      if (this.input.selectionStart !== this.input.selectionEnd) return; // permite copiar seleção
      e.preventDefault();
      this.finishInput(null, '^C');
    } else if (e.ctrlKey && (key === 'l' || key === 'L')) {
      e.preventDefault();
      this.clear();
    } else if (e.ctrlKey && (key === 'u' || key === 'U')) {
      e.preventDefault();
      this.input.value = '';
    } else if (key === 'ArrowUp' && this.useHistory) {
      e.preventDefault();
      if (this.histPos > 0) { this.histPos--; this.setInput(this.history[this.histPos]); }
    } else if (key === 'ArrowDown' && this.useHistory) {
      e.preventDefault();
      if (this.histPos < this.history.length - 1) { this.histPos++; this.setInput(this.history[this.histPos]); }
      else { this.histPos = this.history.length; this.setInput(''); }
    } else if (key === 'Tab') {
      e.preventDefault();
      this.tab();
    }
  }

  tab() {
    if (!this.onTab) return;
    const pos = this.input.selectionStart;
    const before = this.input.value.slice(0, pos);
    const after = this.input.value.slice(pos);
    const r = this.onTab(before);
    if (r.options && r.options.length) {
      this.write(this.currentPrompt + '\x1b[0m' + this.input.value + '\n' + r.options.join('  ') + '\n');
      this.flush();
    }
    this.setInput(r.line + after, r.line.length);
  }

  setInput(v, cursor) {
    this.input.value = v;
    const c = cursor === undefined ? v.length : cursor;
    this.input.setSelectionRange(c, c);
  }

  // Simula uma tecla (barra de atalhos no celular)
  virtualKey(name) {
    if (name === 'ctrl-c') {
      if (this.busy && this.onInterrupt) this.onInterrupt();
      else if (this.resolveInput) this.finishInput(null, '^C');
      return;
    }
    if (!this.resolveInput) return;
    if (name === 'tab') this.tab();
    else if (name === 'up' || name === 'down') this.onKey({ key: name === 'up' ? 'ArrowUp' : 'ArrowDown', preventDefault() {}, ctrlKey: false });
    else {
      const pos = this.input.selectionStart;
      const v = this.input.value;
      this.setInput(v.slice(0, pos) + name + v.slice(pos), pos + name.length);
    }
    this.focus();
  }

  // ---------- editor vi (modal) ----------
  editVi({ name, content, readonly, save }) {
    return new Promise((resolve) => {
      this.editorOpen = true;
      const s = createVi(content, { readonly, name });
      if (!content) s.msg = '"' + name + '" [Novo]';
      const overlay = el('div', 'vi');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Editor vi: ' + name);
      const screen = el('pre', 'vi-screen');
      const status = el('div', 'vi-status');
      const help = el('div', 'vi-help');
      help.innerHTML = '<span><b>i</b> inserir</span><span><b>Esc</b> modo normal</span><span><b>:wq</b> salvar e sair</span><span><b>:q!</b> sair sem salvar</span><span><b>dd</b> apaga linha</span><span><b>u</b> desfaz</span>';
      const input = el('textarea', 'vi-input');
      input.setAttribute('aria-label', 'Entrada do editor vi');
      input.setAttribute('autocapitalize', 'off');
      input.spellcheck = false;
      const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const render = () => {
        let html = '';
        s.lines.forEach((line, r) => {
          let body;
          if (r === s.row) {
            const ch = line[s.col];
            const curCls = s.mode === 'insert' ? 'vi-cur ins' : 'vi-cur';
            body = esc(line.slice(0, s.col)) + '<span class="' + curCls + '">' + (ch === undefined ? ' ' : esc(ch)) + '</span>' + esc(line.slice(s.col + 1));
          } else body = esc(line) || ' ';
          html += '<span class="vi-line' + (r === s.row ? ' cur' : '') + '">' + body + '</span>';
        });
        for (let i = 0; i < 6; i++) html += '<span class="vi-line vi-tilde">~</span>';
        screen.innerHTML = html;
        const left = s.mode === 'command' ? ':' + esc(s.cmd) + '<span class="vi-cur ins"> </span>'
          : '<span class="' + (s.error ? 'vi-err' : '') + '">' + esc(s.mode === 'insert' ? '-- INSERÇÃO --' : s.msg || '') + '</span>';
        status.innerHTML = '<span class="vi-left">' + left + '</span><span class="vi-pos">' + (s.modified ? '[+] ' : '') + (s.row + 1) + ',' + (s.col + 1) + '</span>';
        const cur = screen.querySelector('.vi-cur');
        if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' });
      };
      const close = () => {
        overlay.remove();
        this.editorOpen = false;
        resolve();
        setTimeout(() => this.input.focus(), 0);
      };
      input.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        let key = e.key;
        if (e.ctrlKey && (key === 'c' || key === 'C')) {
          e.preventDefault();
          if (s.mode === 'insert') viKey(s, 'Escape');
          s.msg = 'Para sair do vi, digite :q! e aperte Enter (ou :wq para salvar e sair)';
          render();
          return;
        }
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (key === 'Unidentified' || key === 'Process') return;
        if (key.length !== 1 && !['Escape', 'Enter', 'Backspace', 'Delete', 'Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(key)) return;
        e.preventDefault();
        viKey(s, key, { save });
        if (s.quit) { close(); return; }
        render();
      });
      // celulares: teclados virtuais nem sempre enviam keydown com a tecla certa
      input.addEventListener('input', () => {
        const v = input.value;
        input.value = '';
        if (!v) return;
        for (const ch of v) viKey(s, ch === '\n' ? 'Enter' : ch, { save });
        if (s.quit) { close(); return; }
        render();
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        viPaste(s, text);
        render();
      });
      overlay.addEventListener('mousedown', (e) => { if (e.target !== input) { e.preventDefault(); input.focus(); } });
      overlay.append(screen, status, help, input);
      this.root.parentElement.append(overlay);
      render();
      input.focus();
    });
  }

  // ---------- editor (nano simplificado) ----------
  edit(opts) {
    if (opts.mode === 'vi') return this.editVi(opts);
    const { name, content, readonly, save } = opts;
    return new Promise((resolve) => {
      this.editorOpen = true;
      const overlay = el('div', 'nano');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Editor nano: ' + name);
      const header = el('div', 'nano-header');
      header.textContent = '  GNU nano (simulado)          ' + name + (readonly ? '  [somente leitura]' : '');
      const area = el('textarea', 'nano-area');
      area.value = content;
      area.spellcheck = false;
      area.readOnly = !!readonly;
      const status = el('div', 'nano-status');
      const footer = el('div', 'nano-footer');
      const btn = (label, action) => {
        const b = el('button', 'nano-btn');
        b.type = 'button';
        b.innerHTML = label;
        b.addEventListener('click', action);
        return b;
      };
      let modified = false;
      let asking = false;
      const close = () => {
        overlay.remove();
        this.editorOpen = false;
        resolve();
        setTimeout(() => this.input.focus(), 0);
      };
      const doSave = () => {
        if (readonly) { status.textContent = '[ Sem permissão de escrita neste arquivo ]'; return false; }
        try {
          save(area.value);
          modified = false;
          const lines = area.value === '' ? 0 : area.value.split('\n').length - (area.value.endsWith('\n') ? 1 : 0);
          status.textContent = '[ ' + lines + ' linha(s) gravada(s) ]';
          return true;
        } catch (err) {
          status.textContent = '[ Erro ao salvar: ' + (err.code === 'EACCES' ? 'Permissão negada' : err.message) + ' ]';
          return false;
        }
      };
      const doExit = () => {
        if (!modified || readonly) { close(); return; }
        asking = true;
        status.textContent = 'Salvar alterações? (S = sim, N = não, Esc = cancelar)';
      };
      footer.append(
        btn('<b>^O</b> Salvar', () => { doSave(); area.focus(); }),
        btn('<b>^X</b> Sair', () => { doExit(); area.focus(); }),
      );
      area.addEventListener('input', () => { modified = true; asking = false; status.textContent = ''; });
      area.addEventListener('keydown', (e) => {
        if (asking) {
          e.preventDefault();
          const k = e.key.toLowerCase();
          if (k === 's' || k === 'y') { if (doSave()) close(); }
          else if (k === 'n') close();
          else if (k === 'escape') { asking = false; status.textContent = ''; }
          return;
        }
        if (e.ctrlKey && (e.key === 'o' || e.key === 'O' || e.key === 's' || e.key === 'S')) { e.preventDefault(); doSave(); }
        else if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) { e.preventDefault(); doExit(); }
        else if (e.key === 'Tab') {
          e.preventDefault();
          const s = area.selectionStart;
          area.setRangeText('  ', s, area.selectionEnd, 'end');
          modified = true;
        }
      });
      overlay.append(header, area, status, footer);
      this.root.parentElement.append(overlay);
      area.focus();
    });
  }
}

function el(tag, cls) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  return e;
}
