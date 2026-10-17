import assert from 'assert';
import { test } from './harness.js';
import { parse, tokenize, IncompleteError, ParseError } from '../docs/ctf/js/shell/parser.js';

test('tokenize separa operadores e palavras', () => {
  const t = tokenize('ls -la | grep txt > saida.txt');
  assert.deepStrictEqual(t.map((x) => (x.t === 'op' ? x.v : 'W')), ['W', 'W', '|', 'W', 'W', '>', 'W']);
});

test('aspas simples e duplas', () => {
  const [w] = tokenize('"olá $nome"');
  assert.strictEqual(w.segs[0].text, 'olá ');
  assert.strictEqual(w.segs[1].type, 'var');
  const [w2] = tokenize("'$nome'");
  assert.strictEqual(w2.segs[0].text, '$nome');
});

test('if/elif/else/fi', () => {
  const ast = parse('if [ 1 -eq 1 ]; then echo a; elif true; then echo b; else echo c; fi');
  const cmd = ast.items[0].first.commands[0];
  assert.strictEqual(cmd.type, 'if');
  assert.strictEqual(cmd.clauses.length, 2);
  assert.ok(cmd.elseBody);
});

test('for e while', () => {
  assert.strictEqual(parse('for i in 1 2 3; do echo $i; done').items[0].first.commands[0].type, 'for');
  assert.strictEqual(parse('while true; do break; done').items[0].first.commands[0].type, 'while');
});

test('entrada incompleta é detectada', () => {
  assert.throws(() => parse('for i in 1 2; do'), IncompleteError);
  assert.throws(() => parse('echo "abc'), IncompleteError);
  assert.throws(() => parse('ls |'), IncompleteError);
  assert.throws(() => parse('if true; then echo x'), IncompleteError);
});

test('erros de sintaxe', () => {
  assert.throws(() => parse('fi'), ParseError);
  assert.throws(() => parse('echo a ;; echo b'), ParseError);
  assert.throws(() => parse('echo >'), ParseError);
});

test('atribuição de variável', () => {
  const s = parse('nome="Ana Maria"').items[0].first.commands[0];
  assert.strictEqual(s.assigns[0].name, 'nome');
  assert.strictEqual(s.words.length, 0);
});

test('palavra reservada como argumento não é estrutura', () => {
  const s = parse('echo done fi').items[0].first.commands[0];
  assert.strictEqual(s.words.length, 3);
});
