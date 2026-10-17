// Roteiro de prática: os comandos da aula, na ordem dos slides.
// Clicar num comando coloca ele na linha do terminal (o aluno aperta Enter).

export const ROTEIRO = [
  {
    title: 'Onde estou?',
    cmds: ['pwd', 'whoami', 'ls', 'ls -l', 'ls -a', 'ls -lh /etc'],
  },
  {
    title: 'Navegando',
    cmds: ['cd /etc', 'pwd', 'cd ..', 'cd ~', 'cd -', 'cd'],
  },
  {
    title: 'Criando',
    cmds: ['mkdir aula', 'mkdir -p aula/projeto/{scripts,dados}', 'touch aula/notas.txt', 'echo "Minha primeira linha" > aula/notas.txt', 'ls -R aula'],
  },
  {
    title: 'Copiar, mover, remover',
    cmds: ['cp aula/notas.txt aula/copia.txt', 'mv aula/copia.txt aula/backup.txt', 'cp -r aula aula_bkp', 'rm aula/backup.txt', 'rm -r aula_bkp'],
  },
  {
    title: 'Lendo arquivos',
    cmds: ['cat /etc/hostname', 'head -n 3 /etc/passwd', 'tail -n 2 /etc/passwd', 'wc -l /etc/passwd', 'man ls'],
  },
  {
    title: 'Redirecionamento',
    cmds: ['echo "linha 1" > teste.txt', 'echo "linha 2" >> teste.txt', 'cat teste.txt', 'ls /nao_existe 2> erros.txt', 'cat erros.txt'],
  },
  {
    title: 'Pipes',
    cmds: ['cat /etc/passwd | grep bash | wc -l', 'ls -l /etc | grep conf', 'cut -d: -f1 /etc/passwd | sort | head -n 5'],
  },
  {
    title: 'Busca',
    cmds: ['grep "root" /etc/passwd', 'grep -i "erro" /var/log/syslog', 'find ~ -name "*.txt"', 'find /etc -name "*.conf"'],
  },
  {
    title: 'Permissões',
    cmds: ['touch script.sh', 'ls -l script.sh', 'chmod 755 script.sh', 'ls -l script.sh', 'chmod go-rx script.sh'],
  },
  {
    title: 'Primeiro script',
    cmds: ['echo \'echo "Olá, $USER!"\' > ola.sh', 'cat ola.sh', './ola.sh', 'chmod +x ola.sh', './ola.sh', 'nano ola.sh', 'vi ola.sh'],
  },
  {
    title: 'Variáveis, if e laços',
    cmds: ['nome="Ana"; echo "Olá, $nome"', 'echo "Soma: $((2 + 3))"', 'idade=20; if [ "$idade" -ge 18 ]; then echo "Maior"; else echo "Menor"; fi', 'for i in 1 2 3; do echo "Número $i"; done', 'for i in $(seq 1 5); do echo $i; done'],
  },
];
