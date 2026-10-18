import assert from 'assert';
import { test } from './harness.js';
import { flagsFor, codeFor, countFor, normalizeFlag, CtfGame, levelsFor } from '../docs/ctf/js/ctf/game.js';
import { buildCtf } from '../docs/ctf/js/ctf/world.js';
import { buildSystem } from '../docs/ctf/js/shell/system.js';
import { Shell } from '../docs/ctf/js/shell/interpreter.js';
import { commands } from '../docs/ctf/js/shell/commands.js';
import { stripAnsi } from '../docs/ctf/js/shell/util.js';

const NICK = 'Ada';

// Shell com o mundo do CTF de uma aula específica (independe de docs/aula.js)
function ctfShell(aula, nick = NICK) {
  const vfs = buildSystem();
  let out = '';
  const io = { write: (s) => { out += s; }, writeErr: (s) => { out += s; }, readLine: async () => null, columns: 80 };
  const shell = new Shell({ vfs, io, commands });
  buildCtf(vfs, shell.home, nick, { aula });
  const game = new CtfGame(nick, null, null, aula);
  game.install(shell);
  return {
    vfs, shell, game,
    async out(src) { out = ''; await shell.run(src); return stripAnsi(out); },
    async run(src) { out = ''; const status = await shell.run(src); return { status, out: stripAnsi(out) }; },
  };
}

test('flags são únicas por codinome e por aula, e determinísticas', () => {
  for (const aula of [1, 2]) {
    const a = flagsFor('Ada', aula);
    assert.deepStrictEqual(a, flagsFor(' ada ', aula));
    assert.notStrictEqual(a[2], flagsFor('Linus', aula)[2]);
    for (const l of levelsFor(aula)) assert.match(a[l.id], /^FLAG\{[a-z0-9_]+_[0-9a-f]{4}\}$/);
    assert.strictEqual(new Set(Object.values(a)).size, levelsFor(aula).length);
  }
  assert.notStrictEqual(flagsFor('Ada', 1)[1], flagsFor('Ada', 2)[1], 'a mesma flag não pode valer nas duas aulas');
  assert.match(codeFor('Ada', 2), /^\d{3}$/);
});

test('cada aula tem 7 níveis cobrindo o conteúdo dela', () => {
  assert.deepStrictEqual(levelsFor(1).map((l) => l.key), ['boasvindas', 'oculto', 'nomes', 'tesouro', 'inicio', 'contagem', 'mudanca']);
  assert.deepStrictEqual(levelsFor(2).map((l) => l.key), ['boasvindas', 'labirinto', 'palheiro', 'canal', 'permissao', 'unico', 'fechadura']);
  for (const aula of [1, 2]) for (const l of levelsFor(aula)) assert.strictEqual(l.hints.length, 3, l.key);
});

test('normalizeFlag aceita com e sem FLAG{}', () => {
  assert.strictEqual(normalizeFlag('abc_1'), 'FLAG{abc_1}');
  assert.strictEqual(normalizeFlag(' FLAG{abc_1} '), 'FLAG{abc_1}');
  assert.strictEqual(normalizeFlag('flag{abc_1}'), 'FLAG{abc_1}');
});

// ---------------- AULA 1 ----------------
test('aula 1 · nível 1: flag no LEIA-ME', async () => {
  const s = ctfShell(1);
  assert.ok((await s.out('cat ~/ctf/LEIA-ME.txt')).includes(s.game.flags[1]));
});

test('aula 1 · nível 2: flag só aparece com ls -a', async () => {
  const s = ctfShell(1);
  await s.run('cd ~/ctf/nivel2');
  assert.ok(!(await s.out('ls')).includes('.fragmento_secreto'));
  assert.ok((await s.out('cat .fragmento_secreto')).includes(s.game.flags[2]));
});

test('aula 1 · nível 3: precisa de aspas e de ./ para ler os arquivos', async () => {
  const s = ctfShell(1);
  await s.run('cd ~/ctf/nivel3');
  assert.match(await s.out('cat meia flag.txt'), /cat: meia: Arquivo ou diretório inexistente/);
  assert.match(await s.out('cat -outra-metade'), /opção inválida/);
  const a = await s.out('cat "meia flag.txt"');
  const b = await s.out('cat ./-outra-metade');
  assert.strictEqual(a.replace('Primeira metade: ', '').trim() + b.replace('Segunda metade: ', '').trim(), s.game.flags[3]);
});

test('aula 1 · nível 4: seguir as pistas com cd .., caminhos relativos e absolutos', async () => {
  const s = ctfShell(1);
  await s.run('cd ~/ctf/nivel4/inicio');
  assert.match(await s.out('cat pista.txt'), /cd \.\./);
  await s.run('cd ..');
  await s.run('cd predio/andar2');
  assert.match(await s.out('cat pista.txt'), /sala_d/);
  await s.run('cd sala_d/armario');
  const p3 = await s.out('cat pista.txt');
  const abs = /cd (\/tmp\/\S+)/.exec(p3)[1];
  await s.run('cd /');
  await s.run('cd ' + abs);
  assert.ok((await s.out('cat tesouro.txt')).includes(s.game.flags[4]));
  // o tesouro não está em lugar nenhum dentro de ~/ctf
  assert.strictEqual(await s.out('grep -r FLAG ~/ctf/nivel4'), '');
});

test('aula 1 · nível 5: head mostra a flag no começo de um arquivo enorme', async () => {
  const s = ctfShell(1);
  await s.run('cd ~/ctf/nivel5');
  assert.ok(Number((await s.out('wc -l historico.log')).split(' ')[0]) > 5000);
  assert.ok((await s.out('head -n 5 historico.log')).includes(s.game.flags[5]));
  assert.ok(!(await s.out('tail -n 3000 historico.log')).includes('FLAG{'), 'a flag não pode estar no fim visível do cat');
});

test('aula 1 · nível 6: wc -l dá o número que monta a flag', async () => {
  const s = ctfShell(1);
  await s.run('cd ~/ctf/nivel6');
  const n = Number((await s.out('wc -l registros.txt')).split(' ')[0]);
  assert.strictEqual(n, countFor(NICK, 1));
  const tag = /FLAG\{contei_N_linhas_([0-9a-f]{4})\}/.exec(await s.out('cat missao.txt'))[1];
  assert.strictEqual('FLAG{contei_' + n + '_linhas_' + tag + '}', s.game.flags[6]);
});

test('aula 1 · nível 7: ./conferir só libera depois de mkdir, cp e rm', async () => {
  const s = ctfShell(1);
  await s.run('cd ~/ctf/nivel7');
  let r = await s.run('./conferir');
  assert.strictEqual(r.status, 1);
  assert.ok(!r.out.includes('FLAG{'));
  await s.run('mkdir entrega');
  await s.run('mv rascunhos/relatorio_v3.txt entrega/relatorio_final.txt'); // mover não vale
  r = await s.run('./conferir');
  assert.match(r.out, /✘ o original continua/);
  await s.run('mv entrega/relatorio_final.txt rascunhos/relatorio_v3.txt');
  await s.run('cp rascunhos/relatorio_v3.txt entrega/relatorio_final.txt');
  r = await s.run('./conferir');
  assert.match(r.out, /✘ rascunhos\/lixo\.tmp apagado/);
  await s.run('rm rascunhos/lixo.tmp');
  r = await s.run('./conferir');
  assert.strictEqual(r.status, 0);
  assert.ok(r.out.includes(s.game.flags[7]));
});

// ---------------- AULA 2 ----------------
test('aula 2 · nível 2: find encontra a chave no labirinto', async () => {
  const s = ctfShell(2);
  await s.run('cd ~/ctf/nivel2');
  const found = (await s.out('find labirinto -name "chave.flag"')).trim();
  assert.strictEqual(found.split('\n').length, 1);
  assert.ok((await s.out('cat ' + found)).includes(s.game.flags[2]));
});

test('aula 2 · nível 3: grep acha a única linha com FLAG em 10.000', async () => {
  const s = ctfShell(2);
  await s.run('cd ~/ctf/nivel3');
  const hits = (await s.out('grep FLAG palheiro.txt')).trim().split('\n');
  assert.strictEqual(hits.length, 1);
  assert.ok(hits[0].includes(s.game.flags[3]));
});

test('aula 2 · nível 4: a flag sai pelo stderr (2>&1 ou 2> arquivo)', async () => {
  const s = ctfShell(2);
  await s.run('cd ~/ctf/nivel4');
  // o pipe só leva o stdout: o grep não vê a flag
  await s.run('./transmissor 2> /dev/null | grep FLAG > so_stdout.txt');
  assert.strictEqual(s.vfs.readFile(s.shell.home + '/ctf/nivel4/so_stdout.txt'), '');
  assert.strictEqual((await s.out('./transmissor 2>&1 | grep FLAG')).trim(), '[erro] pacote 37 corrompido: ' + s.game.flags[4]);
  await s.run('./transmissor 2> erros.txt > /dev/null');
  assert.ok((await s.out('grep FLAG erros.txt')).includes(s.game.flags[4]));
});

test('aula 2 · nível 5: arquivo 000 só abre após chmod', async () => {
  const s = ctfShell(2);
  await s.run('cd ~/ctf/nivel5');
  assert.match(await s.out('cat cofre.txt'), /Permissão negada/);
  await s.run('chmod u+r cofre.txt');
  assert.ok((await s.out('cat cofre.txt')).includes(s.game.flags[5]));
});

test('aula 2 · nível 6: sort | uniq -u revela a linha única', async () => {
  const s = ctfShell(2);
  await s.run('cd ~/ctf/nivel6');
  assert.strictEqual('FLAG{' + (await s.out('sort ecos.txt | uniq -u')).trim() + '}', s.game.flags[6]);
});

test('aula 2 · nível 7: laço testa os códigos e abre a fechadura', async () => {
  const s = ctfShell(2);
  await s.run('cd ~/ctf/nivel7');
  assert.match(await s.out('./fechadura 7'), /3 dígitos/);
  assert.strictEqual((await s.out('for c in $(seq -w 0 999); do ./fechadura $c; done | grep FLAG')).trim(), s.game.flags[7]);
  const modelo = s.vfs.readFile(s.shell.home + '/ctf/nivel7/modelo.sh');
  s.vfs.writeFile(s.shell.home + '/ctf/nivel7/modelo.sh', modelo.replace('for codigo in ____ ;', 'for codigo in $(seq -w 0 999) ;').replace(/^(\s*)____/m, '$1break'));
  assert.ok((await s.out('bash modelo.sh')).includes('Código encontrado: ' + codeFor(NICK, 2)));
});

// ---------------- jogo ----------------
test('enviar: aceita flags certas, recusa erradas e as de outra aula', async () => {
  const s = ctfShell(1);
  let r = await s.run('enviar ' + s.game.flags[1]);
  assert.strictEqual(r.status, 0);
  r = await s.run('enviar ' + s.game.flags[1]);
  assert.match(r.out, /já tinha enviado/);
  r = await s.run('enviar ' + flagsFor(NICK, 2)[2]);
  assert.match(r.out, /outro codinome \(ou de outra aula\)/);
  r = await s.run('enviar FLAG{errada}');
  assert.strictEqual(r.status, 1);
});

test('dicas reduzem a pontuação do nível', () => {
  const g = new CtfGame(NICK, null, null, 1);
  g.hint(2); g.hint(2);
  assert.ok(g.submit(g.flags[2]).ok);
  assert.strictEqual(g.levelScore(2), 5);
  g.submit(g.flags[1]);
  assert.strictEqual(g.score(), 15);
  assert.ok(g.hint(99).error);
});

test('concluir todos os níveis gera código de conclusão da aula', () => {
  for (const aula of [1, 2]) {
    const g = new CtfGame(NICK, null, null, aula);
    for (const l of g.levels) g.submit(g.flags[l.id]);
    assert.ok(g.allSolved());
    assert.strictEqual(g.score(), g.maxScore());
    assert.match(g.completionCode(), new RegExp('^PINGUIM' + aula + '-[0-9A-F]{8}$'));
  }
});

test('estado do jogo persiste e é restaurado', () => {
  let saved = null;
  const g = new CtfGame(NICK, null, (game) => { saved = JSON.stringify(game.state); }, 2);
  g.submit(g.flags[3]);
  assert.ok(new CtfGame(NICK, JSON.parse(saved), null, 2).isSolved(3));
});
