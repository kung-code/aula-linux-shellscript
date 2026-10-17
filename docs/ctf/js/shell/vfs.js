// Sistema de arquivos virtual em memória, com dono e permissões no estilo Unix.

export class FsError extends Error {
  constructor(code, path) {
    super(code + ': ' + path);
    this.code = code;
    this.path = path;
  }
}

export const MENSAGENS_ERRO = {
  ENOENT: 'Arquivo ou diretório inexistente',
  EACCES: 'Permissão negada',
  EISDIR: 'É um diretório',
  ENOTDIR: 'Não é um diretório',
  EEXIST: 'Arquivo existe',
  ENOTEMPTY: 'Diretório não vazio',
  EPERM: 'Operação não permitida',
  EINVAL: 'Argumento inválido',
};

export function mensagemErro(e) {
  if (e instanceof FsError) return MENSAGENS_ERRO[e.code] || e.code;
  return String(e && e.message ? e.message : e);
}

let clock = () => Date.now();
export function setClock(fn) { clock = fn; }

function makeNode(type, name, opts = {}) {
  const node = {
    type,
    name,
    parent: null,
    mode: opts.mode !== undefined ? opts.mode : type === 'dir' ? 0o755 : 0o644,
    owner: opts.owner || 'root',
    group: opts.group || opts.owner || 'root',
    mtime: opts.mtime || clock(),
  };
  if (type === 'dir') node.children = new Map();
  else {
    node.content = opts.content || '';
    if (opts.exec) node.exec = opts.exec; // "binário" implementado em JS
    if (opts.device) node.device = opts.device; // ex.: /dev/null
  }
  return node;
}

export function splitPath(abs) {
  return abs.split('/').filter(Boolean);
}

export function normalizePath(path, cwd = '/') {
  const base = path.startsWith('/') ? [] : splitPath(cwd);
  for (const part of splitPath(path)) {
    if (part === '.') continue;
    if (part === '..') base.pop();
    else base.push(part);
  }
  return '/' + base.join('/');
}

export function dirname(abs) {
  const parts = splitPath(abs);
  parts.pop();
  return '/' + parts.join('/');
}

export function basename(abs) {
  const parts = splitPath(abs);
  return parts.length ? parts[parts.length - 1] : '/';
}

export class VFS {
  constructor(user = 'aluno') {
    this.user = user;
    this.root = makeNode('dir', '', { mode: 0o755 });
  }

  // ---------- permissões ----------
  perm(node, bit) {
    // bit: 4 = r, 2 = w, 1 = x
    if (this.user === 'root') return bit !== 1 || node.type === 'dir' || (node.mode & 0o111) !== 0;
    let shift;
    if (node.owner === this.user) shift = 6;
    else if (node.group === this.user) shift = 3;
    else shift = 0;
    return ((node.mode >> shift) & bit) !== 0;
  }
  canRead(node) { return this.perm(node, 4); }
  canWrite(node) { return this.perm(node, 2); }
  canExec(node) { return this.perm(node, 1); }

  // ---------- navegação ----------
  // Retorna o nó do caminho absoluto. Lança FsError.
  // checkTraverse: exige permissão x nos diretórios intermediários.
  lookup(abs, { checkTraverse = true } = {}) {
    let node = this.root;
    const parts = splitPath(abs);
    for (let i = 0; i < parts.length; i++) {
      if (node.type !== 'dir') throw new FsError('ENOTDIR', abs);
      if (checkTraverse && !this.canExec(node)) throw new FsError('EACCES', abs);
      const next = node.children.get(parts[i]);
      if (!next) throw new FsError('ENOENT', abs);
      node = next;
    }
    return node;
  }

  exists(abs) {
    try { this.lookup(abs); return true; } catch (e) { return false; }
  }

  tryLookup(abs) {
    try { return this.lookup(abs); } catch (e) { return null; }
  }

  pathOf(node) {
    const parts = [];
    while (node && node.parent) { parts.unshift(node.name); node = node.parent; }
    return '/' + parts.join('/');
  }

  // Diretório-pai (já validado) para criar/remover uma entrada.
  parentFor(abs, { needWrite = true } = {}) {
    if (abs === '/') throw new FsError('EEXIST', abs);
    const parent = this.lookup(dirname(abs));
    if (parent.type !== 'dir') throw new FsError('ENOTDIR', abs);
    if (needWrite && !this.canWrite(parent)) throw new FsError('EACCES', abs);
    return parent;
  }

  attach(parent, node) {
    node.parent = parent;
    parent.children.set(node.name, node);
    parent.mtime = clock();
  }

  // ---------- leitura ----------
  readFile(abs) {
    const node = this.lookup(abs);
    if (node.type === 'dir') throw new FsError('EISDIR', abs);
    if (!this.canRead(node)) throw new FsError('EACCES', abs);
    if (node.device === 'null') return '';
    return node.content;
  }

  readDir(abs) {
    const node = this.lookup(abs);
    if (node.type !== 'dir') throw new FsError('ENOTDIR', abs);
    if (!this.canRead(node)) throw new FsError('EACCES', abs);
    return Array.from(node.children.values());
  }

  // ---------- escrita ----------
  writeFile(abs, content, { append = false, mode, owner, exec } = {}) {
    let node = this.tryLookup(abs);
    if (node) {
      if (node.type === 'dir') throw new FsError('EISDIR', abs);
      if (node.device === 'null') return node;
      if (!this.canWrite(node)) throw new FsError('EACCES', abs);
      node.content = append ? node.content + content : content;
      node.mtime = clock();
      return node;
    }
    const parent = this.parentFor(abs);
    node = makeNode('file', basename(abs), {
      content,
      mode: mode !== undefined ? mode : 0o644,
      owner: owner || this.user,
      exec,
    });
    this.attach(parent, node);
    return node;
  }

  touch(abs) {
    const node = this.tryLookup(abs);
    if (node) { node.mtime = clock(); return node; }
    return this.writeFile(abs, '');
  }

  mkdir(abs, { parents = false, mode, owner } = {}) {
    if (parents) {
      let cur = '';
      let node = this.root;
      for (const part of splitPath(abs)) {
        cur += '/' + part;
        const next = node.children.get(part);
        if (next) {
          if (next.type !== 'dir') throw new FsError('ENOTDIR', cur);
          node = next;
          continue;
        }
        if (!this.canWrite(node)) throw new FsError('EACCES', cur);
        const created = makeNode('dir', part, { mode: mode !== undefined ? mode : 0o755, owner: owner || this.user });
        this.attach(node, created);
        node = created;
      }
      return node;
    }
    if (this.tryLookup(abs)) throw new FsError('EEXIST', abs);
    const parent = this.parentFor(abs);
    const node = makeNode('dir', basename(abs), { mode: mode !== undefined ? mode : 0o755, owner: owner || this.user });
    this.attach(parent, node);
    return node;
  }

  remove(abs, { recursive = false } = {}) {
    const node = this.lookup(abs);
    if (node === this.root) throw new FsError('EPERM', abs);
    const parent = this.parentFor(abs);
    if (node.type === 'dir') {
      if (!recursive && node.children.size > 0) throw new FsError('ENOTEMPTY', abs);
      if (recursive) this.checkRemovable(node, abs);
    }
    parent.children.delete(node.name);
    parent.mtime = clock();
  }

  // Remoção recursiva exige permissão de escrita/leitura em toda a subárvore.
  checkRemovable(dir, abs) {
    if (!this.canRead(dir) || !this.canWrite(dir) || !this.canExec(dir)) throw new FsError('EACCES', abs);
    for (const child of dir.children.values()) {
      if (child.type === 'dir') this.checkRemovable(child, abs + '/' + child.name);
    }
  }

  cloneNode(node, name) {
    const copy = makeNode(node.type, name, {
      mode: node.mode, owner: this.user, content: node.content, exec: node.exec, device: node.device,
    });
    if (node.type === 'dir') {
      for (const child of node.children.values()) {
        if (!this.canRead(child)) throw new FsError('EACCES', this.pathOf(child));
        const c = this.cloneNode(child, child.name);
        c.parent = copy;
        copy.children.set(c.name, c);
      }
    }
    return copy;
  }

  copy(src, dest) {
    const node = this.lookup(src);
    if (!this.canRead(node)) throw new FsError('EACCES', src);
    const existing = this.tryLookup(dest);
    if (existing && existing.type === 'dir' && node.type === 'dir') throw new FsError('EEXIST', dest);
    if (existing && node.type === 'file') {
      return this.writeFile(dest, node.content);
    }
    const parent = this.parentFor(dest);
    const copy = this.cloneNode(node, basename(dest));
    this.attach(parent, copy);
    return copy;
  }

  move(src, dest) {
    const node = this.lookup(src);
    if (node === this.root) throw new FsError('EPERM', src);
    if (node.type === 'dir' && (dest + '/').startsWith(src + '/')) throw new FsError('EINVAL', dest);
    const oldParent = this.parentFor(src);
    const newParent = this.parentFor(dest);
    const existing = newParent.children.get(basename(dest));
    if (existing && existing.type === 'dir') {
      if (node.type !== 'dir') throw new FsError('EISDIR', dest);
      if (existing.children.size > 0) throw new FsError('ENOTEMPTY', dest);
    }
    oldParent.children.delete(node.name);
    node.name = basename(dest);
    this.attach(newParent, node);
    oldParent.mtime = clock();
    return node;
  }

  chmod(abs, mode) {
    const node = this.lookup(abs);
    if (this.user !== 'root' && node.owner !== this.user) throw new FsError('EPERM', abs);
    node.mode = mode & 0o7777;
    return node;
  }

  // Caminhada recursiva (pré-ordem). onError recebe FsError de diretórios ilegíveis.
  walk(abs, visit, onError) {
    const node = this.lookup(abs);
    const rec = (n, path, depth) => {
      visit(n, path, depth);
      if (n.type !== 'dir') return;
      if (!this.canRead(n) || !this.canExec(n)) {
        if (onError) onError(new FsError('EACCES', path));
        return;
      }
      const kids = Array.from(n.children.values()).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
      for (const k of kids) rec(k, path === '/' ? '/' + k.name : path + '/' + k.name, depth + 1);
    };
    rec(node, abs, 0);
  }

  // ---------- serialização ----------
  serialize() {
    const ser = (n) => {
      const o = { t: n.type === 'dir' ? 'd' : 'f', n: n.name, m: n.mode, o: n.owner, g: n.group, ti: n.mtime };
      if (n.type === 'dir') o.c = Array.from(n.children.values()).map(ser);
      else {
        o.x = n.content;
        if (n.exec) o.e = n.exec;
        if (n.device) o.dv = n.device;
      }
      return o;
    };
    return JSON.stringify({ user: this.user, root: ser(this.root) });
  }

  static deserialize(json) {
    const data = JSON.parse(json);
    const vfs = new VFS(data.user);
    const de = (o) => {
      const n = makeNode(o.t === 'd' ? 'dir' : 'file', o.n, {
        mode: o.m, owner: o.o, group: o.g, mtime: o.ti, content: o.x, exec: o.e, device: o.dv,
      });
      if (o.c) for (const c of o.c) { const child = de(c); child.parent = n; n.children.set(child.name, child); }
      return n;
    };
    vfs.root = de(data.root);
    return vfs;
  }
}

// Formata o modo como no ls -l: drwxr-xr-x
export function modeString(node) {
  const t = node.type === 'dir' ? 'd' : node.device ? 'c' : '-';
  let s = t;
  for (const shift of [6, 3, 0]) {
    const bits = (node.mode >> shift) & 7;
    s += (bits & 4 ? 'r' : '-') + (bits & 2 ? 'w' : '-') + (bits & 1 ? 'x' : '-');
  }
  return s;
}
