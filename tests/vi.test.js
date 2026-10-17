import assert from 'assert';
import { test, makeShell } from './harness.js';
import { createVi, viKey, viText, viPaste } from '../docs/ctf/js/vi.js';

// Digita uma sequência: texto comum vira teclas; <Esc>, <Enter>, <BS> são teclas especiais.
function type(s, seq, opts) {
  const re = /<(Esc|Enter|BS|Left|Right|Up|Down)>|./g;
  const map = { Esc: 'Escape', Enter: 'Enter', BS: 'Backspace', Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown' };
  let m;
  while ((m = re.exec(seq))) viKey(s, m[1] ? map[m[1]] : m[0], opts);
  return s;
}

test('vi: começa no modo normal; i entra em inserção e Esc volta', () => {
  const s = createVi('');
  assert.strictEqual(s.mode, 'normal');
  type(s, 'iolá mundo<Esc>');
  assert.strictEqual(s.mode, 'normal');
  assert.strictEqual(viText(s), 'olá mundo\n');
  assert.ok(s.modified);
});

test('vi: no modo normal, letras são comandos (não viram texto)', () => {
  const s = createVi('abc\n');
  type(s, 'jjkk');
  assert.strictEqual(viText(s), 'abc\n');
  assert.strictEqual(s.modified, false);
});

test('vi: :wq salva e fecha; :q com alterações recusa; :q! sai sem salvar', () => {
  let saved = null;
  const save = (t) => { saved = t; };
  let s = createVi('linha\n');
  type(s, 'A fim<Esc>:q<Enter>', { save });
  assert.strictEqual(s.quit, false);
  assert.match(s.msg, /E37/);
  type(s, ':wq<Enter>', { save });
  assert.strictEqual(s.quit, true);
  assert.strictEqual(saved, 'linha fim\n');

  saved = null;
  s = createVi('x\n');
  type(s, 'ddix<Esc>:q!<Enter>', { save });
  assert.strictEqual(s.quit, true);
  assert.strictEqual(saved, null);
});

test('vi: :w salva sem sair, :x e ZZ salvam e saem', () => {
  let saved = 0;
  const save = () => { saved++; };
  const s = createVi('a\n');
  type(s, 'ib<Esc>:w<Enter>', { save });
  assert.strictEqual(saved, 1);
  assert.strictEqual(s.quit, false);
  assert.strictEqual(s.modified, false);
  type(s, 'ic<Esc>ZZ', { save });
  assert.strictEqual(saved, 2);
  assert.ok(s.quit);
});

test('vi: comando desconhecido mostra erro E492', () => {
  const s = createVi('');
  type(s, ':salvar<Enter>');
  assert.match(s.msg, /E492/);
  assert.strictEqual(s.mode, 'normal');
});

test('vi: o, O, dd, yy+p, x, D, u (desfazer)', () => {
  const s = createVi('um\ndois\n');
  type(s, 'onovo<Esc>');
  assert.strictEqual(viText(s), 'um\nnovo\ndois\n');
  type(s, 'dd');
  assert.strictEqual(viText(s), 'um\ndois\n');
  type(s, 'u');
  assert.strictEqual(viText(s), 'um\nnovo\ndois\n');
  type(s, 'ggyyGp');
  assert.strictEqual(viText(s), 'um\nnovo\ndois\num\n');
  type(s, 'gg0x');
  assert.strictEqual(s.lines[0], 'm');
  type(s, 'jlD');
  assert.strictEqual(s.lines[1], 'n');
  type(s, 'Ozero<Esc>');
  assert.strictEqual(s.lines[1], 'zero');
});

test('vi: Enter e Backspace no modo de inserção quebram e juntam linhas', () => {
  const s = createVi('');
  type(s, 'iif true; then<Enter>  echo oi<Enter>fi<Esc>');
  assert.strictEqual(viText(s), 'if true; then\n  echo oi\n  fi\n');
  type(s, 'I<BS><BS><BS><Esc>');
  assert.strictEqual(viText(s), 'if true; then\n  echo oifi\n');
});

test('vi: colar texto com várias linhas', () => {
  const s = createVi('');
  type(s, 'i');
  viPaste(s, '#!/bin/bash\necho ok');
  type(s, '<Esc>');
  assert.strictEqual(viText(s), '#!/bin/bash\necho ok\n');
});

test('vi: arquivo somente leitura recusa :w', () => {
  let saved = false;
  const s = createVi('x\n', { readonly: true });
  type(s, 'iy<Esc>:w<Enter>', { save: () => { saved = true; } });
  assert.strictEqual(saved, false);
  assert.match(s.msg, /E45/);
});

test('comando vi/vim abre o editor no modo vi e salva o arquivo', async () => {
  const s = makeShell();
  let mode = null;
  const orig = s.io.edit;
  s.io.edit = async (opts) => { mode = opts.mode; opts.save('#!/bin/bash\necho do vi\n'); };
  await s.run('vi teste.sh');
  assert.strictEqual(mode, 'vi');
  assert.strictEqual(await s.out('bash teste.sh'), 'do vi\n');
  await s.run('vim outro.sh');
  assert.strictEqual(mode, 'vi');
  s.io.edit = orig;
  assert.match(await s.out('vi'), /informe o nome do arquivo/);
  assert.match(await s.out('man vi'), /:q!/);
  assert.match(await s.out('vi /etc'), /é um diretório/);
});
