import assert from 'assert';
import { test, makeShell } from './harness.js';
import { flagsFor, codeFor, normalizeFlag, CtfGame, LEVELS } from '../docs/ctf/js/ctf/game.js';

const NICK = 'Ada';

test('flags são únicas por codinome e determinísticas', () => {
  const a = flagsFor('Ada');
  const b = flagsFor(' ada ');
  const c = flagsFor('Linus');
  assert.deepStrictEqual(a, b);
  assert.notStrictEqual(a[1], c[1]);
  for (const l of LEVELS) assert.match(a[l.id], /^FLAG\{[a-z_]+_[0-9a-f]{4}\}$/);
  assert.strictEqual(new Set(Object.values(a)).size, LEVELS.length);
  assert.match(codeFor('Ada'), /^\d{3}$/);
});

test('normalizeFlag aceita com e sem FLAG{}', () => {
  assert.strictEqual(normalizeFlag('abc_1'), 'FLAG{abc_1}');
  assert.strictEqual(normalizeFlag(' FLAG{abc_1} '), 'FLAG{abc_1}');
  assert.strictEqual(normalizeFlag('flag{abc_1}'), 'FLAG{abc_1}');
});

test('nível 1: flag no LEIA-ME', async () => {
  const s = makeShell({ nick: NICK });
  const out = await s.out('cat ~/ctf/LEIA-ME.txt');
  assert.ok(out.includes(s.game.flags[1]));
});

test('nível 2: flag só aparece com ls -a', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel2');
  assert.ok(!(await s.out('ls')).includes('.fragmento_secreto'));
  assert.ok((await s.out('ls -a')).includes('.fragmento_secreto'));
  assert.ok((await s.out('cat .fragmento_secreto')).includes(s.game.flags[2]));
});

test('nível 3: precisa de aspas e de ./ para ler os arquivos', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel3');
  assert.match(await s.out('cat meia flag.txt'), /cat: meia: Arquivo ou diretório inexistente/);
  assert.match(await s.out('cat -outra-metade'), /opção inválida/);
  const a = await s.out('cat "meia flag.txt"');
  const b = await s.out('cat ./-outra-metade');
  assert.strictEqual(await s.out('cat -- -outra-metade'), b);
  assert.strictEqual(await s.out('cat meia\\ flag.txt'), a);
  const flag = a.replace('Primeira metade: ', '').trim() + b.replace('Segunda metade: ', '').trim();
  assert.strictEqual(flag, s.game.flags[3]);
});

test('nível 4: find encontra a chave no labirinto', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel4');
  const dirs = (await s.out('find labirinto -type d | wc -l')).trim();
  assert.ok(Number(dirs) > 100);
  const found = (await s.out('find labirinto -name "chave.flag"')).trim();
  assert.strictEqual(found.split('\n').length, 1);
  assert.ok((await s.out('cat ' + found)).includes(s.game.flags[4]));
});

test('nível 5: grep acha a única linha com FLAG em 10.000', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel5');
  assert.strictEqual(await s.out('wc -l palheiro.txt'), '10000 palheiro.txt\n');
  const hits = (await s.out('grep FLAG palheiro.txt')).trim().split('\n');
  assert.strictEqual(hits.length, 1);
  assert.ok(hits[0].includes(s.game.flags[5]));
  assert.ok(Number((await s.out('grep -ic flag palheiro.txt')).trim()) > 1);
});

test('nível 6: arquivo 000 só abre após chmod', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel6');
  assert.match(await s.out('cat cofre.txt'), /Permissão negada/);
  assert.match(await s.out('ls -l cofre.txt'), /^---------- 1 aluno aluno/);
  await s.run('chmod u+r cofre.txt');
  assert.ok((await s.out('cat cofre.txt')).includes(s.game.flags[6]));
});

test('nível 7: sort | uniq -u revela a linha única', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel7');
  const unique = (await s.out('sort ecos.txt | uniq -u')).trim();
  assert.strictEqual('FLAG{' + unique + '}', s.game.flags[7]);
  // sem sort, o uniq não resolve
  assert.ok((await s.out('uniq -u ecos.txt')).trim().split('\n').length > 1);
  assert.strictEqual((await s.out('grep FLAG ecos.txt')), '');
});

test('nível 8: laço testa os códigos e abre a fechadura', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel8');
  assert.match(await s.out('./fechadura 7'), /3 dígitos/);
  const wrong = codeFor(NICK) === '000' ? '001' : '000';
  assert.match(await s.out('./fechadura ' + wrong), /incorreto/);
  const out = await s.out('for c in $(seq -w 0 999); do ./fechadura $c; done | grep FLAG');
  assert.strictEqual(out.trim(), s.game.flags[8]);
});

test('nível 8: modelo.sh completo funciona', async () => {
  const s = makeShell({ nick: NICK });
  await s.run('cd ~/ctf/nivel8');
  const modelo = s.vfs.readFile('/home/aluno/ctf/nivel8/modelo.sh');
  const completo = modelo.replace('for codigo in ____ ;', 'for codigo in $(seq -w 0 999) ;').replace(/^(\s*)____/m, '$1break');
  s.vfs.writeFile('/home/aluno/ctf/nivel8/modelo.sh', completo);
  const out = await s.out('bash modelo.sh');
  assert.ok(out.includes('Código encontrado: ' + codeFor(NICK)));
  assert.ok(out.includes(s.game.flags[8]));
});

test('enviar: aceita flags certas, recusa erradas e as de outro codinome', async () => {
  const s = makeShell({ nick: NICK });
  let r = await s.run('enviar ' + s.game.flags[1]);
  assert.strictEqual(r.status, 0);
  assert.match(r.out, /correta/);
  r = await s.run('enviar ' + s.game.flags[1]);
  assert.match(r.out, /já tinha enviado/);
  r = await s.run('enviar FLAG{errada}');
  assert.strictEqual(r.status, 1);
  r = await s.run('enviar ' + flagsFor('outra pessoa')[2]);
  assert.match(r.out, /outro codinome/);
  const body7 = s.game.flags[7].slice(5, -1);
  r = await s.run('enviar ' + body7);
  assert.match(r.out, /nível 7/);
});

test('dicas reduzem a pontuação do nível', () => {
  const g = new CtfGame(NICK);
  g.hint(2);
  g.hint(2);
  assert.strictEqual(g.submit(g.flags[2]).ok, true);
  assert.strictEqual(g.levelScore(2), 5); // 10 pts - 50%
  g.submit(g.flags[1]);
  assert.strictEqual(g.levelScore(1), 10);
  assert.strictEqual(g.score(), 15);
  assert.ok(g.hint(99).error);
});

test('concluir todos os níveis gera código de conclusão', () => {
  const g = new CtfGame(NICK);
  for (const l of LEVELS) g.submit(g.flags[l.id]);
  assert.ok(g.allSolved());
  assert.strictEqual(g.score(), g.maxScore());
  assert.match(g.completionCode(), /^PINGUIM-[0-9A-F]{8}$/);
});

test('estado do jogo persiste e é restaurado', () => {
  let saved = null;
  const g = new CtfGame(NICK, null, (game) => { saved = JSON.stringify(game.state); });
  g.submit(g.flags[3]);
  const g2 = new CtfGame(NICK, JSON.parse(saved));
  assert.ok(g2.isSolved(3));
});
