import assert from 'assert';
import fs from 'fs';
import { test, makeShell } from './harness.js';
import { ROTEIRO } from '../docs/terminal/js/roteiro.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

test('terminal de prática: todos os comandos do roteiro rodam no simulador, na ordem', async () => {
  const s = makeShell();
  const BAD = /comando não encontrado|erro de sintaxe|opção inválida|erro interno|não suportad/;
  // erros que fazem parte da lição
  const EXPECTED = new Set(['ls /nao_existe 2> erros.txt', './ola.sh']);
  let total = 0;
  for (const sec of ROTEIRO) {
    assert.ok(sec.title && sec.cmds.length, 'seção vazia');
    for (const c of sec.cmds) {
      total++;
      const r = await s.run(c);
      assert.ok(!BAD.test(r.out), 'comando do roteiro falhou: ' + c + '\n' + r.out);
      if (r.status !== 0 && !EXPECTED.has(c) && c !== 'cat erros.txt') assert.fail('status ' + r.status + ' em: ' + c + '\n' + r.out);
    }
  }
  assert.ok(total >= 40, 'roteiro curto: ' + total);
  assert.ok(s.vfs.exists('/home/aluno/aula/projeto/scripts'));
  assert.match((await s.run('./ola.sh')).out, /Olá, aluno!/);
});

test('slides apontam a prática para o terminal de prática, e o CTF só no slide do CTF', () => {
  const html = read('docs/slides/index.html');
  assert.ok(html.includes('href="../terminal/"'), 'slide de prática deve abrir ../terminal/');
  const ctfLinks = html.match(/href="\.\.\/ctf\/"/g) || [];
  assert.strictEqual(ctfLinks.length, 1, 'link do CTF deve aparecer só no slide do CTF');
  const ctfSlide = /<section class="slide ctf-slide"[\s\S]*?<\/section>/.exec(html)[0];
  assert.ok(ctfSlide.includes('href="../ctf/"'));
});

test('página do terminal de prática: sem CTF, com roteiro, modo celular e bundle', () => {
  const html = read('docs/terminal/index.html');
  assert.ok(/src="js\/lab\.bundle\.js"/.test(html));
  assert.ok(!/type="module"/.test(html));
  for (const id of ['terminal', 'roteiro', 'btn-mobile', 'font-up', 'font-down', 'btn-reset', 'keybar', 'mtabs']) assert.ok(html.includes('id="' + id + '"'), id);
  const tabs = (html.match(/data-tab="(\w+)"/g) || []).map((t) => t.slice(10, -1));
  assert.deepStrictEqual(tabs, ['terminal', 'roteiro', 'ajuda']);
  const lab = read('docs/terminal/js/lab.js');
  assert.ok(!/CtfGame|buildCtf|gate/.test(lab), 'terminal de prática não deve carregar o jogo nem a senha');
  assert.ok(read('docs/index.html').includes('href="terminal/"'));
});
