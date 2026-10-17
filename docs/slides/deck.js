// Funções puras dos slides (sem DOM) — testadas em tests/deck.test.js.

export function clampIndex(i, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(total - 1, i | 0));
}

// "#/5" ou "#5" → índice 4 (slides numerados a partir de 1 na URL)
export function parseHash(hash, total) {
  const m = /^#\/?(\d+)$/.exec(hash || '');
  if (!m) return 0;
  return clampIndex(parseInt(m[1], 10) - 1, total);
}

export function formatTime(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

// Texto a copiar de um bloco de código: remove o prompt "$ " do início das linhas.
export function copyText(code) {
  return code.split('\n').map((l) => l.replace(/^\$ /, '')).join('\n').replace(/\n+$/, '');
}

// Separa um bloco "$ cmd" em comandos. Linhas sem "$ " continuam o comando anterior.
export function splitCommands(text) {
  const cmds = [];
  for (const line of text.replace(/\r/g, '').split('\n')) {
    if (line.startsWith('$ ')) cmds.push(line.slice(2));
    else if (cmds.length && line.trim() !== '') cmds[cmds.length - 1] += '\n' + line;
  }
  return cmds;
}

// ---------- sumário ----------
// items: [{ title, group?, tags? }] na ordem dos slides. Um item com "group" abre uma nova seção.
export function buildToc(items, firstGroup = 'Abertura') {
  const groups = [];
  items.forEach((it, index) => {
    if (it.group || !groups.length) groups.push({ name: it.group || firstGroup, slides: [] });
    groups[groups.length - 1].slides.push({ index, title: it.title, tags: it.tags || [] });
  });
  return groups;
}

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

// Filtra o sumário por texto (sem acentos) ou número do slide. Remove seções vazias.
export function filterToc(groups, query) {
  const q = norm(query).trim();
  if (!q) return groups;
  const num = /^\d+$/.test(q) ? parseInt(q, 10) : null;
  return groups
    .map((g) => ({
      name: g.name,
      slides: g.slides.filter((s) => (num !== null ? String(s.index + 1).startsWith(q) : norm(s.title).includes(q) || norm(g.name).includes(q) || s.tags.some((t) => norm(t).includes(q)))),
    }))
    .filter((g) => g.slides.length);
}

// Número digitado no campo de busca → índice do slide (ou -1)
export function tocJump(query, total) {
  const q = String(query).trim();
  if (!/^\d+$/.test(q)) return -1;
  const n = parseInt(q, 10);
  return n >= 1 && n <= total ? n - 1 : -1;
}

// ---------- navegação por passos ----------
// states: [{ step, total }] dos componentes do slide, na ordem do documento.
// Retorna o índice do componente que deve avançar, ou -1 (ir para o próximo slide).
export function navNext(states) {
  return states.findIndex((s) => s.step < s.total);
}
// Retorna o índice do componente que deve voltar, ou -1 (ir para o slide anterior).
export function navPrev(states) {
  for (let i = states.length - 1; i >= 0; i--) if (states[i].step > 0) return i;
  return -1;
}

// ---------- permissões ----------
// bits: array de 9 booleanos [r,w,x do dono, r,w,x do grupo, r,w,x dos outros]
export function permString(bits) {
  return '-' + bits.map((b, i) => (b ? 'rwx'[i % 3] : '-')).join('');
}
export function permOctal(bits) {
  let out = '';
  for (let g = 0; g < 3; g++) out += String((bits[g * 3] ? 4 : 0) + (bits[g * 3 + 1] ? 2 : 0) + (bits[g * 3 + 2] ? 1 : 0));
  return out;
}
export function octalToBits(oct) {
  const bits = [];
  for (const ch of String(oct).padStart(3, '0').slice(-3)) {
    const n = parseInt(ch, 8) || 0;
    bits.push(!!(n & 4), !!(n & 2), !!(n & 1));
  }
  return bits;
}

// ---------- HTML ----------
export function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const FG = { 30: 'k', 31: 'r', 32: 'g', 33: 'y', 34: 'b', 35: 'm', 36: 'c', 37: 'w', 90: 'gray', 91: 'r', 92: 'g', 93: 'y', 94: 'b', 95: 'm', 96: 'c', 97: 'w' };

// Converte a saída do terminal (com códigos de cor ANSI) em HTML seguro.
export function ansiToHtml(text) {
  let out = '';
  let bold = false;
  let fg = null;
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let m;
  const emit = (t) => {
    if (!t) return;
    if (bold || fg) {
      out += '<span class="' + [bold ? 'b' : '', fg ? 'c-' + fg : ''].filter(Boolean).join(' ') + '">' + escapeHtml(t) + '</span>';
    } else out += escapeHtml(t);
  };
  while ((m = re.exec(text))) {
    emit(text.slice(last, m.index));
    const codes = m[1] === '' ? [0] : m[1].split(';').map(Number);
    for (const c of codes) {
      if (c === 0) { bold = false; fg = null; }
      else if (c === 1) bold = true;
      else if (c === 22) bold = false;
      else if (c === 39) fg = null;
      else if (FG[c]) fg = FG[c];
    }
    last = re.lastIndex;
  }
  emit(text.slice(last));
  return out;
}

const KEYWORDS = new Set(['if', 'then', 'else', 'elif', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', 'exit', 'break', 'continue', 'case', 'esac', 'function', 'return']);

// Realce de sintaxe simples para bash. Retorna HTML.
export function highlightBash(src) {
  let out = '';
  let i = 0;
  let lineStart = true;
  const span = (cls, text) => '<span class="hl-' + cls + '">' + escapeHtml(text) + '</span>';
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\n') { out += '\n'; i++; lineStart = true; continue; }
    if (lineStart && src.startsWith('$ ', i)) { out += span('prompt', '$ '); i += 2; lineStart = false; continue; }
    if (ch === '#' && (i === 0 || /\s/.test(src[i - 1]))) {
      let j = src.indexOf('\n', i);
      if (j === -1) j = src.length;
      out += span('comment', src.slice(i, j));
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < src.length && src[j] !== ch) { if (src[j] === '\\' && ch === '"') j++; j++; }
      const str = src.slice(i, j + 1);
      if (ch === '"') {
        out += '<span class="hl-string">' + escapeHtml(str).replace(/\$(\{[^}]*\}|\(\(?|[A-Za-z_][A-Za-z0-9_]*|[0-9#?@$])/g, (mm) => '<span class="hl-var">' + mm + '</span>') + '</span>';
      } else out += span('string', str);
      i = j + 1;
      lineStart = false;
      continue;
    }
    if (ch === '$') {
      const mm = /^\$(\{[^}]*\}|\(\(?|[A-Za-z_][A-Za-z0-9_]*|[0-9#?@$])/.exec(src.slice(i));
      if (mm) { out += span('var', mm[0]); i += mm[0].length; lineStart = false; continue; }
    }
    if (/[A-Za-z_]/.test(ch)) {
      const w = /^[A-Za-z_][A-Za-z0-9_-]*/.exec(src.slice(i))[0];
      const prev = src[i - 1];
      if (KEYWORDS.has(w) && (prev === undefined || /[\s;]/.test(prev))) out += span('kw', w);
      else out += escapeHtml(w);
      i += w.length;
      lineStart = false;
      continue;
    }
    if (ch === '|' || ch === '>' || ch === '<' || ch === '&' || ch === ';') {
      out += span('op', ch);
      i++;
      lineStart = false;
      continue;
    }
    out += escapeHtml(ch);
    if (!/\s/.test(ch)) lineStart = false;
    i++;
  }
  return out;
}
