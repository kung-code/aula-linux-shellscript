import assert from 'assert';
import fs from 'fs';
import { test } from './harness.js';
import {
  clampIndex, parseHash, formatTime, copyText, highlightBash, splitCommands, navNext, navPrev,
  permString, permOctal, octalToBits, ansiToHtml, buildToc, filterToc, tocJump,
} from '../docs/slides/deck.js';
import { runDemos, makeDemoIo } from '../docs/slides/demo-runner.js';
import { LAYERS, JOURNEY } from '../docs/slides/layers.js';
import { buildSystem } from '../docs/ctf/js/shell/system.js';
import { Shell } from '../docs/ctf/js/shell/interpreter.js';
import { commands } from '../docs/ctf/js/shell/commands.js';
import { stripAnsi } from '../docs/ctf/js/shell/util.js';
import { AULA } from '../docs/aula.js';

const HTML = fs.readFileSync(new URL('../docs/slides/index.html', import.meta.url), 'utf8');

// Lê os blocos <pre data-demo> na ordem do documento (igual ao slides.js no navegador).
function demoSpecs(html) {
  const specs = [];
  const re = /<pre([^>]*)data-demo="(\w+)"([^>]*)><code>([\s\S]*?)<\/code><\/pre>/g;
  let m;
  while ((m = re.exec(html))) {
    const attrs = m[1] + m[3];
    const attr = (n) => { const a = new RegExp(n + '="([^"]*)"').exec(attrs); return a ? a[1] : undefined; };
    const text = m[4].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    specs.push({ kind: m[2], text, name: attr('data-name'), input: attr('data-input') });
  }
  return specs;
}

test('navegação: clampIndex e parseHash', () => {
  assert.strictEqual(clampIndex(-3, 10), 0);
  assert.strictEqual(clampIndex(99, 10), 9);
  assert.strictEqual(parseHash('#/5', 10), 4);
  assert.strictEqual(parseHash('#7', 10), 6);
  assert.strictEqual(parseHash('#/99', 10), 9);
  assert.strictEqual(parseHash('', 10), 0);
  assert.strictEqual(parseHash('#abc', 10), 0);
});

test('navegação por passos: navNext/navPrev', () => {
  assert.strictEqual(navNext([]), -1);
  assert.strictEqual(navNext([{ step: 2, total: 2 }, { step: 0, total: 3 }]), 1);
  assert.strictEqual(navNext([{ step: 2, total: 2 }]), -1);
  assert.strictEqual(navPrev([{ step: 1, total: 2 }, { step: 0, total: 3 }]), 0);
  assert.strictEqual(navPrev([{ step: 0, total: 2 }]), -1);
  assert.strictEqual(navPrev([{ step: 2, total: 2 }, { step: 3, total: 3 }]), 1);
});

test('sumário: agrupa por seção, filtra sem acento e salta por número', () => {
  const groups = buildToc([
    { title: 'Capa' }, { title: 'Agenda' },
    { title: 'Teoria', group: 'Parte 1 · O que é Linux?' }, { title: 'Peças', tags: ['interativo'] },
    { title: 'Exercício 1', group: 'Parte 2', tags: ['exercício'] },
  ]);
  assert.deepStrictEqual(groups.map((g) => g.name), ['Abertura', 'Parte 1 · O que é Linux?', 'Parte 2']);
  assert.deepStrictEqual(groups[1].slides.map((s) => s.index), [2, 3]);
  assert.deepStrictEqual(filterToc(groups, 'exercicio').map((g) => g.slides[0].title), ['Exercício 1']);
  assert.deepStrictEqual(filterToc(groups, 'linux').map((g) => g.name), ['Parte 1 · O que é Linux?']);
  assert.deepStrictEqual(filterToc(groups, '2').flatMap((g) => g.slides.map((s) => s.index)), [1]);
  assert.strictEqual(filterToc(groups, 'xyz').length, 0);
  assert.strictEqual(filterToc(groups, '  ').length, 3);
  assert.strictEqual(tocJump('4', 5), 3);
  assert.strictEqual(tocJump('9', 5), -1);
  assert.strictEqual(tocJump('abc', 5), -1);
});

test('sumário dos slides: todas as seções da aula viram grupos', () => {
  const sections = (HTML.match(/class="slide (?:divider|ctf-slide)[^"]*"|data-toc-group="[^"]+"/g) || []).length;
  assert.ok(sections >= 4, 'seções encontradas: ' + sections);
  assert.ok(/id="toggle-toc"/.test(HTML) && /id="toc-input"/.test(HTML));
  const titles = (HTML.match(/<section class="slide[^"]*" data-title="/g) || []).length;
  const sectionsTotal = (HTML.match(/<section class="slide/g) || []).length;
  assert.strictEqual(titles, sectionsTotal, 'todo slide precisa de data-title (vira o nome no sumário)');
});

test('timer: formatTime', () => {
  assert.strictEqual(formatTime(300), '05:00');
  assert.strictEqual(formatTime(61), '01:01');
  assert.strictEqual(formatTime(-5), '00:00');
});

test('copiar código remove o prompt "$ "', () => {
  assert.strictEqual(copyText('$ ls -la\n$ cd /etc\n'), 'ls -la\ncd /etc');
  assert.strictEqual(copyText('echo "$ não é prompt"'), 'echo "$ não é prompt"');
});

test('splitCommands separa comandos e junta continuações', () => {
  assert.deepStrictEqual(splitCommands('$ pwd\n$ ls -l\n'), ['pwd', 'ls -l']);
  assert.deepStrictEqual(splitCommands('$ for i in 1 2; do\n  echo $i\ndone\n$ pwd'), ['for i in 1 2; do\n  echo $i\ndone', 'pwd']);
  assert.deepStrictEqual(splitCommands('sem prompt'), []);
});

test('permissões: string, octal e ida e volta', () => {
  assert.strictEqual(permString(octalToBits('755')), '-rwxr-xr-x');
  assert.strictEqual(permString(octalToBits('640')), '-rw-r-----');
  assert.strictEqual(permOctal(octalToBits('754')), '754');
  assert.strictEqual(permOctal([true, true, false, false, false, false, false, false, false]), '600');
});

test('ansiToHtml converte cores e escapa HTML', () => {
  assert.strictEqual(ansiToHtml('\x1b[1;32maluno\x1b[0m:<x>'), '<span class="b c-g">aluno</span>:&lt;x&gt;');
  assert.strictEqual(ansiToHtml('sem cor & ok'), 'sem cor &amp; ok');
});

test('realce de sintaxe escapa HTML e marca tokens', () => {
  const h = highlightBash('# comentário\nif [ "$x" -gt 1 ]; then echo "<b>"; fi');
  assert.ok(h.includes('<span class="hl-comment"># comentário</span>'));
  assert.ok(h.includes('<span class="hl-kw">if</span>'));
  assert.ok(h.includes('<span class="hl-var">$x</span>'));
  assert.ok(h.includes('&lt;b&gt;'));
  assert.ok(!h.includes('<b>'));
  assert.ok(highlightBash('echo $#').includes('<span class="hl-var">$#</span>'));
});

test('diagrama de camadas: jornada só usa camadas existentes e desce até o hardware', () => {
  const ids = new Set(LAYERS.map((l) => l.id));
  assert.strictEqual(LAYERS.length, 5);
  for (const j of JOURNEY) assert.ok(ids.has(j.layer), j.layer);
  assert.strictEqual(JOURNEY[0].layer, 'user');
  assert.ok(JOURNEY.some((j) => j.layer === 'hw'));
  assert.strictEqual(JOURNEY[JOURNEY.length - 1].layer, 'user');
  assert.ok(JOURNEY.slice(0, JOURNEY.findIndex((j) => j.layer === 'hw') + 1).every((j) => j.dir === 'down'));
});

test('slides não usam emojis decorativos', () => {
  const body = HTML.replace(/<script[\s\S]*?<\/script>/g, '');
  const emoji = body.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || [];
  assert.deepStrictEqual(emoji, [], 'emojis encontrados: ' + emoji.join(' '));
});

test('cada slide com terminal tem passos e todos os ícones usados existem no sprite', () => {
  const symbols = new Set((HTML.match(/<symbol id="([^"]+)"/g) || []).map((s) => s.slice(12, -1)));
  const used = (HTML.match(/href="#(i-[^"]+)"/g) || []).map((s) => s.slice(7, -1));
  const js = fs.readFileSync(new URL('../docs/slides/players.js', import.meta.url), 'utf8') +
    fs.readFileSync(new URL('../docs/slides/slides.js', import.meta.url), 'utf8') +
    fs.readFileSync(new URL('../docs/slides/layers.js', import.meta.url), 'utf8');
  const usedJs = (js.match(/'i-[a-z-]+'/g) || []).map((s) => s.slice(1, -1));
  for (const id of used.concat(usedJs)) assert.ok(symbols.has(id), 'ícone inexistente: ' + id);
  for (const s of demoSpecs(HTML).filter((x) => x.kind === 'cmds')) assert.ok(splitCommands(s.text).length > 0);
});

// Roda TODOS os exemplos dos slides no simulador, na ordem, como o navegador faz.
test('todos os exemplos animados dos slides executam sem erro no simulador', async () => {
  const specs = demoSpecs(HTML);
  assert.ok(specs.filter((s) => s.kind === 'cmds').length >= 6, 'poucos terminais: ' + specs.length);
  if (AULA === 2) assert.ok(specs.some((s) => s.kind === 'script'), 'a aula 2 tem scripts animados');
  const io = makeDemoIo();
  const shell = new Shell({ vfs: buildSystem(), io, commands });
  const results = await runDemos(specs, shell, io);
  const BAD = /comando não encontrado|erro de sintaxe|opção inválida|erro interno|não suportad|redirecionamento ambíguo/;
  // erros que os slides mostram de propósito (didáticos)
  const EXPECTED_FAIL = [/^ls \/nao_existe/, /^cat erros\.txt$/, /^rm aula_bkp$/, /^\.\/ola\.sh$/, /^\.\/backup\.sh( nao_existe)?$/];
  results.forEach((r, i) => {
    const spec = specs[i];
    if (spec.kind === 'cmds') {
      assert.strictEqual(r.steps.length, splitCommands(spec.text).length);
      for (const s of r.steps) {
        const out = stripAnsi(s.out);
        assert.ok(!BAD.test(out), 'comando falhou: ' + s.cmd + '\n' + out);
        if (/Permissão negada|inexistente|É um diretório/.test(out) && !/2>/.test(s.cmd)) {
          assert.ok(EXPECTED_FAIL.some((re) => re.test(s.cmd)), 'erro inesperado em: ' + s.cmd + '\n' + out);
        }
        assert.ok(s.prompt.includes('aluno@pinguimcorp'));
      }
    } else if (spec.kind === 'script') {
      assert.ok(r.out.trim().length > 0, 'script sem saída: ' + spec.name);
      assert.ok(!BAD.test(stripAnsi(r.out)), 'script falhou: ' + spec.name + '\n' + r.out);
    }
  });
  // conferências de conteúdo: a saída é real
  const flat = results.map((r) => (r.steps ? r.steps.map((s) => s.cmd + '\n' + stripAnsi(s.out)).join('\n') : stripAnsi(r.out || ''))).join('\n');
  assert.ok(flat.includes('/home/aluno'));
  if (AULA === 2) {
    assert.ok(flat.includes('Você tem 20 anos'));
    assert.ok(flat.includes('Maior de idade'));
    assert.ok(flat.includes('Backup: 1 arquivo(s)'));
    assert.ok(/Bom dia|Boa tarde|Boa noite/.test(flat) && flat.includes('Ana!'));
  } else {
    assert.ok(flat.includes('Minha primeira linha'));
    assert.ok(/projeto\/tests/.test(flat), 'gabarito do exercício 1 renomeia testes para tests');
  }
});
