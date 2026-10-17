import assert from 'assert';
import { test, makeShell } from './harness.js';

test('variáveis, aspas e substituição de comando', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('nome="Ana Maria"; echo "Olá, $nome"'), 'Olá, Ana Maria\n');
  assert.strictEqual(await s.out("echo '$nome'"), '$nome\n');
  assert.strictEqual(await s.out('x=$(echo oi); echo "[$x]"'), '[oi]\n');
  assert.strictEqual(await s.out('echo ${nome}!'), 'Ana Maria!\n');
  assert.strictEqual(await s.out('echo $USER $HOME'), 'aluno /home/aluno\n');
});

test('aritmética $(( ))', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('echo $((2 + 3 * 4))'), '14\n');
  assert.strictEqual(await s.out('c=1; c=$((c + 1)); echo $c'), '2\n');
  assert.strictEqual(await s.out('echo $(( (10 - 4) / 4 )) $((7 % 3)) $((2 ** 3))'), '1 1 8\n');
  assert.match(await s.out('echo $((1 / 0))'), /divisão por 0/);
});

test('código de saída $? e && ||', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('false; echo $?'), '1\n');
  assert.strictEqual(await s.out('true && echo sim || echo nao'), 'sim\n');
  assert.strictEqual(await s.out('false && echo sim || echo nao'), 'nao\n');
  assert.strictEqual(await s.out('comando_que_nao_existe 2>/dev/null; echo $?'), '127\n');
});

test('if com test e [ ]', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('idade=20; if [ "$idade" -ge 18 ]; then echo maior; else echo menor; fi'), 'maior\n');
  assert.strictEqual(await s.out('if [ -d /etc ]; then echo dir; fi'), 'dir\n');
  assert.strictEqual(await s.out('if [ -z "" ]; then echo vazio; fi'), 'vazio\n');
  assert.strictEqual(await s.out('if [ abc = abd ]; then echo a; elif [ 1 -lt 2 ]; then echo b; fi'), 'b\n');
  assert.match(await s.out('[ 1 -eq 1'), /faltando '\]'/);
  assert.match(await s.out('[ abc -eq 1 ]'), /número inteiro/);
});

test('laços for, while, break e continue', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('for i in 1 2 3; do echo n$i; done'), 'n1\nn2\nn3\n');
  assert.strictEqual(await s.out('for i in $(seq 1 5); do if [ $i -eq 3 ]; then continue; fi; if [ $i -eq 5 ]; then break; fi; echo $i; done'), '1\n2\n4\n');
  assert.strictEqual(await s.out('c=1; while [ $c -le 3 ]; do echo v$c; c=$((c+1)); done'), 'v1\nv2\nv3\n');
  assert.strictEqual(await s.out('until [ -n "$x" ]; do x=ok; done; echo $x'), 'ok\n');
});

test('pipes e redirecionamentos', async () => {
  const s = makeShell();
  await s.run('cd ~ && echo linha1 > a.txt && echo linha2 >> a.txt');
  assert.strictEqual(await s.out('cat a.txt'), 'linha1\nlinha2\n');
  assert.strictEqual(await s.out('cat a.txt | wc -l'), '2\n');
  await s.run('ls /nao_existe 2> erros.txt');
  assert.match(s.vfs.readFile('/home/aluno/erros.txt'), /não foi possível acessar/);
  await s.run('ls /nao_existe > tudo.txt 2>&1');
  assert.match(s.vfs.readFile('/home/aluno/tudo.txt'), /não foi possível acessar/);
  assert.strictEqual(await s.out('wc -l < a.txt'), '2\n');
  assert.strictEqual(await s.out('echo oi > /dev/null'), '');
});

test('globs e expansão de chaves', async () => {
  const s = makeShell();
  await s.run('mkdir -p ~/t && cd ~/t && touch foto{1..3}.jpg nota.txt');
  assert.strictEqual(await s.out('echo *.jpg'), 'foto1.jpg foto2.jpg foto3.jpg\n');
  assert.strictEqual(await s.out('echo "*.jpg"'), '*.jpg\n');
  assert.strictEqual(await s.out('echo *.png'), '*.png\n');
  assert.strictEqual(await s.out('echo {a,b}-{1,2}'), 'a-1 a-2 b-1 b-2\n');
  assert.strictEqual(await s.out('for f in *.txt; do echo "achei $f"; done'), 'achei nota.txt\n');
  assert.strictEqual(await s.out('echo ~'), '/home/aluno\n');
});

test('scripts: shebang, argumentos, permissão de execução', async () => {
  const s = makeShell();
  s.vfs.writeFile('/home/aluno/ola.sh', '#!/bin/bash\necho "Olá, $1! ($# args, script $0)"\nexit 3\n');
  let r = await s.run('./ola.sh Maria');
  assert.strictEqual(r.status, 126);
  assert.match(r.out, /Permissão negada/);
  assert.match(r.out, /chmod \+x/);
  await s.run('chmod +x ola.sh');
  r = await s.run('./ola.sh Maria Jose');
  assert.strictEqual(r.out, 'Olá, Maria! (2 args, script ./ola.sh)\n');
  assert.strictEqual(r.status, 3);
  assert.strictEqual(await s.out('bash ola.sh X; echo "saiu $?"'), 'Olá, X! (1 args, script ola.sh)\nsaiu 3\n');
  r = await s.run('ola.sh');
  assert.match(r.out, /comando não encontrado/);
  assert.match(r.out, /\.\/ola\.sh/);
});

test('script não vaza variáveis nem cd para o shell', async () => {
  const s = makeShell();
  s.vfs.writeFile('/home/aluno/s.sh', 'segredo=42\ncd /etc\n', { mode: 0o755 });
  await s.run('./s.sh');
  assert.strictEqual(await s.out('echo "[$segredo]"; pwd'), '[]\n/home/aluno\n');
  await s.run('source s.sh');
  assert.strictEqual(await s.out('echo $segredo; pwd'), '42\n/etc\n');
});

test('"$@" preserva argumentos com espaço', async () => {
  const s = makeShell();
  s.vfs.writeFile('/home/aluno/args.sh', 'for a in "$@"; do echo "[$a]"; done\n', { mode: 0o755 });
  assert.strictEqual(await s.out('./args.sh "um dois" tres'), '[um dois]\n[tres]\n');
});

test('read lê do usuário e de pipes', async () => {
  const s = makeShell({ inputs: ['Joana Silva'] });
  assert.strictEqual(await s.out('read -p "Nome: " nome; echo "Oi $nome"'), 'Oi Joana Silva\n');
  assert.strictEqual(await s.out('echo "a b c" | while read x y; do echo "$y|$x"; done'), 'b c|a\n');
  await s.run('printf "l1\\nl2\\n" > ~/l.txt');
  assert.strictEqual(await s.out('while read linha; do echo "> $linha"; done < ~/l.txt'), '> l1\n> l2\n');
});

test('erros de sintaxe não quebram o shell', async () => {
  const s = makeShell();
  const r = await s.run('if true; echo x; fi');
  assert.strictEqual(r.status, 2);
  assert.match(r.out, /erro de sintaxe/);
  assert.strictEqual(await s.out('echo ok'), 'ok\n');
});

test('laço infinito é interrompido pelo limite', async () => {
  const s = makeShell();
  s.shell.maxSteps = 5000;
  const r = await s.run('while true; do :; done');
  assert.match(r.out, /limite de execução/);
});

test('Ctrl+C interrompe um comando em execução', async () => {
  const s = makeShell();
  const p = s.run('while true; do :; done');
  setTimeout(() => s.shell.interrupt(), 20);
  const r = await p;
  assert.strictEqual(r.status, 130);
});

test('isIncomplete detecta continuação de linha', () => {
  const s = makeShell();
  assert.ok(s.shell.isIncomplete('for i in 1 2; do'));
  assert.ok(!s.shell.isIncomplete('echo ok'));
});

test('Tab completa comandos e caminhos', () => {
  const s = makeShell();
  assert.strictEqual(s.shell.complete('whoa').line, 'whoami ');
  assert.strictEqual(s.shell.complete('cd Docu').line, 'cd Documentos/');
  assert.strictEqual(s.shell.complete('cat /etc/pas').line, 'cat /etc/passwd ');
  const multi = s.shell.complete('ls D');
  assert.ok(multi.options.length >= 2);
});

test('comandos indisponíveis e sudo dão mensagens didáticas', async () => {
  const s = makeShell();
  assert.match(await s.out('awk 1'), /não está disponível neste simulador/);
  assert.match(await s.out('sudo ls'), /sudoers/);
});
