import assert from 'assert';
import fs from 'fs';
import { test } from './harness.js';
import { AULA, AULAS } from '../docs/aula.js';
import { levelsFor } from '../docs/ctf/js/ctf/game.js';
import { ROTEIRO, DESAFIOS } from '../docs/terminal/js/roteiro.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const slides = read('docs/slides/index.html');
const titles = (slides.match(/<section class="slide[^"]*" data-title="([^"]+)"/g) || []).map((m) => /data-title="([^"]+)"/.exec(m)[1]);

// Conteúdo que cada aula deve ter (e não ter) nos slides
const CONTEUDO = {
  1: {
    tem: ['Capa', 'Agenda', 'Teoria', 'Camadas do Linux', 'Caminhos', 'Onde estou', 'Navegando', 'Criando', 'Copiar, mover, remover', 'Lendo arquivos', 'Exercício 1', 'Gabarito 1', 'CTF', 'Desafio para casa', 'Próxima aula', 'Obrigado'],
    nao: ['Redirecionamento', 'Pipes', 'Busca', 'chmod', 'Primeiro script', 'Laços', 'Exercício 2'],
  },
  2: {
    tem: ['Capa', 'Agenda', 'Recapitulando', 'Redirecionamento', 'Pipes', 'Busca', 'Permissões', 'chmod', 'Primeiro script', 'Variáveis', 'Condicional', 'Laços', 'Exercício 2', 'Gabarito 2', 'CTF', 'Desafio para casa', 'Continue estudando', 'Obrigado'],
    nao: ['Teoria', 'Onde estou', 'Navegando', 'Exercício 1'],
  },
};

test('aula ' + AULA + ': slides têm só o conteúdo desta aula', () => {
  for (const t of CONTEUDO[AULA].tem) assert.ok(titles.includes(t), 'falta o slide: ' + t);
  for (const t of CONTEUDO[AULA].nao) assert.ok(!titles.includes(t), 'slide de outra aula: ' + t);
  assert.ok(slides.includes('Aula ' + AULA + ' de 2'), 'capa deve indicar a aula');
});

test('aula ' + AULA + ': CTF, senha, roteiro e desafio são desta aula', () => {
  assert.strictEqual(levelsFor(AULA).length, 7);
  const ctf = /<section class="slide ctf-slide"[\s\S]*?<\/section>/.exec(slides)[0];
  assert.ok(/data-password="[^"]+"/.test(ctf), 'slide do CTF sem senha');
  assert.ok(ctf.includes('7 níveis'));
  assert.ok(read('docs/ctf/index.html').includes('Aula ' + AULA + ' · 7 níveis'), 'tela inicial do CTF deve indicar a aula');
  assert.ok(ROTEIRO.some((s) => s.aula === AULA) && DESAFIOS[AULA]);
  assert.ok(read('docs/index.html').includes('Aula ' + AULA + ' de 2 · ' + AULAS[AULA].titulo));
  assert.ok(read('docs/ctf/js/main.js').includes("'pinguim-ctf-aula' + AULA"), 'progresso do CTF separado por aula');
});
