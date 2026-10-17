import assert from 'assert';
import { test, makeShell } from './harness.js';

test('pwd, cd, cd -, cd ..', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('pwd'), '/home/aluno\n');
  await s.run('cd /etc');
  assert.strictEqual(await s.out('cd -'), '/home/aluno\n');
  assert.strictEqual(await s.out('cd .. && pwd'), '/home\n');
  assert.strictEqual(await s.out('cd && pwd'), '/home/aluno\n');
  assert.match(await s.out('cd /nada'), /cd: \/nada: Arquivo ou diretório inexistente/);
  assert.match(await s.out('cd /root'), /Permissão negada/);
  assert.match(await s.out('cd /etc/passwd'), /Não é um diretório/);
});

test('ls: ocultos, -l, erros', async () => {
  const s = makeShell();
  const plain = await s.out('ls');
  assert.ok(plain.includes('Documentos'));
  assert.ok(!plain.includes('.bashrc'));
  assert.ok((await s.out('ls -a')).includes('.bashrc'));
  const long = await s.out('ls -l Documentos');
  assert.match(long, /^total \d+/);
  assert.match(long, /-rw-r--r-- 1 aluno aluno\s+\d+ \w{3} .* notas\.txt/);
  assert.match(await s.out('ls nada'), /não foi possível acessar 'nada'/);
  assert.match(await s.out('ls /root'), /Permissão negada/);
  assert.strictEqual(await s.out('ls Documentos | head -n 1'), 'compras.txt\n');
});

test('mkdir -p, touch, cp, mv, rm e rmdir', async () => {
  const s = makeShell();
  await s.run('mkdir -p projeto/{docs,src,testes}');
  assert.strictEqual(await s.out('ls projeto'), 'docs  src  testes\n'.replace(/  /g, '  '));
  await s.run('echo "Projeto da aula" > projeto/docs/leia-me.txt');
  await s.run('cp projeto/docs/leia-me.txt projeto/src/copia.txt');
  assert.strictEqual(await s.out('cat projeto/src/copia.txt'), 'Projeto da aula\n');
  await s.run('mv projeto/testes projeto/tests');
  assert.ok(s.vfs.exists('/home/aluno/projeto/tests'));
  assert.match(await s.out('mkdir projeto'), /Arquivo existe/);
  assert.match(await s.out('cp projeto x'), /-r não especificado/);
  await s.run('cp -r projeto backup');
  assert.ok(s.vfs.exists('/home/aluno/backup/src/copia.txt'));
  assert.match(await s.out('rm backup'), /É um diretório/);
  assert.match(await s.out('rmdir projeto'), /Diretório não vazio/);
  await s.run('rm -r backup');
  assert.ok(!s.vfs.exists('/home/aluno/backup'));
  assert.match(await s.out('rm -rf /'), /perigoso/);
  assert.match(await s.out('touch /etc/x'), /Permissão negada/);
});

test('cat -n, head, tail, wc', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('head -n 2 /etc/passwd'), 'root:x:0:0:root:/root:/bin/bash\ndaemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin\n');
  assert.strictEqual(await s.out('head -1 /etc/passwd'), 'root:x:0:0:root:/root:/bin/bash\n');
  assert.strictEqual(await s.out('tail -n 1 /etc/passwd'), 'admin:x:1002:1002:Administrador:/home/admin:/bin/bash\n');
  assert.strictEqual(await s.out('wc -l /etc/passwd'), '11 /etc/passwd\n');
  assert.strictEqual(await s.out('cat -n Documentos/notas.txt | head -n 1'), '     1\tLinux é um kernel.\n');
  assert.match(await s.out('cat /etc/shadow'), /Permissão negada/);
  assert.match(await s.out('cat -x'), /opção inválida -- 'x'/);
});

test('grep: básico, -i, -c, -v, -n, -r, -o', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('grep -c bash /etc/passwd'), '4\n');
  assert.strictEqual(await s.out('grep ^root /etc/passwd'), 'root:x:0:0:root:/root:/bin/bash\n');
  assert.strictEqual(await s.out('grep -n leite Documentos/compras.txt'), '3:leite\n6:leite\n');
  assert.strictEqual(await s.out('grep -v banana Documentos/compras.txt | wc -l'), '5\n');
  assert.ok((await s.out('grep -i ERRO /var/log/syslog')).split('\n').length > 2);
  assert.match(await s.out('grep -r "Total" ~'), /Downloads\/relatorio\.txt:Total: 42 pinguins/);
  assert.strictEqual(await s.out('echo abc123def | grep -o "[0-9]\\+"'), '123\n');
  assert.strictEqual(await s.out('echo "a+b" | grep "a+b"'), 'a+b\n');
  assert.strictEqual((await s.run('grep nada_disso /etc/passwd')).status, 1);
  assert.strictEqual(await s.out('ls Downloads | grep jpg'), 'foto_festa.jpg\nfoto_praia.jpg\n');
});

test('find: -name, -type, -size, permissões', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('find ~/Documentos -name "*.txt" | sort'), '/home/aluno/Documentos/compras.txt\n/home/aluno/Documentos/notas.txt\n/home/aluno/Documentos/numeros.txt\n');
  assert.strictEqual(await s.out('cd ~ && find . -maxdepth 1 -type d -name "D*"'), './Documentos\n./Downloads\n');
  assert.match(await s.out('find /etc -name "*.conf"'), /\/etc\/nginx\/nginx\.conf/);
  assert.match(await s.out('find / -name segredo.txt'), /find: '\/root': Permissão negada/);
  assert.match(await s.out('find . -bogus'), /predicado desconhecido/);
  assert.strictEqual(await s.out('find ~/Documentos -type f -size +1k'), '');
  assert.strictEqual(await s.out('find ~/Documentos -size +1k'), '/home/aluno/Documentos\n');
  assert.strictEqual(await s.out('find ~/Documentos ! -name "*.txt"'), '/home/aluno/Documentos\n');
});

test('chmod numérico e simbólico', async () => {
  const s = makeShell();
  await s.run('touch x.sh');
  await s.run('chmod 755 x.sh');
  assert.match(await s.out('ls -l x.sh'), /^-rwxr-xr-x/);
  await s.run('chmod go-rx x.sh');
  assert.match(await s.out('ls -l x.sh'), /^-rwx------/);
  await s.run('chmod 000 x.sh');
  assert.match(await s.out('cat x.sh'), /Permissão negada/);
  await s.run('chmod u+r x.sh');
  assert.match(await s.out('ls -l x.sh'), /^-r--------/);
  assert.match(await s.out('chmod 777 /etc/passwd'), /Operação não permitida/);
  assert.match(await s.out('chmod abc x.sh'), /modo inválido/);
});

test('sort, uniq, cut, tr, seq, rev, base64', async () => {
  const s = makeShell();
  const d = 'Documentos/';
  assert.strictEqual(await s.out('sort -n ' + d + 'numeros.txt | head -n 3'), '2\n7\n10\n');
  assert.strictEqual(await s.out('sort ' + d + 'compras.txt | uniq -c | head -n 1'), '      3 banana\n');
  assert.strictEqual(await s.out('sort ' + d + 'compras.txt | uniq -u'), 'café\nmaçã\npão\n');
  assert.strictEqual(await s.out('uniq -u ' + d + 'compras.txt | wc -l'), '8\n');
  assert.strictEqual(await s.out('cut -d: -f1 /etc/passwd | head -n 2'), 'root\ndaemon\n');
  assert.strictEqual(await s.out('echo ola | tr a-z A-Z'), 'OLA\n');
  assert.strictEqual(await s.out('seq -w 8 10'), '08\n09\n10\n');
  assert.strictEqual(await s.out('seq -w 0 999 | head -n 2'), '000\n001\n');
  assert.strictEqual(await s.out('seq 10 -3 1'), '10\n7\n4\n1\n');
  assert.strictEqual(await s.out('echo abc | rev'), 'cba\n');
  assert.strictEqual(await s.out('echo oi | base64 | base64 -d'), 'oi\n');
});

test('echo -e, printf, date', async () => {
  const s = makeShell();
  assert.strictEqual(await s.out('echo -e "a\\tb\\nc"'), 'a\tb\nc\n');
  assert.strictEqual(await s.out('echo -n oi'), 'oi');
  assert.strictEqual(await s.out('printf "%s tem %d anos\\n" Ana 20'), 'Ana tem 20 anos\n');
  assert.match(await s.out('date +%d/%m/%Y'), /^\d{2}\/\d{2}\/\d{4}\n$/);
});

test('nano salva o arquivo editado', async () => {
  const s = makeShell();
  s.io.nextEdit = '#!/bin/bash\necho editado\n';
  await s.run('nano novo.sh');
  assert.strictEqual(await s.out('bash novo.sh'), 'editado\n');
  assert.match(await s.out('nano'), /informe o nome do arquivo/);
});

test('man, --help, which, type, history, tree, file', async () => {
  const s = makeShell();
  assert.match(await s.out('man ls'), /lista o conteúdo/);
  assert.match(await s.out('grep --help'), /procura linhas/);
  assert.match(await s.out('man nada'), /Nenhuma entrada/);
  assert.strictEqual(await s.out('which ls'), '/usr/bin/ls\n');
  assert.match(await s.out('type cd'), /comando interno/);
  await s.run('echo um');
  assert.match(await s.out('history | grep "echo um"'), /echo um/);
  assert.match(await s.out('tree Documentos'), /└── numeros\.txt\n\n0 diretórios, 3 arquivos/);
  assert.match(await s.out('file /usr/bin/ls Documentos'), /ELF.*\n.*directory/);
});
