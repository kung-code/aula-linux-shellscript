// Interpretador: executa a AST do parser sobre o VFS.

import { parse, ParseError, IncompleteError, tokenize } from './parser.js';
import { normalizePath, mensagemErro, FsError } from './vfs.js';
import { C, stripAnsi, globToRegex, hasGlobChars, unescapeGlob, escapeGlob } from './util.js';

export class ExitSignal { constructor(code) { this.code = code; } }
export class BreakSignal { constructor(levels) { this.levels = levels; } }
export class ContinueSignal { constructor(levels) { this.levels = levels; } }
export class InterruptSignal {}
export class StepLimitSignal {}

// ---------- saídas ----------
export class StringSink {
  constructor() { this.buf = ''; this.isTTY = false; }
  write(s) { this.buf += s; }
}
export class FnSink {
  constructor(fn, isTTY = true) { this.fn = fn; this.isTTY = isTTY; }
  write(s) { if (s) this.fn(this.isTTY ? s : stripAnsi(s)); }
}
export class NullSink {
  constructor() { this.isTTY = false; }
  write() {}
}
class FileSink {
  constructor(vfs, abs) { this.vfs = vfs; this.abs = abs; this.isTTY = false; }
  write(s) { if (s) this.vfs.writeFile(this.abs, stripAnsi(s), { append: true }); }
}

// Comandos que existem no Linux real mas não neste simulador.
const INDISPONIVEIS = new Set([
  'awk', 'sed', 'emacs', 'python', 'python3', 'git', 'curl', 'wget', 'ssh', 'ping', 'docker',
  'top', 'htop', 'ps', 'kill', 'killall', 'apt', 'apt-get', 'snap', 'gcc', 'make', 'node', 'java',
  'xargs', 'diff', 'tar', 'zip', 'unzip', 'gzip', 'ln', 'du', 'df', 'free', 'ifconfig', 'ip', 'systemctl', 'service',
  'su', 'passwd', 'useradd', 'adduser', 'crontab', 'nc', 'nmap', 'tee', 'stat', 'paste', 'awk',
]);

const MAX_DEPTH = 40;
const YIELD_EVERY = 256;

export class Shell {
  constructor({ vfs, io, commands, user = 'aluno', home = '/home/aluno', hostname = 'pinguimcorp', maxSteps = 500000 }) {
    this.vfs = vfs;
    this.io = io;
    this.user = user;
    this.home = home;
    this.hostname = hostname;
    this.commands = Object.assign({}, commands);
    this.binaries = {};
    this.history = [];
    this.lastStatus = 0;
    this.cwd = vfs.exists(home) ? home : '/';
    this.oldpwd = this.cwd;
    this.maxSteps = maxSteps;
    this.steps = 0;
    this.interrupted = false;
    this.exported = new Set(['HOME', 'USER', 'LOGNAME', 'PATH', 'PWD', 'SHELL', 'HOSTNAME', 'LANG', 'TERM', 'OLDPWD']);
    this.vars = new Map([
      ['HOME', home], ['USER', user], ['LOGNAME', user], ['PATH', '/usr/local/bin:/usr/bin:/bin'],
      ['PWD', this.cwd], ['OLDPWD', this.cwd], ['SHELL', '/bin/bash'], ['HOSTNAME', hostname],
      ['LANG', 'pt_BR.UTF-8'], ['TERM', 'xterm-256color'], ['IFS', ' \t\n'],
    ]);
    const tty = (fn) => new FnSink((s) => fn(s), true);
    this.ttyOut = tty((s) => this.io.write(s));
    this.ttyErr = tty((s) => (this.io.writeErr ? this.io.writeErr(s) : this.io.write(s)));
  }

  // ---------- utilidades públicas ----------
  resolve(path) {
    if (path === '~' || path.startsWith('~/')) path = this.home + path.slice(1);
    return normalizePath(path, this.cwd);
  }

  displayPath(abs) {
    if (abs === this.home) return '~';
    if (abs.startsWith(this.home + '/')) return '~' + abs.slice(this.home.length);
    return abs;
  }

  prompt() {
    return C.bgreen + this.user + '@' + this.hostname + C.reset + ':' + C.bblue + this.displayPath(this.cwd) + C.reset + '$ ';
  }

  setCwd(abs) {
    this.oldpwd = this.cwd;
    this.cwd = abs;
    this.vars.set('OLDPWD', this.oldpwd);
    this.vars.set('PWD', abs);
  }

  // A linha está incompleta (ex.: "for ...; do" sem "done")?
  isIncomplete(src) {
    try { parse(src); return false; } catch (e) { return e instanceof IncompleteError; }
  }

  interrupt() { this.interrupted = true; }

  newFrame(overrides) {
    return Object.assign({
      vars: this.vars,
      positional: [],
      name: 'bash',
      stdin: { data: null },
      stdout: this.ttyOut,
      stderr: this.ttyErr,
      depth: 0,
    }, overrides);
  }

  // Executa uma linha digitada no terminal.
  async run(src, { history = true } = {}) {
    const trimmed = src.trim();
    if (history && trimmed) this.history.push(src.replace(/\n+$/, ''));
    this.steps = 0;
    this.interrupted = false;
    const frame = this.newFrame();
    let status;
    try {
      status = await this.execSource(src, frame);
    } catch (e) {
      status = this.handleTopError(e, frame);
    }
    this.lastStatus = status;
    return status;
  }

  handleTopError(e, frame) {
    if (e instanceof ExitSignal) {
      frame.stdout.write('exit\n' + C.gray + '(no Linux real, isto fecharia o terminal 😉)' + C.reset + '\n');
      return e.code;
    }
    if (e instanceof InterruptSignal) { frame.stdout.write('^C\n'); return 130; }
    if (e instanceof StepLimitSignal) {
      frame.stderr.write(C.red + 'bash: limite de execução atingido (possível laço infinito). Interrompido.' + C.reset + '\n');
      return 1;
    }
    if (e instanceof BreakSignal || e instanceof ContinueSignal) return 0;
    if (e instanceof ParseError) { frame.stderr.write('bash: ' + e.message + '\n'); return 2; }
    frame.stderr.write('bash: erro interno: ' + (e && e.message ? e.message : e) + '\n');
    return 1;
  }

  async execSource(src, frame) {
    const ast = parse(src);
    return this.execList(ast, frame);
  }

  // ---------- execução ----------
  async execList(list, frame) {
    let status = 0;
    for (const item of list.items) status = await this.execAndOr(item, frame);
    return status;
  }

  async execAndOr(node, frame) {
    let status = await this.execPipeline(node.first, frame);
    for (const { op, pipeline } of node.rest) {
      if ((op === '&&' && status === 0) || (op === '||' && status !== 0)) {
        status = await this.execPipeline(pipeline, frame);
      }
    }
    return status;
  }

  async execPipeline(node, frame) {
    let status;
    if (node.commands.length === 1) {
      status = await this.execCommand(node.commands[0], frame);
    } else {
      let input = frame.stdin;
      for (let i = 0; i < node.commands.length; i++) {
        const last = i === node.commands.length - 1;
        const sink = last ? frame.stdout : new StringSink();
        const sub = Object.assign({}, frame, { stdin: input, stdout: sink });
        status = await this.execCommand(node.commands[i], sub);
        if (!last) input = { data: sink.buf };
      }
    }
    if (node.negate) status = status === 0 ? 1 : 0;
    this.lastStatus = status;
    return status;
  }

  async setupRedirs(redirs, frame) {
    const io = { stdin: frame.stdin, stdout: frame.stdout, stderr: frame.stderr };
    for (const r of redirs) {
      if (r.op === '2>&1') { io.stderr = io.stdout; continue; }
      const fields = await this.expandWord(r.target, frame);
      if (fields.length !== 1) throw new RedirError(this.wordText(r.target) + ': redirecionamento ambíguo');
      const abs = this.resolve(fields[0]);
      if (r.op === '<') {
        try { io.stdin = { data: this.vfs.readFile(abs) }; }
        catch (e) { throw new RedirError(fields[0] + ': ' + mensagemErro(e)); }
        continue;
      }
      let sink;
      const node = this.vfs.tryLookup(abs);
      if (node && node.device === 'null') sink = new NullSink();
      else {
        try {
          const append = r.op === '>>' || r.op === '2>>';
          if (node && node.type === 'dir') throw new FsError('EISDIR', abs);
          this.vfs.writeFile(abs, '', { append });
        } catch (e) { throw new RedirError(fields[0] + ': ' + mensagemErro(e)); }
        sink = new FileSink(this.vfs, abs);
      }
      if (r.op === '>' || r.op === '>>') io.stdout = sink;
      else if (r.op === '2>' || r.op === '2>>') io.stderr = sink;
      else if (r.op === '&>') { io.stdout = sink; io.stderr = sink; }
    }
    return io;
  }

  async execCommand(node, frame) {
    let io;
    try {
      io = await this.setupRedirs(node.redirs || [], frame);
    } catch (e) {
      if (e instanceof RedirError) { frame.stderr.write('bash: ' + e.message + '\n'); return 1; }
      throw e;
    }
    const f = Object.assign({}, frame, io);
    switch (node.type) {
      case 'simple': return this.execSimple(node, f);
      case 'if': return this.execIf(node, f);
      case 'for': return this.execFor(node, f);
      case 'while': return this.execWhile(node, f);
      default: throw new Error('nó desconhecido: ' + node.type);
    }
  }

  async tick() {
    this.steps++;
    if (this.interrupted) { this.interrupted = false; throw new InterruptSignal(); }
    if (this.steps > this.maxSteps) throw new StepLimitSignal();
    if (this.steps % YIELD_EVERY === 0) {
      await new Promise((r) => setTimeout(r, 0));
      if (this.interrupted) { this.interrupted = false; throw new InterruptSignal(); }
    }
  }

  async execIf(node, frame) {
    for (const clause of node.clauses) {
      if ((await this.execList(clause.cond, frame)) === 0) return this.execList(clause.body, frame);
    }
    if (node.elseBody) return this.execList(node.elseBody, frame);
    return 0;
  }

  async execFor(node, frame) {
    let items;
    if (node.words === null) items = frame.positional.slice();
    else {
      items = [];
      for (const w of node.words) items.push(...(await this.expandWord(w, frame)));
    }
    let status = 0;
    for (const item of items) {
      await this.tick();
      frame.vars.set(node.name, item);
      try {
        status = await this.execList(node.body, frame);
      } catch (e) {
        if (e instanceof BreakSignal) { if (e.levels > 1) { e.levels--; throw e; } break; }
        if (e instanceof ContinueSignal) { if (e.levels > 1) { e.levels--; throw e; } continue; }
        throw e;
      }
    }
    return status;
  }

  async execWhile(node, frame) {
    let status = 0;
    while (true) {
      await this.tick();
      const c = await this.execList(node.cond, frame);
      if (node.until ? c === 0 : c !== 0) break;
      try {
        status = await this.execList(node.body, frame);
      } catch (e) {
        if (e instanceof BreakSignal) { if (e.levels > 1) { e.levels--; throw e; } break; }
        if (e instanceof ContinueSignal) { if (e.levels > 1) { e.levels--; throw e; } continue; }
        throw e;
      }
    }
    return status;
  }

  async execSimple(node, frame) {
    await this.tick();
    this.substStatus = null;
    const argv = [];
    for (const w of node.words) argv.push(...(await this.expandWord(w, frame)));

    for (const a of node.assigns) {
      const value = (await this.expandWord(a.value, frame, { split: false, glob: false })).join('');
      if (a.name === 'PWD' || a.name === 'HOME') {
        if (a.name === 'HOME') this.home = value;
      }
      frame.vars.set(a.name, value);
    }
    if (!argv.length) return this.substStatus !== null ? this.substStatus : 0;
    return this.invoke(argv, frame);
  }

  // Executa argv (já expandido).
  async invoke(argv, frame) {
    const name = argv[0];
    const args = argv.slice(1);

    if (name.includes('/')) return this.execPath(name, args, frame);

    const cmd = this.commands[name];
    if (cmd) {
      const ctx = this.makeCtx(name, args, frame);
      if (args[0] === '--help' && cmd.help && name !== 'echo') {
        ctx.out(cmd.help.trim() + '\n');
        return 0;
      }
      try {
        const st = await cmd(ctx);
        return typeof st === 'number' ? st : 0;
      } catch (e) {
        if (e instanceof FsError) { ctx.err(name + ': ' + mensagemErro(e) + '\n'); return 1; }
        throw e;
      }
    }

    let msg = name + ': comando não encontrado\n';
    if (INDISPONIVEIS.has(name)) {
      msg = name + ': este comando existe no Linux real, mas não está disponível neste simulador.\n';
    } else {
      const local = this.vfs.tryLookup(this.resolve(name));
      if (local && local.type === 'file') {
        msg += C.gray + 'Dica: para executar um arquivo do diretório atual, use ./' + name + C.reset + '\n';
      }
    }
    frame.stderr.write(msg);
    return 127;
  }

  async execPath(path, args, frame) {
    const abs = this.resolve(path);
    let node;
    try { node = this.vfs.lookup(abs); } catch (e) {
      frame.stderr.write('bash: ' + path + ': ' + mensagemErro(e) + '\n');
      return e.code === 'EACCES' ? 126 : 127;
    }
    if (node.type === 'dir') { frame.stderr.write('bash: ' + path + ': É um diretório\n'); return 126; }
    if (!this.vfs.canExec(node)) {
      let msg = 'bash: ' + path + ': Permissão negada\n';
      msg += C.gray + 'Dica: o arquivo não tem permissão de execução. Use: chmod +x ' + path + C.reset + '\n';
      frame.stderr.write(msg);
      return 126;
    }
    if (node.exec) {
      const bin = this.binaries[node.exec] || this.commands[node.exec];
      if (!bin) { frame.stderr.write('bash: ' + path + ': não é possível executar o arquivo binário\n'); return 126; }
      const ctx = this.makeCtx(path, args, frame);
      return (await bin(ctx)) || 0;
    }
    return this.runScript(abs, path, args, frame);
  }

  // Executa um arquivo como script. source=true roda no mesmo contexto (comando "source").
  async runScript(abs, displayName, args, frame, { source = false } = {}) {
    let content;
    try { content = this.vfs.readFile(abs); } catch (e) {
      frame.stderr.write('bash: ' + displayName + ': ' + mensagemErro(e) + '\n');
      return 126;
    }
    const node = this.vfs.tryLookup(abs);
    if (node && node.exec) {
      const bin = this.binaries[node.exec] || this.commands[node.exec];
      if (bin) return (await bin(this.makeCtx(displayName, args, frame))) || 0;
    }
    if (frame.depth >= MAX_DEPTH) {
      frame.stderr.write('bash: ' + displayName + ': profundidade máxima de chamadas excedida\n');
      return 1;
    }
    let ast;
    try { ast = parse(content); } catch (e) {
      if (e instanceof ParseError) {
        frame.stderr.write(displayName + ': ' + (e instanceof IncompleteError ? 'fim de arquivo inesperado: ' : '') + e.message + '\n');
        return 2;
      }
      throw e;
    }
    let vars = frame.vars;
    if (!source) {
      vars = new Map();
      for (const [k, v] of this.vars) if (this.exported.has(k)) vars.set(k, v);
      for (const [k, v] of frame.vars) if (this.exported.has(k)) vars.set(k, v);
      vars.set('IFS', ' \t\n');
    }
    const sub = Object.assign({}, frame, {
      vars,
      positional: source && !args.length ? frame.positional : args,
      name: source ? frame.name : displayName,
      depth: frame.depth + 1,
    });
    const savedCwd = this.cwd;
    const savedOld = this.oldpwd;
    try {
      return await this.execList(ast, sub);
    } catch (e) {
      if (e instanceof ExitSignal) return e.code;
      if (e instanceof BreakSignal || e instanceof ContinueSignal) return 0;
      throw e;
    } finally {
      if (!source) {
        this.cwd = savedCwd;
        this.oldpwd = savedOld;
        this.vars.set('PWD', savedCwd);
      }
    }
  }

  makeCtx(name, args, frame) {
    const shell = this;
    let warned = false;
    return {
      shell,
      vfs: this.vfs,
      frame,
      name,
      args,
      stdin: frame.stdin,
      stdout: frame.stdout,
      stderr: frame.stderr,
      get isTTY() { return frame.stdout.isTTY; },
      get cwd() { return shell.cwd; },
      get home() { return shell.home; },
      out(s) { frame.stdout.write(s); },
      err(s) { frame.stderr.write(s); },
      resolve(p) { return shell.resolve(p); },
      hasStdin() { return frame.stdin && frame.stdin.data !== null; },
      // Lê toda a entrada padrão (pipe/arquivo). No terminal interativo, não há entrada.
      readStdin() {
        if (frame.stdin && frame.stdin.data !== null) {
          const d = frame.stdin.data;
          frame.stdin.data = '';
          return d;
        }
        if (!warned) {
          warned = true;
          frame.stderr.write(C.gray + name + ': nenhum arquivo informado. Exemplo: ' + name + ' arquivo.txt (ou use um pipe: cmd | ' + name + ')' + C.reset + '\n');
        }
        return '';
      },
    };
  }

  // ---------- expansões ----------
  wordText(word) {
    return word.segs.map((s) => (s.type === 'lit' ? s.text : s.type === 'var' ? '$' + s.name : '$(' + (s.src || s.expr) + ')')).join('');
  }

  getVar(name, frame) {
    switch (name) {
      case '?': return String(this.lastStatus);
      case '#': return String(frame.positional.length);
      case '@': case '*': return frame.positional.join(' ');
      case '$': return '4242';
      case '0': return frame.name;
      case 'RANDOM': return String(Math.floor(Math.random() * 32768));
      case 'PWD': return this.cwd;
      default:
        if (/^[0-9]+$/.test(name)) { const v = frame.positional[Number(name) - 1]; return v === undefined ? '' : v; }
        if (frame.vars.has(name)) return frame.vars.get(name);
        return '';
    }
  }

  async commandSubst(src, frame) {
    const sink = new StringSink();
    const sub = Object.assign({}, frame, { stdout: sink, vars: new Map(frame.vars) });
    const savedCwd = this.cwd;
    let status;
    try {
      status = await this.execSource(src, sub);
    } catch (e) {
      if (e instanceof ExitSignal) status = e.code;
      else if (e instanceof ParseError) { frame.stderr.write('bash: ' + e.message + '\n'); status = 2; }
      else throw e;
    } finally {
      if (this.cwd !== savedCwd) { this.cwd = savedCwd; this.vars.set('PWD', savedCwd); }
    }
    this.lastStatus = status;
    this.substStatus = status;
    return stripAnsi(sink.buf).replace(/\n+$/, '');
  }

  async segValue(seg, frame) {
    if (seg.type === 'var') {
      const v = this.getVar(seg.name, frame);
      return seg.length ? String(v.length) : v;
    }
    if (seg.type === 'cmd') return this.commandSubst(seg.src, frame);
    if (seg.type === 'arith') return String(this.evalArith(await this.expandArithText(seg.expr, frame), frame));
    return seg.text;
  }

  async expandArithText(expr, frame) {
    // expande $var, ${var} e $(cmd) dentro de $(( ))
    const word = tokenize('"' + expr.replace(/"/g, '\\"') + '"')[0];
    const parts = [];
    for (const s of word.segs) parts.push(s.type === 'lit' ? s.text : await this.segValue(s, frame));
    return parts.join('');
  }

  evalArith(expr, frame) {
    return evalArithmetic(expr, (name) => {
      const v = this.getVar(name, frame);
      const n = parseInt(v, 10);
      return isNaN(n) ? 0 : n;
    });
  }

  // Expande uma palavra em zero ou mais campos.
  async expandWord(word, frame, { split = true, glob = true } = {}) {
    const variants = split ? braceExpand(word.segs) : [word.segs];
    const out = [];
    for (const segs of variants) {
      const fields = [];
      let cur = null;
      const newField = () => { cur = { text: '', pat: '', glob: false, keep: false }; fields.push(cur); };
      newField();
      for (let idx = 0; idx < segs.length; idx++) {
        let seg = segs[idx];
        if (idx === 0 && seg.type === 'lit' && !seg.quoted && /^~(\/|$)/.test(seg.text)) {
          seg = { type: 'lit', text: this.home + seg.text.slice(1), quoted: false, tilde: true };
        }
        if (seg.type === 'lit') {
          cur.text += seg.text;
          cur.keep = true;
          if (seg.quoted || seg.tilde) cur.pat += escapeGlob(seg.text);
          else { cur.pat += seg.text; if (hasGlobChars(seg.text)) cur.glob = true; }
          continue;
        }
        if (seg.type === 'var' && seg.quoted && seg.name === '@') {
          const vals = frame.positional;
          cur.keep = true;
          vals.forEach((v, k) => {
            if (k > 0) { newField(); cur.keep = true; }
            cur.text += v; cur.pat += escapeGlob(v);
          });
          if (!vals.length && cur.text === '' && fields.length === 1 && segs.length === 1) fields.length = 0;
          continue;
        }
        const value = await this.segValue(seg, frame);
        if (seg.quoted || !split) {
          cur.text += value; cur.pat += escapeGlob(value); cur.keep = true;
          continue;
        }
        const parts = value.split(/[ \t\n]+/);
        parts.forEach((p, k) => {
          if (k > 0) { if (cur.text !== '' || cur.keep) newField(); }
          cur.text += p; cur.pat += p;
          if (p && hasGlobChars(p)) cur.glob = true;
        });
      }
      for (const f of fields) {
        if (!f.keep && f.text === '') continue;
        if (glob && f.glob) {
          const matches = this.globMatch(f.pat);
          if (matches.length) { out.push(...matches); continue; }
        }
        out.push(f.text);
      }
    }
    return out;
  }

  globMatch(pattern) {
    const absolute = pattern.startsWith('/');
    const trailingSlash = pattern.endsWith('/');
    const comps = pattern.split('/').filter((c) => c !== '');
    let cur = [{ disp: absolute ? '' : null, abs: absolute ? '/' : this.cwd }];
    const join = (disp, name) => (disp === null ? name : disp === '' ? '/' + name : disp + '/' + name);
    comps.forEach((comp, idx) => {
      const last = idx === comps.length - 1;
      const next = [];
      for (const c of cur) {
        if (hasGlobChars(comp)) {
          let kids;
          try { kids = this.vfs.readDir(c.abs); } catch (e) { continue; }
          const re = globToRegex(comp);
          const showHidden = comp.startsWith('.');
          for (const k of kids) {
            if (!showHidden && k.name.startsWith('.')) continue;
            if (!re.test(k.name)) continue;
            if ((!last || trailingSlash) && k.type !== 'dir') continue;
            next.push({ disp: join(c.disp, k.name), abs: normalizePath(k.name, c.abs) });
          }
        } else {
          const name = unescapeGlob(comp);
          const abs = normalizePath(name, c.abs);
          const node = this.vfs.tryLookup(abs);
          if (!node) continue;
          if ((!last || trailingSlash) && node.type !== 'dir') continue;
          next.push({ disp: join(c.disp, name), abs });
        }
      }
      cur = next;
    });
    return cur.map((c) => c.disp + (trailingSlash ? '/' : '')).sort();
  }

  // ---------- autocompletar (Tab) ----------
  complete(line) {
    const m = /(?:^|[\s|;&])((?:\\ |[^\s|;&])*)$/.exec(line);
    const word = m ? m[1] : '';
    const before = line.slice(0, line.length - word.length);
    const isCommand = /^\s*$|[|;&]\s*$/.test(before);
    const raw = word.replace(/\\ /g, ' ');
    let candidates = [];

    if (isCommand && !raw.includes('/')) {
      candidates = Object.keys(this.commands).filter((c) => c.startsWith(raw)).sort().map((c) => ({ name: c, suffix: ' ' }));
    } else {
      const slash = raw.lastIndexOf('/');
      const dirPart = slash >= 0 ? raw.slice(0, slash + 1) : '';
      const prefix = slash >= 0 ? raw.slice(slash + 1) : raw;
      let dirAbs;
      try { dirAbs = this.resolve(dirPart || '.'); } catch (e) { return { line, options: [] }; }
      let kids = [];
      try { kids = this.vfs.readDir(dirAbs); } catch (e) { kids = []; }
      candidates = kids
        .filter((k) => k.name.startsWith(prefix) && (prefix.startsWith('.') || !k.name.startsWith('.')))
        .filter((k) => !isCommand || k.type === 'dir' || this.vfs.canExec(k))
        .map((k) => ({ name: dirPart + k.name, suffix: k.type === 'dir' ? '/' : ' ', display: k.name + (k.type === 'dir' ? '/' : '') }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    }
    const esc = (s) => s.replace(/([ '"()&;|<>$`\\])/g, '\\$1');
    if (candidates.length === 0) return { line, options: [] };
    if (candidates.length === 1) {
      return { line: before + esc(candidates[0].name) + candidates[0].suffix, options: [] };
    }
    let common = candidates[0].name;
    for (const c of candidates) { while (!c.name.startsWith(common)) common = common.slice(0, -1); }
    return {
      line: before + esc(common.length > raw.length ? common : raw),
      options: candidates.map((c) => c.display || c.name),
    };
  }
}

class RedirError extends Error {}

// ---------- expansão de chaves {a,b} e {1..5} ----------
function findBrace(text) {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue;
    let depth = 0;
    for (let j = i; j < text.length; j++) {
      if (text[j] === '{') depth++;
      else if (text[j] === '}') {
        depth--;
        if (depth === 0) {
          const body = text.slice(i + 1, j);
          const alts = splitTopLevel(body);
          if (alts.length > 1) return { start: i, end: j, alts };
          const range = /^(-?\d+)\.\.(-?\d+)$/.exec(body) || /^([a-zA-Z])\.\.([a-zA-Z])$/.exec(body);
          if (range) return { start: i, end: j, alts: expandRange(range[1], range[2]) };
          break;
        }
      }
    }
  }
  return null;
}

function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; } else cur += ch;
  }
  parts.push(cur);
  return parts;
}

function expandRange(a, b) {
  const out = [];
  if (/^-?\d+$/.test(a)) {
    const x = parseInt(a, 10);
    const y = parseInt(b, 10);
    const width = (a.length > 1 && a.startsWith('0')) || (b.length > 1 && b.startsWith('0')) ? Math.max(a.length, b.length) : 0;
    const step = x <= y ? 1 : -1;
    for (let i = x; step > 0 ? i <= y : i >= y; i += step) out.push(width ? String(i).padStart(width, '0') : String(i));
  } else {
    const x = a.charCodeAt(0);
    const y = b.charCodeAt(0);
    const step = x <= y ? 1 : -1;
    for (let i = x; step > 0 ? i <= y : i >= y; i += step) out.push(String.fromCharCode(i));
  }
  return out;
}

export function braceExpand(segs) {
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i];
    if (s.type !== 'lit' || s.quoted) continue;
    const b = findBrace(s.text);
    if (!b) continue;
    const pre = s.text.slice(0, b.start);
    const post = s.text.slice(b.end + 1);
    const results = [];
    for (const alt of b.alts) {
      const nseg = segs.slice(0, i).concat([{ type: 'lit', text: pre + alt + post, quoted: false }], segs.slice(i + 1));
      results.push(...braceExpand(nseg));
    }
    return results;
  }
  return [segs];
}

// ---------- aritmética $(( )) ----------
export function evalArithmetic(expr, lookup) {
  const toks = [];
  const re = /\s*(\d+|[A-Za-z_][A-Za-z0-9_]*|\*\*|<=|>=|==|!=|&&|\|\||[-+*/%()<>!])/y;
  let m;
  let pos = 0;
  const src = expr.trim();
  while (pos < src.length) {
    re.lastIndex = pos;
    m = re.exec(src);
    if (!m) throw new ArithError('erro de sintaxe na expressão aritmética: "' + src.slice(pos).trim() + '"');
    toks.push(m[1]);
    pos = re.lastIndex;
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  }
  let i = 0;
  const peek = () => toks[i];
  const take = () => toks[i++];
  const prec = { '||': 1, '&&': 2, '==': 3, '!=': 3, '<': 4, '>': 4, '<=': 4, '>=': 4, '+': 5, '-': 5, '*': 6, '/': 6, '%': 6, '**': 7 };
  const primary = () => {
    const t = take();
    if (t === undefined) throw new ArithError('expressão aritmética incompleta');
    if (t === '(') { const v = expr_(1); if (take() !== ')') throw new ArithError('esperado ")"'); return v; }
    if (t === '-') return -primary();
    if (t === '+') return primary();
    if (t === '!') return primary() ? 0 : 1;
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    if (/^[A-Za-z_]/.test(t)) return lookup(t);
    throw new ArithError('erro de sintaxe na expressão aritmética: "' + t + '"');
  };
  const expr_ = (minPrec) => {
    let left = primary();
    while (peek() !== undefined && prec[peek()] !== undefined && prec[peek()] >= minPrec) {
      const op = take();
      const right = expr_(op === '**' ? prec[op] : prec[op] + 1);
      switch (op) {
        case '+': left = left + right; break;
        case '-': left = left - right; break;
        case '*': left = left * right; break;
        case '/': if (right === 0) throw new ArithError('divisão por 0'); left = Math.trunc(left / right); break;
        case '%': if (right === 0) throw new ArithError('divisão por 0'); left = left % right; break;
        case '**': left = Math.pow(left, right); break;
        case '<': left = left < right ? 1 : 0; break;
        case '>': left = left > right ? 1 : 0; break;
        case '<=': left = left <= right ? 1 : 0; break;
        case '>=': left = left >= right ? 1 : 0; break;
        case '==': left = left === right ? 1 : 0; break;
        case '!=': left = left !== right ? 1 : 0; break;
        case '&&': left = left && right ? 1 : 0; break;
        case '||': left = left || right ? 1 : 0; break;
      }
    }
    return left;
  };
  if (!toks.length) return 0;
  const v = expr_(1);
  if (i < toks.length) throw new ArithError('erro de sintaxe na expressão aritmética: "' + toks[i] + '"');
  return v;
}

export class ArithError extends ParseError {}
