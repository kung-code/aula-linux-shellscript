// Implementação dos comandos do terminal simulado.
// Cada comando recebe um ctx (ver Shell.makeCtx) e retorna o código de saída.

import { FsError, mensagemErro, modeString, normalizePath, basename } from './vfs.js';
import {
  C, stripAnsi, byteLength, base64Encode, base64Decode, sha256, globToRegex,
  MESES, MESES_LONGOS, DIAS, DIAS_LONGOS, pad2,
} from './util.js';
import { ExitSignal, BreakSignal, ContinueSignal, InterruptSignal } from './interpreter.js';
import { MAN } from './manpages.js';
import { ParseError } from './parser.js';

// ---------- auxiliares ----------

// Interpreta opções no estilo getopt. Retorna null (e imprime erro) se houver opção inválida.
function parseOpts(ctx, { flags = '', values = '', long = {}, numeric = false } = {}) {
  const opts = {};
  const operands = [];
  const args = ctx.args;
  const bad = (msg) => {
    ctx.err(ctx.name + ': ' + msg + "\nTente '" + ctx.name + " --help' para mais informações.\n");
    return null;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--') { operands.push(...args.slice(i + 1)); break; }
    if (a.startsWith('--') && a.length > 2) {
      const eq = a.indexOf('=');
      const key = eq >= 0 ? a.slice(0, eq) : a;
      const mapped = long[key];
      if (!mapped) return bad("opção não reconhecida '" + a + "'");
      if (values.includes(mapped)) {
        const v = eq >= 0 ? a.slice(eq + 1) : args[++i];
        if (v === undefined) return bad("a opção '" + key + "' requer um argumento");
        opts[mapped] = v;
      } else opts[mapped] = true;
      continue;
    }
    if (numeric && /^-\d+$/.test(a)) { opts.num = a.slice(1); continue; }
    if (a.length > 1 && a[0] === '-') {
      for (let j = 1; j < a.length; j++) {
        const ch = a[j];
        if (values.includes(ch)) {
          const rest = a.slice(j + 1);
          const v = rest !== '' ? rest : args[++i];
          if (v === undefined) return bad("a opção requer um argumento -- '" + ch + "'");
          opts[ch] = v;
          break;
        }
        if (!flags.includes(ch)) return bad("opção inválida -- '" + ch + "'");
        opts[ch] = true;
      }
      continue;
    }
    operands.push(a);
  }
  return { opts, operands };
}

function splitLines(text) {
  if (text === '') return [];
  const lines = text.split('\n');
  if (text.endsWith('\n')) lines.pop();
  return lines;
}

function joinLines(lines) {
  return lines.length ? lines.join('\n') + '\n' : '';
}

// Lê o conteúdo das entradas (arquivos ou stdin). Retorna [{name, content}] e reporta erros.
function readInputs(ctx, operands, { label = true } = {}) {
  const inputs = [];
  let failed = false;
  if (!operands.length) {
    inputs.push({ name: '-', content: ctx.readStdin(), stdin: true });
    return { inputs, failed };
  }
  for (const op of operands) {
    if (op === '-') { inputs.push({ name: '-', content: ctx.readStdin(), stdin: true }); continue; }
    try {
      inputs.push({ name: op, content: ctx.vfs.readFile(ctx.resolve(op)) });
    } catch (e) {
      failed = true;
      if (label) ctx.err(ctx.name + ': ' + op + ': ' + mensagemErro(e) + '\n');
    }
  }
  return { inputs, failed };
}

function quoteName(name) {
  if (/[\s'"$`\\!*?;&|<>()]/.test(name)) return "'" + name.replace(/'/g, "'\\''") + "'";
  return name;
}

function colorName(ctx, node, name) {
  if (!ctx.isTTY) return name;
  if (node.type === 'dir') return C.bblue + name + C.reset;
  if (node.exec || (node.mode & 0o111)) return C.bgreen + name + C.reset;
  return name;
}

function nodeSize(node) {
  return node.type === 'dir' ? 4096 : byteLength(node.content);
}

function humanSize(n) {
  if (n < 1024) return String(n);
  const units = ['K', 'M', 'G', 'T'];
  let v = n;
  let u = -1;
  do { v /= 1024; u++; } while (v >= 1024 && u < units.length - 1);
  if (v < 10) return (Math.ceil(v * 10) / 10).toFixed(1).replace('.', ',') + units[u];
  return Math.ceil(v) + units[u];
}

function formatDate(ms) {
  const d = new Date(ms);
  const now = Date.now();
  const recent = Math.abs(now - ms) < 1000 * 60 * 60 * 24 * 182;
  const day = String(d.getDate()).padStart(2, ' ');
  const tail = recent ? pad2(d.getHours()) + ':' + pad2(d.getMinutes()) : ' ' + d.getFullYear();
  return MESES[d.getMonth()] + ' ' + day + ' ' + tail;
}

let collator = null;
function compareText(a, b) {
  if (!collator) {
    try { collator = new Intl.Collator('pt-BR'); } catch (e) { collator = { compare: (x, y) => (x < y ? -1 : x > y ? 1 : 0) }; }
  }
  return collator.compare(a, b);
}

function columnize(items, width) {
  // items: [{text, len}] — layout em colunas, preenchido coluna a coluna (como o ls)
  // Cada coluna tem a largura do seu maior item + 2 (igual ao GNU ls).
  if (!items.length) return '';
  const n = items.length;
  let rows = 1;
  let widths;
  for (; rows <= n; rows++) {
    const cols = Math.ceil(n / rows);
    widths = [];
    for (let c = 0; c < cols; c++) {
      const col = items.slice(c * rows, (c + 1) * rows);
      widths.push(Math.max(...col.map((i) => i.len)) + (c < cols - 1 ? 2 : 0));
    }
    if (widths.reduce((a, b) => a + b, 0) <= width) break;
  }
  let out = '';
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < widths.length; c++) {
      const idx = c * rows + r;
      if (idx >= n) break;
      const it = items[idx];
      const lastInRow = (c + 1) * rows + r >= n;
      line += it.text + (lastInRow ? '' : ' '.repeat(widths[c] - it.len));
    }
    out += line + '\n';
  }
  return out;
}

function interpretEscapes(s) {
  return s.replace(/\\(\\|n|t|e|a|r|0?33|x1b|c)/g, (m, g) => {
    switch (g) {
      case '\\': return '\\';
      case 'n': return '\n';
      case 't': return '\t';
      case 'r': return '';
      case 'a': return '';
      case 'c': return '\u0000STOP';
      default: return '\x1b';
    }
  });
}

// ---------- comandos ----------
const commands = {};

commands.pwd = (ctx) => { ctx.out(ctx.cwd + '\n'); return 0; };

commands.cd = (ctx) => {
  const sh = ctx.shell;
  if (ctx.args.length > 1) { ctx.err('bash: cd: número excessivo de argumentos\n'); return 1; }
  let target = ctx.args[0];
  let print = false;
  if (target === undefined || target === '') target = sh.home;
  if (target === '-') { target = sh.oldpwd; print = true; }
  const abs = sh.resolve(target);
  let node;
  try { node = ctx.vfs.lookup(abs); } catch (e) {
    ctx.err('bash: cd: ' + target + ': ' + mensagemErro(e) + '\n');
    return 1;
  }
  if (node.type !== 'dir') { ctx.err('bash: cd: ' + target + ': Não é um diretório\n'); return 1; }
  if (!ctx.vfs.canExec(node)) { ctx.err('bash: cd: ' + target + ': Permissão negada\n'); return 1; }
  sh.setCwd(abs);
  if (print) ctx.out(abs + '\n');
  return 0;
};

commands.ls = (ctx) => {
  const p = parseOpts(ctx, { flags: 'aAlhR1StrdFG', long: { '--all': 'a', '--human-readable': 'h', '--recursive': 'R' } });
  if (!p) return 2;
  const o = p.opts;
  const vfs = ctx.vfs;
  let status = 0;
  const operands = p.operands.length ? p.operands : ['.'];
  const files = [];
  const dirs = [];
  for (const op of operands) {
    let node;
    try { node = vfs.lookup(ctx.resolve(op)); } catch (e) {
      ctx.err("ls: não foi possível acessar '" + op + "': " + mensagemErro(e) + '\n');
      status = 2;
      continue;
    }
    if (node.type === 'dir' && !o.d) dirs.push({ op, node });
    else files.push({ name: op, node });
  }

  const sortEntries = (entries) => {
    entries.sort((a, b) => compareText(a.name.replace(/^\.+/, ''), b.name.replace(/^\.+/, '')) || compareText(a.name, b.name));
    if (o.S) entries.sort((a, b) => nodeSize(b.node) - nodeSize(a.node));
    else if (o.t) entries.sort((a, b) => b.node.mtime - a.node.mtime);
    if (o.r) entries.reverse();
    return entries;
  };

  const render = (entries, showTotal) => {
    if (o.l) {
      const rows = entries.map((e) => {
        const n = e.node;
        const links = n.type === 'dir' ? 2 + Array.from(n.children.values()).filter((c) => c.type === 'dir').length : 1;
        const size = o.h ? humanSize(nodeSize(n)) : String(nodeSize(n));
        let name = ctx.isTTY ? quoteName(e.name) : e.name;
        name = colorName(ctx, n, name);
        if (o.F) name += n.type === 'dir' ? '/' : n.mode & 0o111 ? '*' : '';
        return [modeString(n), String(links), n.owner, n.group, size, formatDate(n.mtime), name];
      });
      const w = [1, 2, 3, 4].map((i) => Math.max(0, ...rows.map((r) => r[i].length)));
      let out = '';
      if (showTotal) {
        const blocks = entries.reduce((acc, e) => acc + (e.node.type === 'dir' ? 4 : Math.ceil(nodeSize(e.node) / 4096) * 4), 0);
        out += 'total ' + blocks + '\n';
      }
      for (const r of rows) {
        out += r[0] + ' ' + r[1].padStart(w[0]) + ' ' + r[2].padEnd(w[1]) + ' ' + r[3].padEnd(w[2]) + ' ' + r[4].padStart(w[3]) + ' ' + r[5] + ' ' + r[6] + '\n';
      }
      return out;
    }
    const items = entries.map((e) => {
      let text = ctx.isTTY ? quoteName(e.name) : e.name;
      if (o.F) text += e.node.type === 'dir' ? '/' : e.node.mode & 0o111 ? '*' : '';
      return { text: colorName(ctx, e.node, text), len: text.length };
    });
    if (!ctx.isTTY || o['1']) return items.map((i) => i.text).join('\n') + (items.length ? '\n' : '');
    return columnize(items, ctx.shell.io.columns || 80);
  };

  let out = '';
  if (files.length) out += render(sortEntries(files), false);

  const listDir = (label, node, abs, first) => {
    let kids;
    try { kids = vfs.readDir(abs); } catch (e) {
      ctx.out(out); out = '';
      ctx.err("ls: não foi possível abrir o diretório '" + label + "': " + mensagemErro(e) + '\n');
      status = 2;
      return;
    }
    let entries = kids.filter((k) => o.a || o.A || !k.name.startsWith('.')).map((k) => ({ name: k.name, node: k }));
    if (o.a) entries.push({ name: '.', node }, { name: '..', node: node.parent || node });
    entries = sortEntries(entries);
    const header = operands.length > 1 || files.length || o.R;
    if (header) out += (first && !files.length ? '' : '\n') + label + ':\n';
    out += render(entries, true);
    if (o.R) {
      for (const e of entries) {
        if (e.node.type === 'dir' && e.name !== '.' && e.name !== '..') {
          listDir(label.replace(/\/$/, '') + '/' + e.name, e.node, normalizePath(e.name, abs), false);
        }
      }
    }
  };
  dirs.sort((a, b) => compareText(a.op, b.op));
  dirs.forEach((d, i) => listDir(d.op, d.node, ctx.resolve(d.op), i === 0));
  ctx.out(out);
  return status;
};

commands.cat = (ctx) => {
  const p = parseOpts(ctx, { flags: 'n', long: { '--number': 'n' } });
  if (!p) return 1;
  let status = 0;
  let lineNo = 1;
  const emit = (content) => {
    if (!p.opts.n) { ctx.out(content); return; }
    const lines = splitLines(content);
    ctx.out(lines.map((l) => String(lineNo++).padStart(6) + '\t' + l).join('\n') + (lines.length ? '\n' : ''));
  };
  if (!p.operands.length) { emit(ctx.readStdin()); return 0; }
  for (const op of p.operands) {
    if (op === '-') { emit(ctx.readStdin()); continue; }
    try { emit(ctx.vfs.readFile(ctx.resolve(op))); } catch (e) {
      ctx.err('cat: ' + op + ': ' + mensagemErro(e) + '\n');
      status = 1;
    }
  }
  return status;
};
commands.less = (ctx) => commands.cat(ctx);
commands.more = (ctx) => commands.cat(ctx);

function headTail(ctx, which) {
  const p = parseOpts(ctx, { values: 'n', numeric: true, long: { '--lines': 'n' } });
  if (!p) return 1;
  let spec = p.opts.n !== undefined ? p.opts.n : p.opts.num !== undefined ? p.opts.num : '10';
  let fromStart = false;
  if (which === 'tail' && spec.startsWith('+')) { fromStart = true; spec = spec.slice(1); }
  if (!/^\d+$/.test(spec)) { ctx.err(which + ": número de linhas inválido: '" + spec + "'\n"); return 1; }
  const n = parseInt(spec, 10);
  const { inputs, failed } = readInputs(ctx, p.operands);
  inputs.forEach((inp, i) => {
    if (inputs.length > 1) ctx.out((i ? '\n' : '') + '==> ' + (inp.stdin ? 'entrada padrão' : inp.name) + ' <==\n');
    const lines = splitLines(inp.content);
    let sel;
    if (which === 'head') sel = lines.slice(0, n);
    else if (fromStart) sel = lines.slice(Math.max(0, n - 1));
    else sel = n === 0 ? [] : lines.slice(-n);
    ctx.out(joinLines(sel));
  });
  return failed ? 1 : 0;
}
commands.head = (ctx) => headTail(ctx, 'head');
commands.tail = (ctx) => headTail(ctx, 'tail');

commands.wc = (ctx) => {
  const p = parseOpts(ctx, { flags: 'lwcm', long: { '--lines': 'l', '--words': 'w', '--bytes': 'c' } });
  if (!p) return 1;
  let { l, w, c, m } = p.opts;
  if (m) c = true;
  if (!l && !w && !c) { l = true; w = true; c = true; }
  const { inputs, failed } = readInputs(ctx, p.operands);
  const rows = inputs.map((inp) => ({
    name: inp.stdin ? '' : inp.name,
    l: (inp.content.match(/\n/g) || []).length,
    w: inp.content.split(/\s+/).filter(Boolean).length,
    c: byteLength(inp.content),
  }));
  if (rows.length > 1) {
    rows.push({ name: 'total', l: rows.reduce((a, r) => a + r.l, 0), w: rows.reduce((a, r) => a + r.w, 0), c: rows.reduce((a, r) => a + r.c, 0) });
  }
  const cols = [l && 'l', w && 'w', c && 'c'].filter(Boolean);
  let width = Math.max(1, ...rows.map((r) => String(r.c).length));
  if (cols.length === 1 && rows.length === 1) width = 1;
  if (rows.length === 1 && rows[0].name === '' && cols.length > 1) width = 7;
  for (const r of rows) {
    ctx.out(cols.map((k) => String(r[k]).padStart(width)).join(' ') + (r.name ? ' ' + r.name : '') + '\n');
  }
  return failed ? 1 : 0;
};

commands.echo = (ctx) => {
  let args = ctx.args.slice();
  let newline = true;
  let escapes = false;
  while (args.length && /^-[neE]+$/.test(args[0])) {
    for (const ch of args[0].slice(1)) {
      if (ch === 'n') newline = false;
      if (ch === 'e') escapes = true;
      if (ch === 'E') escapes = false;
    }
    args.shift();
  }
  let text = args.join(' ');
  if (escapes) {
    text = interpretEscapes(text);
    const stop = text.indexOf('\u0000STOP');
    if (stop >= 0) { text = text.slice(0, stop); newline = false; }
  }
  ctx.out(text + (newline ? '\n' : ''));
  return 0;
};

commands.printf = (ctx) => {
  if (!ctx.args.length) { ctx.err('printf: uso: printf formato [argumentos]\n'); return 2; }
  const fmt = interpretEscapes(ctx.args[0]).replace('\u0000STOP', '');
  const args = ctx.args.slice(1);
  let ai = 0;
  let out = '';
  let status = 0;
  const once = () => {
    let used = false;
    const res = fmt.replace(/%(-?)(\d*)(?:\.(\d+))?([sdifcx%])/g, (m, left, width, precision, conv) => {
      if (conv === '%') return '%';
      used = true;
      let v = ai < args.length ? args[ai++] : '';
      let s;
      if (conv === 's') s = precision !== undefined ? v.slice(0, Number(precision)) : v;
      else if (conv === 'c') s = v.charAt(0);
      else if (conv === 'd' || conv === 'i' || conv === 'x') {
        let n = parseInt(v || '0', 10);
        if (isNaN(n)) { ctx.err("printf: '" + v + "': número inválido\n"); status = 1; n = 0; }
        s = conv === 'x' ? n.toString(16) : String(n);
      } else {
        let f = parseFloat((v || '0').replace(',', '.'));
        if (isNaN(f)) { ctx.err("printf: '" + v + "': número inválido\n"); status = 1; f = 0; }
        s = f.toFixed(precision !== undefined ? Number(precision) : 6).replace('.', ',');
      }
      const wNum = width ? Number(width) : 0;
      return left ? s.padEnd(wNum) : s.padStart(wNum);
    });
    out += res;
    return used;
  };
  const used = once();
  while (used && ai < args.length) once();
  ctx.out(out);
  return status;
};

commands.touch = (ctx) => {
  const p = parseOpts(ctx, { flags: 'c' });
  if (!p) return 1;
  if (!p.operands.length) { ctx.err('touch: falta o operando arquivo\n'); return 1; }
  let status = 0;
  for (const op of p.operands) {
    try {
      const abs = ctx.resolve(op);
      if (p.opts.c && !ctx.vfs.exists(abs)) continue;
      ctx.vfs.touch(abs);
    } catch (e) {
      ctx.err("touch: não foi possível tocar '" + op + "': " + mensagemErro(e) + '\n');
      status = 1;
    }
  }
  return status;
};

commands.mkdir = (ctx) => {
  const p = parseOpts(ctx, { flags: 'pv', long: { '--parents': 'p', '--verbose': 'v' } });
  if (!p) return 1;
  if (!p.operands.length) { ctx.err('mkdir: falta o operando\n'); return 1; }
  let status = 0;
  for (const op of p.operands) {
    try {
      ctx.vfs.mkdir(ctx.resolve(op), { parents: !!p.opts.p });
      if (p.opts.v) ctx.out("mkdir: foi criado o diretório '" + op + "'\n");
    } catch (e) {
      ctx.err("mkdir: não foi possível criar o diretório '" + op + "': " + mensagemErro(e) + '\n');
      status = 1;
    }
  }
  return status;
};

commands.rmdir = (ctx) => {
  const p = parseOpts(ctx, {});
  if (!p) return 1;
  if (!p.operands.length) { ctx.err('rmdir: falta o operando\n'); return 1; }
  let status = 0;
  for (const op of p.operands) {
    try {
      const abs = ctx.resolve(op);
      const node = ctx.vfs.lookup(abs);
      if (node.type !== 'dir') throw new FsError('ENOTDIR', abs);
      ctx.vfs.remove(abs);
    } catch (e) {
      ctx.err("rmdir: falhou em remover '" + op + "': " + mensagemErro(e) + '\n');
      status = 1;
    }
  }
  return status;
};

commands.rm = async (ctx) => {
  const p = parseOpts(ctx, { flags: 'rRfivd', long: { '--recursive': 'r', '--force': 'f', '--verbose': 'v' } });
  if (!p) return 1;
  const o = p.opts;
  const recursive = o.r || o.R;
  if (!p.operands.length) {
    if (o.f) return 0;
    ctx.err('rm: falta o operando\n');
    return 1;
  }
  let status = 0;
  for (const op of p.operands) {
    const abs = ctx.resolve(op);
    if (abs === '/' && recursive) {
      ctx.err("rm: é perigoso operar recursivamente em '/'\nrm: use --no-preserve-root para ignorar esta proteção (mas, por favor, nunca faça isso 😅)\n");
      status = 1;
      continue;
    }
    if (basename(op) === '.' || basename(op) === '..') {
      ctx.err("rm: recusando-se a remover os diretórios '.' ou '..': ignorando '" + op + "'\n");
      status = 1;
      continue;
    }
    let node;
    try { node = ctx.vfs.lookup(abs); } catch (e) {
      if (!o.f || e.code !== 'ENOENT') { ctx.err("rm: não foi possível remover '" + op + "': " + mensagemErro(e) + '\n'); status = 1; }
      continue;
    }
    if (node.type === 'dir' && !recursive) {
      ctx.err("rm: não foi possível remover '" + op + "': É um diretório\n");
      status = 1;
      continue;
    }
    if (o.i && !o.f) {
      const kind = node.type === 'dir' ? 'diretório' : 'arquivo comum';
      const ans = ctx.shell.io.readLine ? await ctx.shell.io.readLine("rm: remover " + kind + " '" + op + "'? ") : 's';
      if (!ans || !/^[sSyY]/.test(ans)) continue;
    }
    try {
      ctx.vfs.remove(abs, { recursive: true });
      if (o.v) ctx.out("removido '" + op + "'\n");
    } catch (e) {
      ctx.err("rm: não foi possível remover '" + op + "': " + mensagemErro(e) + '\n');
      status = 1;
    }
  }
  return status;
};

function copyRec(vfs, src, dst) {
  const node = vfs.lookup(src);
  if (node.type === 'file') {
    const content = vfs.readFile(src);
    const created = vfs.writeFile(dst, content, { mode: node.mode, exec: node.exec });
    if (node.exec) created.exec = node.exec;
    return;
  }
  if (!vfs.exists(dst)) vfs.mkdir(dst, { mode: node.mode });
  for (const child of vfs.readDir(src)) copyRec(vfs, normalizePath(child.name, src), normalizePath(child.name, dst));
}

commands.cp = (ctx) => {
  const p = parseOpts(ctx, { flags: 'rRvfa', long: { '--recursive': 'r', '--verbose': 'v' } });
  if (!p) return 1;
  const recursive = p.opts.r || p.opts.R || p.opts.a;
  const ops = p.operands;
  if (ops.length === 0) { ctx.err('cp: falta o operando arquivo\n'); return 1; }
  if (ops.length === 1) { ctx.err("cp: falta o operando arquivo de destino após '" + ops[0] + "'\n"); return 1; }
  const dest = ops[ops.length - 1];
  const destAbs = ctx.resolve(dest);
  const destNode = ctx.vfs.tryLookup(destAbs);
  const destIsDir = destNode && destNode.type === 'dir';
  if (ops.length > 2 && !destIsDir) { ctx.err("cp: o destino '" + dest + "' não é um diretório\n"); return 1; }
  let status = 0;
  for (const src of ops.slice(0, -1)) {
    const srcAbs = ctx.resolve(src);
    let node;
    try { node = ctx.vfs.lookup(srcAbs); } catch (e) {
      ctx.err("cp: não foi possível obter estado de '" + src + "': " + mensagemErro(e) + '\n');
      status = 1; continue;
    }
    if (node.type === 'dir' && !recursive) {
      ctx.err("cp: -r não especificado; omitindo o diretório '" + src + "'\n");
      status = 1; continue;
    }
    const target = destIsDir ? normalizePath(basename(srcAbs), destAbs) : destAbs;
    if (node.type === 'dir' && (target + '/').startsWith(srcAbs + '/')) {
      ctx.err("cp: não é possível copiar um diretório, '" + src + "', para dentro de si mesmo\n");
      status = 1; continue;
    }
    if (target === srcAbs) { ctx.err("cp: '" + src + "' e '" + dest + "' são o mesmo arquivo\n"); status = 1; continue; }
    try {
      copyRec(ctx.vfs, srcAbs, target);
      if (p.opts.v) ctx.out("'" + src + "' -> '" + ctx.shell.displayPath(target) + "'\n");
    } catch (e) {
      ctx.err("cp: não foi possível copiar '" + src + "': " + mensagemErro(e) + '\n');
      status = 1;
    }
  }
  return status;
};

commands.mv = (ctx) => {
  const p = parseOpts(ctx, { flags: 'vfi', long: { '--verbose': 'v' } });
  if (!p) return 1;
  const ops = p.operands;
  if (ops.length === 0) { ctx.err('mv: falta o operando arquivo\n'); return 1; }
  if (ops.length === 1) { ctx.err("mv: falta o operando arquivo de destino após '" + ops[0] + "'\n"); return 1; }
  const dest = ops[ops.length - 1];
  const destAbs = ctx.resolve(dest);
  const destNode = ctx.vfs.tryLookup(destAbs);
  const destIsDir = destNode && destNode.type === 'dir';
  if (ops.length > 2 && !destIsDir) { ctx.err("mv: o destino '" + dest + "' não é um diretório\n"); return 1; }
  let status = 0;
  for (const src of ops.slice(0, -1)) {
    const srcAbs = ctx.resolve(src);
    if (!ctx.vfs.exists(srcAbs)) {
      ctx.err("mv: não foi possível obter estado de '" + src + "': Arquivo ou diretório inexistente\n");
      status = 1; continue;
    }
    const target = destIsDir ? normalizePath(basename(srcAbs), destAbs) : destAbs;
    if (target === srcAbs) continue;
    try {
      ctx.vfs.move(srcAbs, target);
      if (ctx.shell.cwd === srcAbs || ctx.shell.cwd.startsWith(srcAbs + '/')) {
        ctx.shell.cwd = target + ctx.shell.cwd.slice(srcAbs.length);
      }
      if (p.opts.v) ctx.out("renomeado '" + src + "' -> '" + dest + "'\n");
    } catch (e) {
      ctx.err("mv: não foi possível mover '" + src + "' para '" + dest + "': " + mensagemErro(e) + '\n');
      status = 1;
    }
  }
  return status;
};

// Converte expressão regular básica (BRE, padrão do grep) para a sintaxe do JavaScript.
export function breToJs(pattern) {
  let out = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) {
      const n = pattern[i + 1];
      if ('+?|(){}'.includes(n)) out += n;
      else out += '\\' + n;
      i++;
    } else if ('+?|(){}'.includes(ch)) out += '\\' + ch;
    else out += ch;
  }
  return out;
}

commands.grep = (ctx) => {
  const p = parseOpts(ctx, {
    flags: 'ivcnlLrRqoEFwhHs', values: 'e',
    long: { '--ignore-case': 'i', '--invert-match': 'v', '--count': 'c', '--recursive': 'r', '--color': 'G' },
  });
  if (!p) return 2;
  const o = p.opts;
  const ops = p.operands.slice();
  let pattern = o.e;
  if (pattern === undefined) {
    if (!ops.length) { ctx.err("Uso: grep [OPÇÃO]... PADRÕES [ARQUIVO]...\nTente 'grep --help' para mais informações.\n"); return 2; }
    pattern = ops.shift();
  }
  let src = o.F ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : o.E ? pattern : breToJs(pattern);
  if (o.w) src = '(?<![\\wÀ-ú])(?:' + src + ')(?![\\wÀ-ú])';
  let re;
  try { re = new RegExp(src, o.i ? 'i' : ''); } catch (e) {
    try { if (o.w) re = new RegExp('\\b(?:' + (o.F ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : breToJs(pattern)) + ')\\b', o.i ? 'i' : ''); else throw e; }
    catch (e2) { ctx.err('grep: expressão regular inválida\n'); return 2; }
  }
  const reG = new RegExp(re.source, re.flags + 'g');
  const recursive = o.r || o.R;
  let targets = [];
  let hadError = false;
  const vfs = ctx.vfs;

  if (!ops.length) {
    if (recursive) ops.push('.');
    else targets.push({ name: '(entrada padrão)', content: ctx.readStdin(), stdin: true });
  }
  for (const op of ops) {
    const abs = ctx.resolve(op);
    let node;
    try { node = vfs.lookup(abs); } catch (e) {
      if (!o.s) ctx.err('grep: ' + op + ': ' + mensagemErro(e) + '\n');
      hadError = true; continue;
    }
    if (node.type === 'dir') {
      if (!recursive) { if (!o.s) ctx.err('grep: ' + op + ': É um diretório\n'); hadError = true; continue; }
      const walk = (n, disp, nabs) => {
        if (n.type !== 'dir') {
          if (!vfs.canRead(n)) { if (!o.s) ctx.err('grep: ' + disp + ': Permissão negada\n'); hadError = true; return; }
          targets.push({ name: disp, content: n.content, binary: !!n.exec || n.content.includes('\u0000') });
          return;
        }
        if (!vfs.canRead(n) || !vfs.canExec(n)) { if (!o.s) ctx.err('grep: ' + disp + ': Permissão negada\n'); hadError = true; return; }
        const kids = Array.from(n.children.values()).sort((a, b) => compareText(a.name, b.name));
        for (const k of kids) walk(k, disp.replace(/\/$/, '') + '/' + k.name, normalizePath(k.name, nabs));
      };
      walk(node, op, abs);
    } else {
      if (!vfs.canRead(node)) { if (!o.s) ctx.err('grep: ' + op + ': Permissão negada\n'); hadError = true; continue; }
      targets.push({ name: op, content: node.device === 'null' ? '' : node.content, binary: !!node.exec || node.content.includes('\u0000') });
    }
  }

  const showName = o.H || (!o.h && (targets.length > 1 || recursive));
  const tty = ctx.isTTY;
  const fname = (n) => (tty ? C.magenta + n + C.reset + C.cyan + ':' + C.reset : n + ':');
  const lnum = (n) => (tty ? C.green + n + C.reset + C.cyan + ':' + C.reset : n + ':');
  const hl = (line) => (tty && !o.v ? line.replace(reG, (m) => (m ? C.bred + m + C.reset : m)) : line);
  let matchedAny = false;

  for (const t of targets) {
    const lines = splitLines(t.content);
    let count = 0;
    let out = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const ok = re.test(line) !== !!o.v;
      if (!ok) continue;
      count++;
      if (o.q || o.l || o.L || o.c || t.binary) continue;
      const prefix = (showName ? fname(t.name) : '') + (o.n ? lnum(i + 1) : '');
      if (o.o && !o.v) {
        const ms = line.match(reG) || [];
        for (const m of ms) if (m) out += prefix + (tty ? C.bred + m + C.reset : m) + '\n';
      } else out += prefix + hl(line) + '\n';
    }
    if (count) matchedAny = true;
    if (o.q) { if (matchedAny) return 0; continue; }
    if (t.binary) { if (count && !o.c && !o.l) ctx.out('grep: ' + t.name + ': arquivo binário corresponde\n'); }
    if (o.l) { if (count) ctx.out((tty ? C.magenta + t.name + C.reset : t.name) + '\n'); continue; }
    if (o.L) { if (!count) ctx.out(t.name + '\n'); continue; }
    if (o.c) { ctx.out((showName ? fname(t.name) : '') + count + '\n'); continue; }
    ctx.out(out);
  }
  if (hadError && !(o.q && matchedAny)) return 2;
  return matchedAny ? 0 : 1;
};

commands.find = (ctx) => {
  const args = ctx.args.slice();
  const paths = [];
  while (args.length && !args[0].startsWith('-') && args[0] !== '!' && args[0] !== '(') paths.push(args.shift());
  if (!paths.length) paths.push('.');
  const tests = [];
  let maxdepth = Infinity;
  let mindepth = 0;
  while (args.length) {
    let a = args.shift();
    let negate = false;
    if (a === '!' || a === '-not') {
      negate = true;
      a = args.shift();
      if (a === undefined) { ctx.err("find: esperava uma expressão após '!'\n"); return 1; }
    }
    const need = () => {
      const v = args.shift();
      if (v === undefined) { ctx.err("find: faltando argumento para '" + a + "'\n"); return null; }
      return v;
    };
    let test;
    switch (a) {
      case '-name': case '-iname': {
        const v = need(); if (v === null) return 1;
        const re = globToRegex(v, { ignoreCase: a === '-iname' });
        test = (n) => re.test(n.name || '/');
        break;
      }
      case '-type': {
        const v = need(); if (v === null) return 1;
        if (v !== 'f' && v !== 'd') { ctx.err("find: tipo desconhecido para -type: '" + v + "' (use f ou d)\n"); return 1; }
        test = (n) => (v === 'd' ? n.type === 'dir' : n.type === 'file');
        break;
      }
      case '-size': {
        const v = need(); if (v === null) return 1;
        const m = /^([+-]?)(\d+)([ckMG]?)$/.exec(v);
        if (!m) { ctx.err("find: tamanho inválido em -size: '" + v + "'\n"); return 1; }
        const unit = { c: 1, k: 1024, M: 1024 * 1024, G: 1024 * 1024 * 1024, '': 512 }[m[3]];
        const num = parseInt(m[2], 10);
        test = (n) => {
          const s = Math.ceil(nodeSize(n) / unit);
          return m[1] === '+' ? s > num : m[1] === '-' ? s < num : s === num;
        };
        break;
      }
      case '-empty':
        test = (n) => (n.type === 'dir' ? n.children.size === 0 : n.content.length === 0);
        break;
      case '-user': {
        const v = need(); if (v === null) return 1;
        test = (n) => n.owner === v;
        break;
      }
      case '-perm': {
        const v = need(); if (v === null) return 1;
        const mode = parseInt(v.replace(/^[-/]/, ''), 8);
        test = v.startsWith('-') ? (n) => (n.mode & mode) === mode : (n) => (n.mode & 0o777) === mode;
        break;
      }
      case '-maxdepth': case '-mindepth': {
        const v = need(); if (v === null) return 1;
        if (!/^\d+$/.test(v)) { ctx.err("find: argumento inválido para " + a + ": '" + v + "'\n"); return 1; }
        if (a === '-maxdepth') maxdepth = parseInt(v, 10); else mindepth = parseInt(v, 10);
        continue;
      }
      case '-print':
        continue;
      case '-exec': case '-delete': case '-o': case '-or':
        ctx.err('find: ' + a + ' não é suportado neste simulador. Dica: combine find com pipes, ex.: find . -name "*.txt" | grep algo\n');
        return 1;
      default:
        ctx.err("find: predicado desconhecido '" + a + "'\n");
        return 1;
    }
    tests.push(negate ? (n) => !test(n) : test);
  }

  const vfs = ctx.vfs;
  let status = 0;
  let out = '';
  for (const start of paths) {
    const abs = ctx.resolve(start);
    let root;
    try { root = vfs.lookup(abs); } catch (e) {
      ctx.out(out); out = '';
      ctx.err("find: '" + start + "': " + mensagemErro(e) + '\n');
      status = 1; continue;
    }
    const rec = (node, disp, depth) => {
      if (depth >= mindepth && tests.every((t) => t(node))) out += disp + '\n';
      if (node.type !== 'dir' || depth >= maxdepth) return;
      if (!vfs.canRead(node) || !vfs.canExec(node)) {
        ctx.out(out); out = '';
        ctx.err("find: '" + disp + "': Permissão negada\n");
        status = 1;
        return;
      }
      const kids = Array.from(node.children.values()).sort((a, b) => compareText(a.name, b.name));
      for (const k of kids) rec(k, (disp.endsWith('/') ? disp : disp + '/') + k.name, depth + 1);
    };
    rec(root, start, 0);
  }
  ctx.out(out);
  return status;
};

// Calcula o novo modo a partir de uma especificação numérica ou simbólica.
export function applyMode(spec, current, isDir) {
  if (/^[0-7]{1,4}$/.test(spec)) return parseInt(spec, 8);
  let mode = current;
  for (const clause of spec.split(',')) {
    const m = /^([ugoa]*)([-+=])([rwxX]*)$/.exec(clause);
    if (!m) return null;
    const who = m[1] || 'a';
    let bits = 0;
    for (const ch of m[3]) {
      if (ch === 'r') bits |= 4;
      if (ch === 'w') bits |= 2;
      if (ch === 'x') bits |= 1;
      if (ch === 'X' && (isDir || (current & 0o111))) bits |= 1;
    }
    let mask = 0;
    let set = 0;
    for (const w of who) {
      const shifts = w === 'a' ? [6, 3, 0] : [{ u: 6, g: 3, o: 0 }[w]];
      for (const s of shifts) { mask |= 7 << s; set |= bits << s; }
    }
    if (m[2] === '+') mode |= set;
    else if (m[2] === '-') mode &= ~set;
    else mode = (mode & ~mask) | set;
  }
  return mode;
}

commands.chmod = (ctx) => {
  let recursive = false;
  let verbose = false;
  let modeSpec = null;
  const files = [];
  for (const a of ctx.args) {
    if (modeSpec === null && /^[-+=][rwxX]+$/.test(a)) { modeSpec = a; continue; }
    if (a === '-R' || a === '--recursive') { recursive = true; continue; }
    if (a === '-v' || a === '--verbose') { verbose = true; continue; }
    if (a.startsWith('-') && a.length > 1 && a !== '--') { ctx.err("chmod: opção inválida -- '" + a.slice(1) + "'\n"); return 1; }
    if (modeSpec === null) modeSpec = a;
    else files.push(a);
  }
  if (modeSpec === null) { ctx.err('chmod: falta o operando\n'); return 1; }
  if (!files.length) { ctx.err("chmod: falta o operando após '" + modeSpec + "'\n"); return 1; }
  if (applyMode(modeSpec, 0, false) === null) { ctx.err("chmod: modo inválido: '" + modeSpec + "'\n"); return 1; }
  let status = 0;
  const vfs = ctx.vfs;
  const apply = (abs, disp) => {
    let node;
    try { node = vfs.lookup(abs); } catch (e) {
      ctx.err("chmod: não foi possível acessar '" + disp + "': " + mensagemErro(e) + '\n');
      status = 1; return;
    }
    try {
      const old = node.mode;
      vfs.chmod(abs, applyMode(modeSpec, node.mode, node.type === 'dir'));
      if (verbose) ctx.out("o modo de '" + disp + "' foi alterado de " + old.toString(8).padStart(4, '0') + ' para ' + node.mode.toString(8).padStart(4, '0') + '\n');
    } catch (e) {
      ctx.err("chmod: alterando as permissões de '" + disp + "': " + mensagemErro(e) + '\n');
      status = 1; return;
    }
    if (recursive && node.type === 'dir' && vfs.canRead(node)) {
      for (const k of Array.from(node.children.values())) apply(normalizePath(k.name, abs), disp.replace(/\/$/, '') + '/' + k.name);
    }
  };
  for (const f of files) apply(ctx.resolve(f), f);
  return status;
};

commands.chown = (ctx) => {
  if (ctx.args.length < 2) { ctx.err('chown: falta o operando\n'); return 1; }
  for (const f of ctx.args.slice(1)) ctx.err("chown: alterando o dono de '" + f + "': Operação não permitida\n");
  return 1;
};

commands.sudo = (ctx) => {
  ctx.err('[sudo] senha para ' + ctx.shell.user + ': \n');
  ctx.err(ctx.shell.user + ' não está no arquivo sudoers. Este incidente será reportado. 🚨\n');
  ctx.err(C.gray + '(neste simulador você é um usuário comum — e nada aqui exige sudo)' + C.reset + '\n');
  return 1;
};
commands.su = commands.sudo;

commands.sort = (ctx) => {
  const p = parseOpts(ctx, { flags: 'rnufb', values: 'tk', long: { '--reverse': 'r', '--numeric-sort': 'n', '--unique': 'u' } });
  if (!p) return 2;
  const o = p.opts;
  const { inputs, failed } = readInputs(ctx, p.operands);
  let lines = [];
  for (const i of inputs) lines.push(...splitLines(i.content));
  const keyOf = (line) => {
    let s = line;
    if (o.k) {
      const k = parseInt(o.k, 10);
      const fields = o.t !== undefined ? line.split(o.t) : line.trim().split(/\s+/);
      s = fields.slice(k - 1).join(o.t !== undefined ? o.t : ' ');
    }
    if (o.b) s = s.trim();
    if (o.f) s = s.toLowerCase();
    return s;
  };
  const cmp = (a, b) => {
    const ka = keyOf(a);
    const kb = keyOf(b);
    if (o.n) {
      const na = parseFloat(ka) || 0;
      const nb = parseFloat(kb) || 0;
      if (na !== nb) return na - nb;
      return compareText(a, b);
    }
    return compareText(ka, kb) || (ka < kb ? -1 : ka > kb ? 1 : 0);
  };
  lines.sort(cmp);
  if (o.r) lines.reverse();
  if (o.u) lines = lines.filter((l, i) => i === 0 || cmp(lines[i - 1], l) !== 0);
  ctx.out(joinLines(lines));
  return failed ? 2 : 0;
};

commands.uniq = (ctx) => {
  const p = parseOpts(ctx, { flags: 'cdui', long: { '--count': 'c', '--unique': 'u', '--repeated': 'd' } });
  if (!p) return 1;
  const o = p.opts;
  const { inputs, failed } = readInputs(ctx, p.operands.slice(0, 1));
  if (failed) return 1;
  const lines = splitLines(inputs[0].content);
  const groups = [];
  for (const l of lines) {
    const last = groups[groups.length - 1];
    if (last && (o.i ? last.line.toLowerCase() === l.toLowerCase() : last.line === l)) last.n++;
    else groups.push({ line: l, n: 1 });
  }
  let out = '';
  for (const g of groups) {
    if (o.u && g.n !== 1) continue;
    if (o.d && g.n === 1) continue;
    out += (o.c ? String(g.n).padStart(7) + ' ' : '') + g.line + '\n';
  }
  ctx.out(out);
  return 0;
};

function parseRanges(spec) {
  const ranges = [];
  for (const part of spec.split(',')) {
    const m = /^(\d*)(-?)(\d*)$/.exec(part);
    if (!m || (!m[1] && !m[3])) return null;
    const a = m[1] ? parseInt(m[1], 10) : 1;
    const b = m[2] ? (m[3] ? parseInt(m[3], 10) : Infinity) : a;
    if (a < 1) return null;
    ranges.push([a, b]);
  }
  return ranges;
}

commands.cut = (ctx) => {
  const p = parseOpts(ctx, { flags: 's', values: 'dfcb', long: { '--delimiter': 'd', '--fields': 'f' } });
  if (!p) return 1;
  const o = p.opts;
  const spec = o.f || o.c || o.b;
  if (!spec) { ctx.err('cut: você deve especificar uma lista de bytes, caracteres ou campos\n'); return 1; }
  const ranges = parseRanges(spec);
  if (!ranges) { ctx.err("cut: lista inválida: '" + spec + "'\n"); return 1; }
  const inRange = (i) => ranges.some(([a, b]) => i >= a && i <= b);
  const delim = o.d !== undefined ? o.d : '\t';
  if (o.d !== undefined && o.d.length !== 1) { ctx.err('cut: o delimitador deve ser um único caractere\n'); return 1; }
  const { inputs, failed } = readInputs(ctx, p.operands);
  let out = '';
  for (const inp of inputs) {
    for (const line of splitLines(inp.content)) {
      if (o.f) {
        if (!line.includes(delim)) { if (!o.s) out += line + '\n'; continue; }
        out += line.split(delim).filter((_, i) => inRange(i + 1)).join(delim) + '\n';
      } else {
        out += Array.from(line).filter((_, i) => inRange(i + 1)).join('') + '\n';
      }
    }
  }
  ctx.out(out);
  return failed ? 1 : 0;
};

function expandSet(set) {
  set = set.replace(/\[:upper:\]/g, 'A-Z').replace(/\[:lower:\]/g, 'a-z').replace(/\[:digit:\]/g, '0-9')
    .replace(/\[:space:\]/g, ' \t\n').replace(/\[:alpha:\]/g, 'a-zA-Z');
  set = interpretEscapes(set);
  const chars = [];
  const arr = Array.from(set);
  for (let i = 0; i < arr.length; i++) {
    if (arr[i + 1] === '-' && arr[i + 2] !== undefined) {
      const a = arr[i].codePointAt(0);
      const b = arr[i + 2].codePointAt(0);
      for (let c = a; c <= b; c++) chars.push(String.fromCodePoint(c));
      i += 2;
    } else chars.push(arr[i]);
  }
  return chars;
}

commands.tr = (ctx) => {
  const p = parseOpts(ctx, { flags: 'ds' });
  if (!p) return 1;
  const ops = p.operands;
  if (!ops.length || (!p.opts.d && ops.length < 2)) { ctx.err('tr: falta o operando\n'); return 1; }
  const input = ctx.readStdin();
  const s1 = expandSet(ops[0]);
  let out;
  if (p.opts.d) {
    const del = new Set(s1);
    out = Array.from(input).filter((c) => !del.has(c)).join('');
  } else {
    const s2 = expandSet(ops[1]);
    const map = new Map();
    s1.forEach((c, i) => map.set(c, s2[Math.min(i, s2.length - 1)]));
    out = Array.from(input).map((c) => (map.has(c) ? map.get(c) : c)).join('');
  }
  if (p.opts.s) out = out.replace(/(.)\1+/g, '$1');
  ctx.out(out);
  return 0;
};

commands.seq = (ctx) => {
  let pad = false;
  let sep = '\n';
  const nums = [];
  const args = ctx.args.slice();
  while (args.length) {
    const a = args.shift();
    if (a === '-w' || a === '--equal-width') pad = true;
    else if (a === '-s') sep = interpretEscapes(args.shift() || '');
    else if (/^-s./.test(a)) sep = interpretEscapes(a.slice(2));
    else if (/^-?\d+$/.test(a)) nums.push(parseInt(a, 10));
    else { ctx.err("seq: argumento de ponto flutuante inválido: '" + a + "'\n"); return 1; }
  }
  if (!nums.length || nums.length > 3) { ctx.err('seq: falta o operando\n'); return 1; }
  let first = 1;
  let step = 1;
  let last;
  if (nums.length === 1) last = nums[0];
  else if (nums.length === 2) { first = nums[0]; last = nums[1]; }
  else { first = nums[0]; step = nums[1]; last = nums[2]; }
  if (step === 0) { ctx.err('seq: valor de incremento zero inválido\n'); return 1; }
  const width = Math.max(String(first).length, String(last).length);
  const out = [];
  for (let i = first; step > 0 ? i <= last : i >= last; i += step) {
    out.push(pad ? (i < 0 ? '-' + String(-i).padStart(width - 1, '0') : String(i).padStart(width, '0')) : String(i));
    if (out.length > 100000) break;
  }
  ctx.out(out.length ? out.join(sep) + '\n' : '');
  return 0;
};

export function formatDateCmd(d, fmt) {
  const tz = -d.getTimezoneOffset();
  const tzs = (tz >= 0 ? '+' : '-') + pad2(Math.floor(Math.abs(tz) / 60));
  return fmt.replace(/%([a-zA-Z%])/g, (m, c) => {
    switch (c) {
      case 'd': return pad2(d.getDate());
      case 'e': return String(d.getDate()).padStart(2, ' ');
      case 'm': return pad2(d.getMonth() + 1);
      case 'Y': return String(d.getFullYear());
      case 'y': return pad2(d.getFullYear() % 100);
      case 'H': return pad2(d.getHours());
      case 'M': return pad2(d.getMinutes());
      case 'S': return pad2(d.getSeconds());
      case 'A': return DIAS_LONGOS[d.getDay()];
      case 'a': return DIAS[d.getDay()];
      case 'B': return MESES_LONGOS[d.getMonth()];
      case 'b': case 'h': return MESES[d.getMonth()];
      case 'u': return String(d.getDay() || 7);
      case 'j': return String(Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000)).padStart(3, '0');
      case 'F': return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
      case 'T': return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
      case 'D': return pad2(d.getMonth() + 1) + '/' + pad2(d.getDate()) + '/' + pad2(d.getFullYear() % 100);
      case 's': return String(Math.floor(d.getTime() / 1000));
      case 'Z': return tzs;
      case 'z': return tzs + pad2(Math.abs(tz) % 60);
      case 'n': return '\n';
      case 't': return '\t';
      case '%': return '%';
      default: return m;
    }
  });
}

commands.date = (ctx) => {
  const fmtArg = ctx.args.find((a) => a.startsWith('+'));
  const bad = ctx.args.find((a) => !a.startsWith('+'));
  if (bad) { ctx.err("date: data inválida '" + bad + "'\n"); return 1; }
  const fmt = fmtArg ? fmtArg.slice(1) : '%a %e %b %Y %T %Z';
  ctx.out(formatDateCmd(new Date(), fmt) + '\n');
  return 0;
};

commands.whoami = (ctx) => { ctx.out(ctx.shell.user + '\n'); return 0; };
commands.id = (ctx) => { const u = ctx.shell.user; ctx.out('uid=1000(' + u + ') gid=1000(' + u + ') grupos=1000(' + u + ')\n'); return 0; };
commands.groups = (ctx) => { ctx.out(ctx.shell.user + '\n'); return 0; };
commands.hostname = (ctx) => { ctx.out(ctx.shell.hostname + '\n'); return 0; };
commands.uname = (ctx) => {
  const a = ctx.args.join(' ');
  if (/-a/.test(a)) ctx.out('Linux ' + ctx.shell.hostname + ' 6.8.0-pinguim #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux\n');
  else if (/-r/.test(a)) ctx.out('6.8.0-pinguim\n');
  else if (/-m/.test(a)) ctx.out('x86_64\n');
  else if (/-n/.test(a)) ctx.out(ctx.shell.hostname + '\n');
  else ctx.out('Linux\n');
  return 0;
};

commands.clear = (ctx) => { if (ctx.shell.io.clear) ctx.shell.io.clear(); return 0; };

commands.history = (ctx) => {
  if (ctx.args[0] === '-c') { ctx.shell.history.length = 0; return 0; }
  const h = ctx.shell.history;
  ctx.out(h.map((l, i) => String(i + 1).padStart(5) + '  ' + l).join('\n') + (h.length ? '\n' : ''));
  return 0;
};

commands.man = (ctx) => {
  const name = ctx.args[0];
  if (!name) { ctx.err("Qual página de manual você deseja?\nPor exemplo, tente 'man ls'.\n"); return 1; }
  const page = MAN[name] || (ctx.shell.commands[name] && ctx.shell.commands[name].help);
  if (!page) { ctx.err('Nenhuma entrada de manual para ' + name + '\n'); return 16; }
  const lines = page.trim().split('\n');
  const tty = ctx.isTTY;
  const title = tty ? C.bold + lines[0] + C.reset : lines[0];
  const body = lines.slice(1).map((l) => (tty ? l.replace(/^(USO:|EXEMPLOS?:|DICA:|CUIDADO:|ATALHOS:)/, C.byellow + '$1' + C.reset) : l));
  ctx.out(title + '\n' + body.join('\n') + '\n');
  return 0;
};

const BUILTINS = new Set(['cd', 'echo', 'printf', 'pwd', 'exit', 'export', 'unset', 'read', 'test', '[', 'true', 'false',
  'history', 'type', 'source', '.', 'break', 'continue', 'help', ':']);

commands.which = (ctx) => {
  let status = 0;
  for (const n of ctx.args) {
    if (ctx.shell.commands[n] && !BUILTINS.has(n)) ctx.out('/usr/bin/' + n + '\n');
    else if (n === 'echo' || n === 'pwd' || n === 'true' || n === 'false' || n === 'test' || n === '[') ctx.out('/usr/bin/' + n + '\n');
    else status = 1;
  }
  return status;
};

commands.type = (ctx) => {
  let status = 0;
  for (const n of ctx.args) {
    if (BUILTINS.has(n)) ctx.out(n + ' é um comando interno do shell\n');
    else if (['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'in', 'until'].includes(n)) ctx.out(n + ' é uma palavra-chave do shell\n');
    else if (ctx.shell.commands[n]) ctx.out(n + ' é /usr/bin/' + n + '\n');
    else { ctx.err('bash: type: ' + n + ': não encontrado\n'); status = 1; }
  }
  return status;
};

// ---------- test / [ ----------
export function evalTest(args, ctx) {
  const vfs = ctx.vfs;
  const isInt = (s) => /^\s*-?\d+\s*$/.test(s);
  const intErr = (s) => { throw new TestError((s === '' ? '' : s) + ': esperava expressão de número inteiro'); };
  const fileTest = (op, path) => {
    const node = vfs.tryLookup(ctx.resolve(path));
    switch (op) {
      case '-e': return !!node;
      case '-f': return !!node && node.type === 'file';
      case '-d': return !!node && node.type === 'dir';
      case '-r': return !!node && vfs.canRead(node);
      case '-w': return !!node && vfs.canWrite(node);
      case '-x': return !!node && vfs.canExec(node);
      case '-s': return !!node && nodeSize(node) > 0;
      default: return null;
    }
  };
  const unary = (op, v) => {
    if (op === '-z') return v === '';
    if (op === '-n') return v !== '';
    const r = fileTest(op, v);
    if (r === null) throw new TestError(op + ': esperado operador unário');
    return r;
  };
  const binary = (a, op, b) => {
    switch (op) {
      case '=': case '==': return a === b;
      case '!=': return a !== b;
      case '<': return a < b;
      case '>': return a > b;
      case '-eq': case '-ne': case '-lt': case '-le': case '-gt': case '-ge': {
        if (!isInt(a)) intErr(a);
        if (!isInt(b)) intErr(b);
        const x = parseInt(a, 10);
        const y = parseInt(b, 10);
        return { '-eq': x === y, '-ne': x !== y, '-lt': x < y, '-le': x <= y, '-gt': x > y, '-ge': x >= y }[op];
      }
      default: throw new TestError(op + ': esperado operador binário');
    }
  };
  const BIN = new Set(['=', '==', '!=', '<', '>', '-eq', '-ne', '-lt', '-le', '-gt', '-ge']);
  const evalSimple = (a) => {
    if (a.length === 0) return false;
    if (a[0] === '!' && a.length > 1) return !evalSimple(a.slice(1));
    if (a.length === 1) return a[0] !== '';
    if (a.length === 2) return unary(a[0], a[1]);
    if (a.length === 3 && BIN.has(a[1])) return binary(a[0], a[1], a[2]);
    if (a.length === 3 && a[0] === '!') return !unary(a[1], a[2]);
    throw new TestError('número excessivo de argumentos');
  };
  // -o tem precedência menor que -a
  const evalOr = (a) => {
    const i = a.lastIndexOf('-o');
    if (i > 0) return evalOr(a.slice(0, i)) || evalAnd(a.slice(i + 1));
    return evalAnd(a);
  };
  const evalAnd = (a) => {
    const i = a.lastIndexOf('-a');
    if (i > 0 && a.length > 3) return evalAnd(a.slice(0, i)) && evalSimple(a.slice(i + 1));
    return evalSimple(a);
  };
  return evalOr(args);
}
class TestError extends Error {}

commands.test = (ctx) => {
  try { return evalTest(ctx.args, ctx) ? 0 : 1; } catch (e) {
    if (e instanceof TestError) { ctx.err('bash: test: ' + e.message + '\n'); return 2; }
    throw e;
  }
};
commands['['] = (ctx) => {
  if (ctx.args[ctx.args.length - 1] !== ']') {
    ctx.err("bash: [: faltando ']'\n" + C.gray + 'Dica: os espaços são obrigatórios → [ "$a" -eq 1 ]' + C.reset + '\n');
    return 2;
  }
  try { return evalTest(ctx.args.slice(0, -1), ctx) ? 0 : 1; } catch (e) {
    if (e instanceof TestError) { ctx.err('bash: [: ' + e.message + '\n'); return 2; }
    throw e;
  }
};
commands['[['] = (ctx) => {
  ctx.err('bash: [[ ]] não é suportado neste simulador. Use [ ] (com espaços): if [ "$x" -gt 5 ]; then ...\n');
  return 2;
};

commands.true = () => 0;
commands[':'] = () => 0;
commands.false = () => 1;

commands.exit = (ctx) => {
  const n = ctx.args[0];
  if (n !== undefined && !/^-?\d+$/.test(n)) { ctx.err('bash: exit: ' + n + ': requer argumento numérico\n'); throw new ExitSignal(2); }
  throw new ExitSignal(n === undefined ? ctx.shell.lastStatus : ((parseInt(n, 10) % 256) + 256) % 256);
};

commands.break = (ctx) => { throw new BreakSignal(parseInt(ctx.args[0] || '1', 10) || 1); };
commands.continue = (ctx) => { throw new ContinueSignal(parseInt(ctx.args[0] || '1', 10) || 1); };

commands.export = (ctx) => {
  const sh = ctx.shell;
  if (!ctx.args.length || ctx.args[0] === '-p') {
    const names = Array.from(sh.exported).filter((n) => ctx.frame.vars.has(n)).sort();
    ctx.out(names.map((n) => 'declare -x ' + n + '="' + ctx.frame.vars.get(n) + '"').join('\n') + '\n');
    return 0;
  }
  for (const a of ctx.args) {
    const m = /^([A-Za-z_][A-Za-z0-9_]*)(?:=(.*))?$/.exec(a);
    if (!m) { ctx.err("bash: export: '" + a + "': não é um identificador válido\n"); return 1; }
    if (m[2] !== undefined) ctx.frame.vars.set(m[1], m[2]);
    sh.exported.add(m[1]);
  }
  return 0;
};

commands.unset = (ctx) => {
  for (const a of ctx.args) { ctx.frame.vars.delete(a); ctx.shell.exported.delete(a); }
  return 0;
};

commands.env = (ctx) => {
  const sh = ctx.shell;
  const names = Array.from(sh.exported).filter((n) => ctx.frame.vars.has(n) || n === 'PWD').sort();
  ctx.out(names.map((n) => n + '=' + (n === 'PWD' ? sh.cwd : ctx.frame.vars.get(n))).join('\n') + '\n');
  return 0;
};
commands.printenv = (ctx) => {
  if (!ctx.args.length) return commands.env(ctx);
  let status = 0;
  for (const n of ctx.args) {
    const v = n === 'PWD' ? ctx.shell.cwd : ctx.frame.vars.get(n);
    if (v === undefined || !ctx.shell.exported.has(n)) status = 1; else ctx.out(v + '\n');
  }
  return status;
};

commands.read = async (ctx) => {
  let prompt = '';
  const names = [];
  const args = ctx.args.slice();
  while (args.length) {
    const a = args.shift();
    if (a === '-p') prompt = args.shift() || '';
    else if (a === '-r' || a === '-s') continue;
    else if (/^-/.test(a)) { ctx.err('bash: read: ' + a + ': opção inválida\n'); return 2; }
    else names.push(a);
  }
  if (!names.length) names.push('REPLY');
  for (const n of names) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(n)) { ctx.err("bash: read: '" + n + "': não é um identificador válido\n"); return 1; }
  }
  let line;
  if (ctx.hasStdin()) {
    const data = ctx.stdin.data;
    if (data === '') return 1;
    const nl = data.indexOf('\n');
    line = nl === -1 ? data : data.slice(0, nl);
    ctx.stdin.data = nl === -1 ? '' : data.slice(nl + 1);
  } else {
    if (!ctx.shell.io.readLine) return 1;
    line = await ctx.shell.io.readLine(prompt);
    if (line === null || line === undefined) {
      if (ctx.shell.interrupted) { ctx.shell.interrupted = false; throw new InterruptSignal(); }
      return 1;
    }
  }
  const words = line.trim() === '' ? [] : line.trim().split(/[ \t]+/);
  names.forEach((n, i) => {
    if (i === names.length - 1) ctx.frame.vars.set(n, words.slice(i).join(' '));
    else ctx.frame.vars.set(n, words[i] || '');
  });
  return 0;
};

commands.source = async (ctx) => {
  const f = ctx.args[0];
  if (!f) { ctx.err('bash: source: requer argumento de nome de arquivo\n'); return 2; }
  return ctx.shell.runScript(ctx.resolve(f), f, ctx.args.slice(1), ctx.frame, { source: true });
};
commands['.'] = commands.source;

commands.bash = async (ctx) => {
  const sh = ctx.shell;
  if (ctx.args[0] === '-c') {
    if (ctx.args[1] === undefined) { ctx.err('bash: -c: requer um argumento\n'); return 2; }
    const sub = Object.assign({}, ctx.frame, { vars: new Map(ctx.frame.vars), positional: ctx.args.slice(3), depth: ctx.frame.depth + 1 });
    try { return await sh.execSource(ctx.args[1], sub); } catch (e) {
      if (e instanceof ExitSignal) return e.code;
      if (e instanceof ParseError) { ctx.err('bash: -c: ' + e.message + '\n'); return 2; }
      throw e;
    }
  }
  const f = ctx.args.find((a) => !a.startsWith('-'));
  if (!f) {
    ctx.out('Você já está no bash! 🙂 (para executar um script: bash script.sh)\n');
    return 0;
  }
  const idx = ctx.args.indexOf(f);
  return sh.runScript(ctx.resolve(f), f, ctx.args.slice(idx + 1), ctx.frame);
};
commands.sh = commands.bash;

commands.sleep = async (ctx) => {
  const n = parseFloat((ctx.args[0] || '').replace(',', '.'));
  if (isNaN(n) || n < 0) { ctx.err("sleep: intervalo de tempo inválido '" + (ctx.args[0] || '') + "'\n"); return 1; }
  const end = Date.now() + Math.min(n, 30) * 1000;
  while (Date.now() < end) {
    await new Promise((r) => setTimeout(r, Math.min(100, end - Date.now())));
    if (ctx.shell.interrupted) { ctx.shell.interrupted = false; throw new InterruptSignal(); }
  }
  return 0;
};

// Abre um arquivo no editor da interface (mode: 'nano' ou 'vi').
async function editFile(ctx, mode) {
  const name = ctx.name;
  const f = ctx.args.find((a) => !a.startsWith('-') && !a.startsWith('+'));
  if (!f) { ctx.err(name + ': informe o nome do arquivo. Exemplo: ' + name + ' script.sh\n'); return 1; }
  const io = ctx.shell.io;
  if (!io.edit) { ctx.err(name + ': editor indisponível neste ambiente\n'); return 1; }
  const abs = ctx.resolve(f);
  const node = ctx.vfs.tryLookup(abs);
  let content = '';
  if (node) {
    if (node.type === 'dir') { ctx.err(name + ": '" + f + "' é um diretório\n"); return 1; }
    try { content = ctx.vfs.readFile(abs); } catch (e) { ctx.err(name + ': ' + f + ': ' + mensagemErro(e) + '\n'); return 1; }
  } else {
    try { ctx.vfs.parentFor(abs, { needWrite: false }); } catch (e) { ctx.err(name + ': ' + f + ': ' + mensagemErro(e) + '\n'); return 1; }
  }
  const readonly = !!node && !ctx.vfs.canWrite(node);
  const save = (text) => { ctx.vfs.writeFile(abs, text); };
  try {
    await io.edit({ mode, name: f, path: abs, content, readonly, save });
  } catch (e) {
    ctx.err(name + ': ' + f + ': ' + mensagemErro(e) + '\n');
    return 1;
  }
  return 0;
}
commands.nano = (ctx) => editFile(ctx, 'nano');
commands.vi = (ctx) => editFile(ctx, 'vi');
commands.vim = commands.vi;

commands.tree = (ctx) => {
  const p = parseOpts(ctx, { flags: 'ad', values: 'L' });
  if (!p) return 1;
  const limit = p.opts.L !== undefined ? parseInt(p.opts.L, 10) : Infinity;
  const start = p.operands[0] || '.';
  const abs = ctx.resolve(start);
  let root;
  try { root = ctx.vfs.lookup(abs); } catch (e) { ctx.err(start + ' [erro ao abrir o diretório]\n'); return 1; }
  let dirs = 0;
  let files = 0;
  let out = colorName(ctx, root, start) + '\n';
  const rec = (node, prefix, depth) => {
    if (depth >= limit) return;
    if (!ctx.vfs.canRead(node)) { out += prefix + '└── [erro ao abrir o diretório]\n'; return; }
    let kids = Array.from(node.children.values()).filter((k) => p.opts.a || !k.name.startsWith('.'));
    if (p.opts.d) kids = kids.filter((k) => k.type === 'dir');
    kids.sort((a, b) => compareText(a.name, b.name));
    kids.forEach((k, i) => {
      const last = i === kids.length - 1;
      out += prefix + (last ? '└── ' : '├── ') + colorName(ctx, k, k.name) + '\n';
      if (k.type === 'dir') { dirs++; rec(k, prefix + (last ? '    ' : '│   '), depth + 1); } else files++;
    });
  };
  if (root.type === 'dir') rec(root, '', 0);
  out += '\n' + dirs + (dirs === 1 ? ' diretório' : ' diretórios') + (p.opts.d ? '' : ', ' + files + (files === 1 ? ' arquivo' : ' arquivos')) + '\n';
  ctx.out(out);
  return 0;
};

commands.file = (ctx) => {
  if (!ctx.args.length) { ctx.err('Uso: file ARQUIVO...\n'); return 1; }
  for (const f of ctx.args) {
    const node = ctx.vfs.tryLookup(ctx.resolve(f));
    let desc;
    if (!node) desc = "cannot open '" + f + "' (No such file or directory)";
    else if (node.type === 'dir') desc = 'directory';
    else if (node.device) desc = 'character special';
    else if (!ctx.vfs.canRead(node)) desc = 'regular file, no read permission';
    else if (node.exec) desc = 'ELF 64-bit LSB pie executable, x86-64, dynamically linked';
    else if (node.content === '') desc = 'empty';
    else if (/^#!.*\b(bash|sh)\b/.test(node.content)) desc = 'Bourne-Again shell script, UTF-8 text executable';
    else if (/^[\x00-\x7f]*$/.test(node.content)) desc = 'ASCII text';
    else desc = 'UTF-8 Unicode text';
    ctx.out(f + ': ' + desc + '\n');
  }
  return 0;
};

commands.base64 = (ctx) => {
  const p = parseOpts(ctx, { flags: 'dw', long: { '--decode': 'd' } });
  if (!p) return 1;
  const { inputs, failed } = readInputs(ctx, p.operands.slice(0, 1));
  if (failed) return 1;
  const data = inputs[0].content;
  if (p.opts.d) {
    try { ctx.out(base64Decode(data)); } catch (e) { ctx.err('base64: entrada inválida\n'); return 1; }
    return 0;
  }
  const enc = base64Encode(data);
  ctx.out((enc.match(/.{1,76}/g) || ['']).join('\n') + '\n');
  return 0;
};

commands.rev = (ctx) => {
  const { inputs, failed } = readInputs(ctx, ctx.args);
  for (const i of inputs) ctx.out(joinLines(splitLines(i.content).map((l) => Array.from(l).reverse().join(''))));
  return failed ? 1 : 0;
};

commands.sha256sum = (ctx) => {
  const { inputs, failed } = readInputs(ctx, ctx.args);
  for (const i of inputs) ctx.out(sha256(i.content) + '  ' + (i.stdin ? '-' : i.name) + '\n');
  return failed ? 1 : 0;
};

commands.help = (ctx) => {
  const t = ctx.isTTY;
  const h = (s) => (t ? C.byellow + s + C.reset : s);
  ctx.out([
    h('Comandos disponíveis neste simulador') + ' (use "man COMANDO" para detalhes)',
    '',
    h('Navegação:   ') + 'pwd  cd  ls  tree',
    h('Arquivos:    ') + 'touch  mkdir  rmdir  cp  mv  rm  nano  vi  file',
    h('Leitura:     ') + 'cat  less  head  tail  wc',
    h('Busca:       ') + 'grep  find',
    h('Texto:       ') + 'echo  printf  sort  uniq  cut  tr  rev  seq  base64  sha256sum',
    h('Permissões:  ') + 'chmod  whoami  id  ls -l',
    h('Sistema:     ') + 'date  uname  hostname  history  clear  man  which  type  env  sleep',
    h('Shell Script:') + ' bash  source  read  test  [ ]  if  for  while  export  exit',
    '',
    'Atalhos: Tab (completa) · ↑ ↓ (histórico) · Ctrl+C (interrompe) · Ctrl+L (limpa a tela)',
  ].join('\n') + '\n');
  if (ctx.shell.extraHelp) ctx.out(ctx.shell.extraHelp(ctx) + '\n');
  return 0;
};

// Anexa as páginas de manual (usadas por --help)
for (const name of Object.keys(commands)) {
  if (MAN[name]) commands[name].help = MAN[name];
}

export { commands };
export const COMMAND_NAMES = Object.keys(commands);
