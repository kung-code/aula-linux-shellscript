// Lexer + parser de um subconjunto do bash.
//
// Suporta: palavras com aspas simples/duplas e escape, $VAR, ${VAR}, $(cmd), `cmd`, $((expr)),
// pipes, &&, ||, ;, quebras de linha, redirecionamentos (> >> < 2> 2>> &> 2>&1),
// if/elif/else/fi, for/in/do/done, while/until, comentários (#) e continuação de linha.

export class ParseError extends Error {}
// Lançado quando a entrada termina no meio de uma estrutura (ex.: "if" sem "fi").
export class IncompleteError extends ParseError {}

const RESERVED = new Set(['if', 'then', 'elif', 'else', 'fi', 'for', 'in', 'do', 'done', 'while', 'until', '!']);

// Encontra o fim de $( ... ), respeitando aspas e parênteses aninhados.
function scanParen(src, i) {
  let depth = 1;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\') { i += 2; continue; }
    if (ch === "'") {
      const end = src.indexOf("'", i + 1);
      if (end === -1) throw new IncompleteError("aspas simples não fechadas");
      i = end + 1; continue;
    }
    if (ch === '"') {
      i++;
      while (i < src.length && src[i] !== '"') { if (src[i] === '\\') i++; i++; }
      if (i >= src.length) throw new IncompleteError('aspas duplas não fechadas');
      i++; continue;
    }
    if (ch === '(') depth++;
    else if (ch === ')') { depth--; if (depth === 0) return i; }
    i++;
  }
  throw new IncompleteError('parêntese não fechado');
}

// Lê um "$..." a partir de src[i] === '$'. Retorna [segmento, novoIndice].
function scanDollar(src, i, quoted) {
  const next = src[i + 1];
  if (next === '(' && src[i + 2] === '(') {
    const end = scanParen(src, i + 3); // fecha o primeiro )
    if (src[end + 1] !== ')') throw new ParseError('esperado ")" em expressão aritmética');
    return [{ type: 'arith', expr: src.slice(i + 3, end), quoted }, end + 2];
  }
  if (next === '(') {
    const end = scanParen(src, i + 2);
    return [{ type: 'cmd', src: src.slice(i + 2, end), quoted }, end + 1];
  }
  if (next === '{') {
    const end = src.indexOf('}', i + 2);
    if (end === -1) throw new IncompleteError('chave não fechada');
    const name = src.slice(i + 2, end);
    if (name.startsWith('#') && /^#[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      return [{ type: 'var', name: name.slice(1), length: true, quoted }, end + 1];
    }
    if (!/^([A-Za-z_][A-Za-z0-9_]*|[0-9]+|[?#@*$])$/.test(name)) throw new ParseError('${' + name + '}: substituição incorreta');
    return [{ type: 'var', name, quoted }, end + 1];
  }
  if (next !== undefined && /[?#@*$0-9]/.test(next)) return [{ type: 'var', name: next, quoted }, i + 2];
  const m = /^[A-Za-z_][A-Za-z0-9_]*/.exec(src.slice(i + 1));
  if (m) return [{ type: 'var', name: m[0], quoted }, i + 1 + m[0].length];
  return [{ type: 'lit', text: '$', quoted }, i + 1];
}

function isWordBreak(ch) {
  return ch === undefined || /[\s|&;<>()]/.test(ch);
}

export function tokenize(src) {
  const tokens = [];
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (ch === '\\' && src[i + 1] === '\n') { i += 2; continue; }
    if (ch === ' ' || ch === '\t' || ch === '\r') { i++; continue; }
    if (ch === '\n') { tokens.push({ t: 'op', v: '\n' }); i++; continue; }
    if (ch === '#') {
      while (i < src.length && src[i] !== '\n') i++;
      continue;
    }
    // operadores
    const two = src.slice(i, i + 2);
    const four = src.slice(i, i + 4);
    if (four === '2>&1') { tokens.push({ t: 'op', v: '2>&1' }); i += 4; continue; }
    if (src.slice(i, i + 3) === '2>>') { tokens.push({ t: 'op', v: '2>>' }); i += 3; continue; }
    if (two === '2>' && (i === 0 || isWordBreak(src[i - 1]))) { tokens.push({ t: 'op', v: '2>' }); i += 2; continue; }
    if (two === '&>') { tokens.push({ t: 'op', v: '&>' }); i += 2; continue; }
    if (two === '&&' || two === '||' || two === '>>' || two === ';;') { tokens.push({ t: 'op', v: two }); i += 2; continue; }
    if (two === '<<') throw new ParseError('here-documents (<<) não são suportados neste simulador');
    if ('|;<>'.includes(ch)) { tokens.push({ t: 'op', v: ch }); i++; continue; }
    if (ch === '&') throw new ParseError('execução em segundo plano (&) não é suportada neste simulador');
    if (ch === '(' || ch === ')') throw new ParseError('subshells com ( ) não são suportados neste simulador');

    // palavra
    const segs = [];
    let lit = '';
    const flush = (quoted) => { if (lit) { segs.push({ type: 'lit', text: lit, quoted }); lit = ''; } };
    while (i < src.length && !isWordBreak(src[i])) {
      const c = src[i];
      if (c === '\\') {
        if (src[i + 1] === '\n') { i += 2; continue; }
        flush(false);
        if (i + 1 < src.length) segs.push({ type: 'lit', text: src[i + 1], quoted: true });
        i += 2;
      } else if (c === "'") {
        flush(false);
        const end = src.indexOf("'", i + 1);
        if (end === -1) throw new IncompleteError('aspas simples não fechadas');
        segs.push({ type: 'lit', text: src.slice(i + 1, end), quoted: true });
        i = end + 1;
      } else if (c === '"') {
        flush(false);
        i++;
        let any = false;
        while (true) {
          if (i >= src.length) throw new IncompleteError('aspas duplas não fechadas');
          const d = src[i];
          if (d === '"') { i++; break; }
          if (d === '\\' && '"\\$`\n'.includes(src[i + 1])) {
            if (src[i + 1] !== '\n') lit += src[i + 1];
            i += 2; continue;
          }
          if (d === '$') {
            flush(true);
            const [seg, ni] = scanDollar(src, i, true);
            segs.push(seg); i = ni; any = true; continue;
          }
          if (d === '`') {
            flush(true);
            const end = src.indexOf('`', i + 1);
            if (end === -1) throw new IncompleteError('crase não fechada');
            segs.push({ type: 'cmd', src: src.slice(i + 1, end), quoted: true });
            i = end + 1; any = true; continue;
          }
          lit += d; i++;
        }
        if (lit || !any) { segs.push({ type: 'lit', text: lit, quoted: true }); lit = ''; }
      } else if (c === '$') {
        flush(false);
        const [seg, ni] = scanDollar(src, i, false);
        segs.push(seg); i = ni;
      } else if (c === '`') {
        flush(false);
        const end = src.indexOf('`', i + 1);
        if (end === -1) throw new IncompleteError('crase não fechada');
        segs.push({ type: 'cmd', src: src.slice(i + 1, end), quoted: false });
        i = end + 1;
      } else {
        lit += c; i++;
      }
    }
    flush(false);
    tokens.push({ t: 'word', segs });
  }
  return tokens;
}

// Texto "cru" da palavra se ela for um literal simples sem aspas (para palavras reservadas).
export function plainWord(tok) {
  if (!tok || tok.t !== 'word') return null;
  if (tok.segs.length !== 1) return null;
  const s = tok.segs[0];
  return s.type === 'lit' && !s.quoted ? s.text : null;
}

const REDIR_OPS = new Set(['>', '>>', '<', '2>', '2>>', '&>', '2>&1']);

class Parser {
  constructor(tokens) {
    this.toks = tokens;
    this.pos = 0;
  }
  peek() { return this.toks[this.pos]; }
  next() { return this.toks[this.pos++]; }
  atEnd() { return this.pos >= this.toks.length; }
  isOp(v) { const t = this.peek(); return t && t.t === 'op' && t.v === v; }
  isReserved(v) { return plainWord(this.peek()) === v; }

  skipNewlines() { while (this.isOp('\n')) this.pos++; }
  skipSeparators() { while (this.isOp('\n') || this.isOp(';')) this.pos++; }

  expectReserved(v) {
    this.skipSeparators();
    if (this.atEnd()) throw new IncompleteError('esperado "' + v + '"');
    if (!this.isReserved(v)) throw new ParseError('erro de sintaxe próximo a "' + this.describe(this.peek()) + '" (esperado "' + v + '")');
    this.pos++;
  }

  describe(tok) {
    if (!tok) return 'fim da linha';
    if (tok.t === 'op') return tok.v === '\n' ? 'nova linha' : tok.v;
    return tok.segs.map((s) => s.text || ('$' + (s.name || ''))).join('');
  }

  // list: and_or ((; | \n) and_or)*   — para nas palavras de 'stops'
  parseList(stops) {
    const items = [];
    while (true) {
      this.skipSeparators();
      if (this.atEnd()) break;
      const pw = plainWord(this.peek());
      if (pw && stops.has(pw)) break;
      if (this.peek().t === 'op' && !REDIR_OPS.has(this.peek().v)) {
        throw new ParseError('erro de sintaxe próximo ao token inesperado "' + this.describe(this.peek()) + '"');
      }
      items.push(this.parseAndOr(stops));
      if (!this.atEnd() && !this.isOp(';') && !this.isOp('\n')) {
        const pw2 = plainWord(this.peek());
        if (pw2 && stops.has(pw2)) break;
        throw new ParseError('erro de sintaxe próximo ao token inesperado "' + this.describe(this.peek()) + '"');
      }
    }
    return { type: 'list', items };
  }

  parseAndOr(stops) {
    const first = this.parsePipeline(stops);
    const rest = [];
    while (this.isOp('&&') || this.isOp('||')) {
      const op = this.next().v;
      this.skipNewlines();
      if (this.atEnd()) throw new IncompleteError('comando esperado após ' + op);
      rest.push({ op, pipeline: this.parsePipeline(stops) });
    }
    return { type: 'andor', first, rest };
  }

  parsePipeline(stops) {
    let negate = false;
    if (this.isReserved('!')) { this.pos++; negate = true; }
    const commands = [this.parseCommand(stops)];
    while (this.isOp('|')) {
      this.pos++;
      this.skipNewlines();
      if (this.atEnd()) throw new IncompleteError('comando esperado após |');
      commands.push(this.parseCommand(stops));
    }
    return { type: 'pipeline', negate, commands };
  }

  parseCommand(stops) {
    const pw = plainWord(this.peek());
    let node;
    if (pw === 'if') node = this.parseIf();
    else if (pw === 'for') node = this.parseFor();
    else if (pw === 'while' || pw === 'until') node = this.parseWhile(pw === 'until');
    else if (pw && RESERVED.has(pw) && pw !== '!') {
      throw new ParseError('erro de sintaxe próximo ao token inesperado "' + pw + '"');
    } else return this.parseSimple(stops);
    node.redirs = this.parseRedirs();
    return node;
  }

  parseRedirs() {
    const redirs = [];
    while (!this.atEnd() && this.peek().t === 'op' && REDIR_OPS.has(this.peek().v)) {
      redirs.push(this.parseRedir());
    }
    return redirs;
  }

  parseRedir() {
    const op = this.next().v;
    if (op === '2>&1') return { op };
    const target = this.peek();
    if (!target || target.t !== 'word') {
      if (!target || target.v === '\n') throw new ParseError('erro de sintaxe próximo ao token inesperado "nova linha"');
      throw new ParseError('erro de sintaxe próximo ao token inesperado "' + this.describe(target) + '"');
    }
    this.pos++;
    return { op, target };
  }

  parseSimple() {
    const assigns = [];
    const words = [];
    const redirs = [];
    while (!this.atEnd()) {
      const tok = this.peek();
      if (tok.t === 'op') {
        if (REDIR_OPS.has(tok.v)) { redirs.push(this.parseRedir()); continue; }
        break;
      }
      if (words.length === 0) {
        const first = tok.segs[0];
        if (first && first.type === 'lit' && !first.quoted) {
          const m = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(first.text);
          if (m) {
            const rest = first.text.slice(m[0].length);
            const valueSegs = (rest ? [{ type: 'lit', text: rest, quoted: false }] : []).concat(tok.segs.slice(1));
            assigns.push({ name: m[1], value: { t: 'word', segs: valueSegs } });
            this.pos++;
            continue;
          }
        }
      }
      words.push(tok);
      this.pos++;
    }
    if (!words.length && !assigns.length && !redirs.length) {
      throw new ParseError('erro de sintaxe próximo ao token inesperado "' + this.describe(this.peek()) + '"');
    }
    return { type: 'simple', assigns, words, redirs };
  }

  parseIf() {
    this.pos++; // if
    const clauses = [];
    let elseBody = null;
    const cond = this.parseList(new Set(['then']));
    this.expectReserved('then');
    const body = this.parseList(new Set(['elif', 'else', 'fi']));
    clauses.push({ cond, body });
    while (true) {
      this.skipSeparators();
      if (this.atEnd()) throw new IncompleteError('esperado "fi"');
      if (this.isReserved('elif')) {
        this.pos++;
        const c = this.parseList(new Set(['then']));
        this.expectReserved('then');
        const b = this.parseList(new Set(['elif', 'else', 'fi']));
        clauses.push({ cond: c, body: b });
      } else if (this.isReserved('else')) {
        this.pos++;
        elseBody = this.parseList(new Set(['fi']));
      } else break;
    }
    this.expectReserved('fi');
    this.checkEmpty(clauses.map((c) => c.cond).concat(clauses.map((c) => c.body)), 'if');
    return { type: 'if', clauses, elseBody };
  }

  checkEmpty(lists, kw) {
    for (const l of lists) if (l && l.items.length === 0) throw new ParseError('erro de sintaxe: bloco vazio no "' + kw + '"');
  }

  parseFor() {
    this.pos++; // for
    const nameTok = this.next();
    if (this.atEnd() && !nameTok) throw new IncompleteError('esperado nome de variável');
    const name = plainWord(nameTok);
    if (!name || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) throw new ParseError('for: nome de variável inválido');
    let words = null;
    if (this.isReserved('in')) {
      this.pos++;
      words = [];
      while (!this.atEnd() && this.peek().t === 'word') {
        if (plainWord(this.peek()) === 'do') break;
        words.push(this.next());
      }
    }
    this.expectReserved('do');
    const body = this.parseList(new Set(['done']));
    this.expectReserved('done');
    this.checkEmpty([body], 'for');
    return { type: 'for', name, words, body };
  }

  parseWhile(until) {
    this.pos++;
    const cond = this.parseList(new Set(['do']));
    this.expectReserved('do');
    const body = this.parseList(new Set(['done']));
    this.expectReserved('done');
    this.checkEmpty([cond, body], until ? 'until' : 'while');
    return { type: 'while', until, cond, body };
  }
}

export function parse(src) {
  const tokens = tokenize(src);
  // Operador no final da entrada => comando incompleto (continua na próxima linha)
  const last = tokens.filter((t) => !(t.t === 'op' && t.v === '\n')).pop();
  if (last && last.t === 'op' && (last.v === '|' || last.v === '&&' || last.v === '||')) {
    throw new IncompleteError('comando esperado após ' + last.v);
  }
  const p = new Parser(tokens);
  const list = p.parseList(new Set());
  if (!p.atEnd()) {
    const pw = plainWord(p.peek());
    throw new ParseError('erro de sintaxe próximo ao token inesperado "' + (pw || p.describe(p.peek())) + '"');
  }
  return list;
}
