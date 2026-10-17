import assert from 'assert';
import fs from 'fs';
import { test } from './harness.js';
import { splitWords, resolveSteps, STREAM_SCENARIOS, streamRoute } from '../src/preparacao/logic.js';
import { GLOSSARIO, setupPrepFiles } from '../src/preparacao/content.js';
import { buildSystem } from '../docs/ctf/js/shell/system.js';
import { Shell } from '../docs/ctf/js/shell/interpreter.js';
import { commands } from '../docs/ctf/js/shell/commands.js';
import { stripAnsi } from '../docs/ctf/js/shell/util.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const HTML = read('preparacao/index.html');
const unescape = (s) => s.replace(/&quot;/g, '"').replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

test('preparação: o shell separa palavras por espaço, e aspas juntam', () => {
  assert.deepStrictEqual(splitWords('cat meu arquivo.txt'), ['cat', 'meu', 'arquivo.txt']);
  assert.deepStrictEqual(splitWords('cat "meu arquivo.txt"'), ['cat', 'meu arquivo.txt']);
  assert.deepStrictEqual(splitWords('cp "foto 1.jpg" fotos/'), ['cp', 'foto 1.jpg', 'fotos/']);
  assert.deepStrictEqual(splitWords('ls   -l    /etc'), ['ls', '-l', '/etc']);
  assert.throws(() => splitWords('cat "aberto'));
});

test('preparação: como o shell encontra um programa no PATH', () => {
  const files = new Set(['/usr/bin/ls', '/bin/ls', '/home/aluno/ola.sh']);
  const exists = (p) => files.has(p);
  const PATH = ['/usr/local/bin', '/usr/bin', '/bin'];
  let r = resolveSteps('ls', PATH, exists, '/home/aluno');
  assert.deepStrictEqual(r.steps.map((s) => s.found), [false, true]);
  assert.strictEqual(r.result, '/usr/bin/ls');
  r = resolveSteps('ola.sh', PATH, exists, '/home/aluno');
  assert.strictEqual(r.result, null);
  assert.strictEqual(r.steps.length, 3);
  r = resolveSteps('./ola.sh', PATH, exists, '/home/aluno');
  assert.ok(r.direct);
  assert.strictEqual(r.result, '/home/aluno/ola.sh');
  assert.strictEqual(resolveSteps('LS', PATH, exists, '/home/aluno').result, null);
});

test('preparação: cenários de saída e erro', () => {
  assert.deepStrictEqual(Object.keys(STREAM_SCENARIOS), ['padrao', 'arquivo', 'erros', 'pipe']);
  assert.strictEqual(streamRoute('arquivo').stderr, 'tela');
  assert.ok(streamRoute('arquivo').stdout.startsWith('arquivo'));
  assert.ok(streamRoute('erros').stderr.startsWith('arquivo'));
  assert.ok(streamRoute('pipe').stdout.startsWith('programa'));
  assert.throws(() => streamRoute('x'));
});

test('preparação: comandos sugeridos nos terminais rodam e mostram o que o texto promete', async () => {
  const blocks = (HTML.match(/data-cmds="([^"]+)"/g) || []).map((m) => unescape(m.slice(11, -1)).split('||'));
  assert.strictEqual(blocks.length, 3, 'um terminal por tema');
  let out = '';
  const io = { write: (s) => { out += s; }, writeErr: (s) => { out += s; }, readLine: async () => null, columns: 72 };
  const vfs = buildSystem();
  setupPrepFiles(vfs, '/home/aluno');
  const results = {};
  for (const cmds of blocks) {
    const shell = new Shell({ vfs, io, commands }); // cada terminal da página tem seu próprio shell
    for (const c of cmds) {
      out = '';
      await shell.run(c);
      results[c] = stripAnsi(out);
      assert.ok(!/erro de sintaxe|opção inválida|erro interno|não suportad/.test(out), c + '\n' + out);
    }
  }
  // o que cada exemplo deve demonstrar
  assert.match(results['cat meu arquivo.txt'], /cat: meu: Arquivo ou diretório inexistente/);
  assert.match(results['cat "meu arquivo.txt"'], /espaço no nome/);
  assert.match(results['ola.sh'], /comando não encontrado/);
  assert.match(results['./ola.sh'], /Olá, aluno!/);
  assert.match(results['LS'], /comando não encontrado/);
  assert.match(results['which ls'], /\/usr\/bin\/ls/);
  assert.match(results['ls /etc /nao_existe 2> erros.txt'], /passwd/);
  assert.ok(!/não foi possível acessar/.test(results['ls /etc /nao_existe 2> erros.txt']), 'o erro deveria ter ido para o arquivo');
  assert.match(results['cat erros.txt'], /não foi possível acessar/);
  assert.match(results['ls /etc | wc -l'], /^\d+\n$/);
  assert.strictEqual(results['echo $?'], '0\n'); // último echo $? depois de um comando que deu certo
});

test('preparação: estrutura de cada tema (pergunta, previsão, terminal, reflexão, resumo)', () => {
  for (const id of ['organizacao', 'comando', 'saida']) {
    const sec = new RegExp('<section id="' + id + '"[\\s\\S]*?</section>').exec(HTML);
    assert.ok(sec, 'tema ausente: ' + id);
    for (const part of ['class="hook"', 'class="predict', 'class="mini-term', 'class="think', 'class="takeaway']) {
      assert.ok(sec[0].includes(part), id + ' sem ' + part);
    }
  }
  assert.ok(/<details class="extra-box">/.test(HTML), 'bloco opcional de permissões');
  // todo termo do glossário usado na página está definido
  for (const m of HTML.match(/data-g="([^"]+)"/g) || []) assert.ok(GLOSSARIO[m.slice(8, -1)], 'glossário sem: ' + m);
});

test('preparação: página curta (cerca de 15 min) e sem notas, pontos ou rastreamento', () => {
  const text = HTML.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, ' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  assert.ok(words > 900 && words < 2200, 'tamanho do texto: ' + words + ' palavras');
  const js = read('src/preparacao/prep.js');
  assert.ok(!/localStorage|sessionStorage|indexedDB|fetch\(|XMLHttpRequest|sendBeacon/.test(js), 'a página não deve salvar nem enviar nada');
  assert.ok(!/pontos|pontuação|ranking|nota [0-9]|sua nota/i.test(text), 'sem gamificação/avaliação');
});

// A página é publicada separada: não pode revelar o site do curso, o CTF nem a senha.
test('preparação: nenhuma referência ao site do curso, ao CTF ou à senha', () => {
  const pw = /data-password="([^"]+)"/.exec(read('docs/slides/index.html'))[1];
  for (const f of fs.readdirSync(new URL('../preparacao/', import.meta.url))) {
    const s = read('preparacao/' + f);
    assert.ok(!/aula-linux-shellscript|kung-code\.github\.io|\.\.\/(docs|ctf|slides|terminal|cola)\b|href="\.\.\//.test(s), f + ' aponta para o site do curso');
    assert.ok(!/\bCTF\b|Capture The Flag|FLAG\{|PinguimCorp CTF|docs\/ctf/.test(s), f + ' menciona o CTF');
    assert.ok(!s.toUpperCase().includes(pw.toUpperCase()), f + ' contém a senha');
  }
});
