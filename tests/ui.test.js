import assert from 'assert';
import fs from 'fs';
import { test, makeShell } from './harness.js';
import { shouldUseMobile, clampFont, hintIndex, hintView, FONT_MIN, FONT_MAX } from '../docs/ctf/js/ui.js';
import { CtfGame } from '../docs/ctf/js/ctf/game.js';

test('modo celular: liga sozinho em tela estreita ou de toque, e respeita a escolha salva', () => {
  assert.strictEqual(shouldUseMobile({ saved: undefined, width: 390, coarse: true }), true);
  assert.strictEqual(shouldUseMobile({ saved: undefined, width: 700, coarse: false }), true);
  assert.strictEqual(shouldUseMobile({ saved: undefined, width: 1366, coarse: false }), false);
  assert.strictEqual(shouldUseMobile({ saved: undefined, width: 900, coarse: true }), true); // tablet
  assert.strictEqual(shouldUseMobile({ saved: false, width: 390, coarse: true }), false);
  assert.strictEqual(shouldUseMobile({ saved: true, width: 1920, coarse: false }), true);
});

test('tamanho da fonte do terminal fica entre os limites', () => {
  assert.strictEqual(clampFont(3), FONT_MIN);
  assert.strictEqual(clampFont(99), FONT_MAX);
  assert.strictEqual(clampFont(15.4), 15);
  assert.strictEqual(clampFont('abc'), 14);
});

test('dicas: navegação só entre as dicas já liberadas', () => {
  assert.strictEqual(hintIndex(0, -1, 3), 0);
  assert.strictEqual(hintIndex(0, 1, 2), 1);
  assert.strictEqual(hintIndex(1, 1, 2), 1);
  assert.strictEqual(hintIndex(5, 0, 0), 0);
  const v = hintView({ index: 0, unlocked: 2, total: 3, solved: false });
  assert.deepStrictEqual([v.canPrev, v.canNext, v.canReveal, v.revealFree], [false, true, true, false]);
  assert.deepStrictEqual(v.dots, ['current', 'unlocked', 'locked']);
  const all = hintView({ index: 2, unlocked: 3, total: 3, solved: true });
  assert.deepStrictEqual([all.canPrev, all.canNext, all.canReveal], [true, false, false]);
});

// Regressão: depois de liberar todas as dicas, só a última aparecia.
test('dicas anteriores continuam acessíveis depois de liberar a última', () => {
  const g = new CtfGame('Ada');
  g.hint(4); g.hint(4); g.hint(4); g.hint(4);
  const hints = g.unlockedHints(4);
  assert.strictEqual(hints.length, 3);
  assert.match(hints[0], /PROCURAR/);
  assert.strictEqual(g.unlockedHints(1).length, 0);
  assert.strictEqual(g.hintsUsed(4), 3);
});

test('comando dica mostra todas as dicas já liberadas, marcando a nova', async () => {
  const s = makeShell({ nick: 'Ada' });
  let out = await s.out('dica 2');
  assert.match(out, /Dica 1\/3 do nível 2:.*nova/);
  out = await s.out('dica 2');
  assert.match(out, /Dica 1\/3 do nível 2:/);
  assert.match(out, /Dica 2\/3 do nível 2:.*nova/);
  await s.run('dica 2');
  out = await s.out('dica 2');
  assert.strictEqual((out.match(/Dica \d\/3/g) || []).length, 3);
  assert.match(out, /já liberou todas/);
});

test('página do CTF tem as abas do modo celular e cada aba tem conteúdo', () => {
  const html = fs.readFileSync(new URL('../docs/ctf/index.html', import.meta.url), 'utf8');
  const tabs = (html.match(/data-tab="(\w+)"/g) || []).map((t) => t.slice(10, -1));
  assert.deepStrictEqual(tabs, ['terminal', 'niveis', 'enviar', 'ajuda']);
  for (const t of tabs.slice(1)) assert.ok(new RegExp('data-mpanel="[^"]*\\b' + t + '\\b').test(html), 'aba sem conteúdo: ' + t);
  for (const id of ['btn-mobile', 'font-up', 'font-down', 'hint-prev', 'hint-next', 'hint-reveal']) assert.ok(html.includes('id="' + id + '"'), id);
});
