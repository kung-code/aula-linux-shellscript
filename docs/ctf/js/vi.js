// Motor do editor vi simplificado (puro, sem DOM) — testado em tests/vi.test.js.
//
// Modos: normal, insert e comando (:). Suporta o essencial para iniciantes:
//   i a I A o O · Esc · h j k l / setas · 0 $ · w b · gg G · x dd D yy p P u · ZZ
//   :w  :q  :wq  :x  :q!  :w!  :NÚMERO

export function createVi(text, { readonly = false, name = '' } = {}) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  if (lines.length > 1 && lines[lines.length - 1] === '') lines.pop();
  return {
    lines, row: 0, col: 0, mode: 'normal', cmd: '', pending: '',
    msg: name ? '"' + name + '" ' + lines.length + 'L' : '',
    modified: false, readonly, undo: [], register: null, quit: false,
  };
}

export function viText(s) {
  return s.lines.join('\n') + '\n';
}

const snapshot = (s) => ({ lines: s.lines.slice(), row: s.row, col: s.col });
function pushUndo(s) {
  s.undo.push(snapshot(s));
  if (s.undo.length > 100) s.undo.shift();
}

function clampCol(s) {
  const len = s.lines[s.row].length;
  const max = s.mode === 'insert' ? len : Math.max(0, len - 1);
  s.col = Math.max(0, Math.min(s.col, max));
}

function clampRow(s) {
  s.row = Math.max(0, Math.min(s.row, s.lines.length - 1));
}

function changed(s) { s.modified = true; }

// Executa um comando de ":". save(text) grava o arquivo (pode lançar erro).
function runCommand(s, raw, save) {
  const c = raw.trim();
  s.mode = 'normal';
  s.cmd = '';
  if (c === '') return;
  if (/^\d+$/.test(c)) { s.row = parseInt(c, 10) - 1; clampRow(s); s.col = 0; return; }
  const m = /^(w|q|wq|x|wq!|w!|q!|x!)$/.exec(c);
  if (!m) { s.msg = 'E492: Não é um comando do editor: ' + c; s.error = true; return; }
  const force = c.endsWith('!');
  const wantsWrite = c.startsWith('w') || c.startsWith('x');
  const wantsQuit = c.includes('q') || c.startsWith('x');
  if (wantsWrite && !(c.startsWith('x') && !s.modified)) {
    if (s.readonly && !force) { s.msg = "E45: a opção 'readonly' está ativa (adicione ! para forçar)"; s.error = true; return; }
    try {
      save(viText(s));
      s.modified = false;
      s.msg = 'gravado: ' + s.lines.length + 'L';
      s.error = false;
    } catch (e) {
      s.msg = 'E212: Não foi possível abrir o arquivo para escrita' + (e && e.code === 'EACCES' ? ' (Permissão negada)' : '');
      s.error = true;
      return;
    }
  }
  if (wantsQuit) {
    if (s.modified && !force && !wantsWrite) {
      s.msg = 'E37: Sem gravação desde a última alteração (adicione ! para forçar)';
      s.error = true;
      return;
    }
    s.quit = true;
  }
}

function wordForward(s) {
  let { row, col } = s;
  const line = s.lines[row];
  const isW = (ch) => /\w/.test(ch);
  if (col < line.length) {
    const startW = isW(line[col]);
    while (col < line.length && isW(line[col]) === startW && line[col] !== ' ') col++;
    while (col < line.length && line[col] === ' ') col++;
  }
  if (col >= line.length && row < s.lines.length - 1) { row++; col = 0; while (s.lines[row][col] === ' ') col++; }
  s.row = row; s.col = col;
}

function wordBack(s) {
  let { row, col } = s;
  if (col === 0 && row > 0) { row--; col = s.lines[row].length; }
  const line = s.lines[row];
  col--;
  while (col > 0 && line[col] === ' ') col--;
  const isW = /\w/.test(line[col] || '');
  while (col > 0 && /\w/.test(line[col - 1]) === isW && line[col - 1] !== ' ') col--;
  s.row = row; s.col = Math.max(0, col);
}

// Processa uma tecla. key: 'a', 'Escape', 'Enter', 'Backspace', 'ArrowLeft', 'Tab'...
// Retorna o estado (mutado). s.quit = true quando o editor deve fechar.
export function viKey(s, key, { save = () => {} } = {}) {
  s.error = false;
  if (s.mode === 'command') {
    if (key === 'Escape') { s.mode = 'normal'; s.cmd = ''; }
    else if (key === 'Enter') runCommand(s, s.cmd, save);
    else if (key === 'Backspace') { if (s.cmd === '') s.mode = 'normal'; else s.cmd = s.cmd.slice(0, -1); }
    else if (key.length === 1) s.cmd += key;
    return s;
  }

  if (s.mode === 'insert') {
    const line = s.lines[s.row];
    if (key === 'Escape') { s.mode = 'normal'; s.msg = ''; s.col--; clampCol(s); }
    else if (key === 'Enter') {
      const indent = /^\s*/.exec(line)[0];
      s.lines.splice(s.row, 1, line.slice(0, s.col), indent + line.slice(s.col));
      s.row++; s.col = indent.length; changed(s);
    } else if (key === 'Backspace') {
      if (s.col > 0) { s.lines[s.row] = line.slice(0, s.col - 1) + line.slice(s.col); s.col--; changed(s); }
      else if (s.row > 0) {
        const prev = s.lines[s.row - 1];
        s.lines.splice(s.row - 1, 2, prev + line);
        s.row--; s.col = prev.length; changed(s);
      }
    } else if (key === 'Delete') {
      if (s.col < line.length) { s.lines[s.row] = line.slice(0, s.col) + line.slice(s.col + 1); changed(s); }
    } else if (key === 'Tab') { insertText(s, '  '); }
    else if (key === 'ArrowLeft') { s.col--; clampCol(s); }
    else if (key === 'ArrowRight') { s.col++; clampCol(s); }
    else if (key === 'ArrowUp') { s.row--; clampRow(s); clampCol(s); }
    else if (key === 'ArrowDown') { s.row++; clampRow(s); clampCol(s); }
    else if (key.length === 1) insertText(s, key);
    return s;
  }

  // ----- modo normal -----
  const p = s.pending;
  s.pending = '';
  if (p === 'd') {
    if (key === 'd') {
      pushUndo(s);
      s.register = { lines: [s.lines[s.row]] };
      s.lines.splice(s.row, 1);
      if (!s.lines.length) s.lines.push('');
      clampRow(s); s.col = 0; changed(s);
    }
    return s;
  }
  if (p === 'y') { if (key === 'y') { s.register = { lines: [s.lines[s.row]] }; s.msg = '1 linha copiada'; } return s; }
  if (p === 'g') { if (key === 'g') { s.row = 0; s.col = 0; } return s; }
  if (p === 'Z') { if (key === 'Z') runCommand(s, 'x', save); return s; }

  const enterInsert = () => { pushUndo(s); s.mode = 'insert'; s.msg = '-- INSERÇÃO --'; };
  switch (key) {
    case 'i': enterInsert(); break;
    case 'a': enterInsert(); if (s.lines[s.row].length) s.col++; break;
    case 'I': enterInsert(); s.col = /^\s*/.exec(s.lines[s.row])[0].length; break;
    case 'A': enterInsert(); s.col = s.lines[s.row].length; break;
    case 'o': enterInsert(); s.lines.splice(s.row + 1, 0, /^\s*/.exec(s.lines[s.row])[0]); s.row++; s.col = s.lines[s.row].length; changed(s); break;
    case 'O': enterInsert(); s.lines.splice(s.row, 0, /^\s*/.exec(s.lines[s.row])[0]); s.col = s.lines[s.row].length; changed(s); break;
    case 'h': case 'ArrowLeft': case 'Backspace': s.col--; break;
    case 'l': case 'ArrowRight': case ' ': s.col++; break;
    case 'k': case 'ArrowUp': s.row--; break;
    case 'j': case 'ArrowDown': case 'Enter': s.row++; break;
    case '0': case 'Home': s.col = 0; break;
    case '$': case 'End': s.col = s.lines[s.row].length; break;
    case 'w': wordForward(s); break;
    case 'b': wordBack(s); break;
    case 'G': s.row = s.lines.length - 1; s.col = 0; break;
    case 'x': case 'Delete': {
      const line = s.lines[s.row];
      if (line.length) { pushUndo(s); s.lines[s.row] = line.slice(0, s.col) + line.slice(s.col + 1); changed(s); }
      break;
    }
    case 'D': pushUndo(s); s.lines[s.row] = s.lines[s.row].slice(0, s.col); changed(s); break;
    case 'p': case 'P':
      if (s.register) {
        pushUndo(s);
        const at = key === 'p' ? s.row + 1 : s.row;
        s.lines.splice(at, 0, ...s.register.lines);
        s.row = at; s.col = 0; changed(s);
      }
      break;
    case 'u':
      if (s.undo.length) { const u = s.undo.pop(); s.lines = u.lines; s.row = u.row; s.col = u.col; s.modified = true; s.msg = '1 alteração desfeita'; }
      else s.msg = 'Já está na alteração mais antiga';
      break;
    case 'd': case 'y': case 'g': case 'Z': s.pending = key; break;
    case ':': s.mode = 'command'; s.cmd = ''; break;
    case 'Escape': s.msg = ''; break;
    default: break;
  }
  clampRow(s);
  clampCol(s);
  return s;
}

function insertText(s, text) {
  const parts = text.replace(/\r/g, '').split('\n');
  const line = s.lines[s.row];
  const before = line.slice(0, s.col);
  const after = line.slice(s.col);
  if (parts.length === 1) {
    s.lines[s.row] = before + text + after;
    s.col += text.length;
  } else {
    const newLines = [before + parts[0]].concat(parts.slice(1, -1), [parts[parts.length - 1] + after]);
    s.lines.splice(s.row, 1, ...newLines);
    s.row += parts.length - 1;
    s.col = parts[parts.length - 1].length;
  }
  changed(s);
}

// Colar texto (no modo de inserção)
export function viPaste(s, text) {
  if (s.mode !== 'insert') return s;
  insertText(s, text);
  return s;
}
