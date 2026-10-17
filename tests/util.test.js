import assert from 'assert';
import { test } from './harness.js';
import { sha256, base64Encode, base64Decode, globToRegex, makeRng, byteLength } from '../docs/ctf/js/shell/util.js';
import { VFS, normalizePath, modeString } from '../docs/ctf/js/shell/vfs.js';

test('sha256 confere com valores conhecidos', () => {
  assert.strictEqual(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.strictEqual(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.strictEqual(sha256('a'.repeat(100)).length, 64);
});

test('base64 ida e volta com acentos', () => {
  assert.strictEqual(base64Encode('oi\n'), 'b2kK');
  assert.strictEqual(base64Decode('b2kK'), 'oi\n');
  assert.strictEqual(base64Decode(base64Encode('ação ✓')), 'ação ✓');
});

test('glob para regex', () => {
  assert.ok(globToRegex('*.txt').test('a.txt'));
  assert.ok(!globToRegex('*.txt').test('a.txt.bak'));
  assert.ok(globToRegex('foto?.jpg').test('foto1.jpg'));
  assert.ok(globToRegex('[ab]*').test('banana'));
  assert.ok(globToRegex('a\\*').test('a*'));
  assert.ok(!globToRegex('a\\*').test('ab'));
});

test('rng determinístico pela semente', () => {
  const a = makeRng('abcdef12');
  const b = makeRng('abcdef12');
  assert.deepStrictEqual([a.next(), a.next()], [b.next(), b.next()]);
});

test('byteLength conta bytes UTF-8', () => {
  assert.strictEqual(byteLength('a'), 1);
  assert.strictEqual(byteLength('ç'), 2);
});

test('normalizePath resolve . e ..', () => {
  assert.strictEqual(normalizePath('../b/./c', '/home/a'), '/home/b/c');
  assert.strictEqual(normalizePath('/../..'), '/');
});

test('VFS respeita permissões do dono', () => {
  const v = new VFS('aluno');
  v.user = 'root';
  v.mkdir('/home/aluno', { parents: true, owner: 'aluno' });
  v.user = 'aluno';
  v.writeFile('/home/aluno/x', 'oi', { mode: 0o000 });
  assert.throws(() => v.readFile('/home/aluno/x'), /EACCES/);
  v.chmod('/home/aluno/x', 0o644);
  assert.strictEqual(v.readFile('/home/aluno/x'), 'oi');
  assert.strictEqual(modeString(v.lookup('/home/aluno/x')), '-rw-r--r--');
});

test('VFS serializa e restaura', () => {
  const v = new VFS('root');
  v.mkdir('/a/b', { parents: true });
  v.writeFile('/a/b/c.txt', 'conteúdo', { mode: 0o600 });
  const w = VFS.deserialize(v.serialize());
  assert.strictEqual(w.readFile('/a/b/c.txt'), 'conteúdo');
  assert.strictEqual(w.lookup('/a/b/c.txt').mode, 0o600);
});
