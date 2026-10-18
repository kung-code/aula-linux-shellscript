// Roteiro de prática: os comandos de cada aula, na ordem dos slides (campo aula: 1 ou 2).
// Clicar num comando coloca ele na linha do terminal (o aluno aperta Enter).

export const ROTEIRO = [
  {
    aula: 1, title: 'Onde estou?',
    cmds: ['pwd', 'whoami', 'ls', 'ls -l', 'ls -a', 'ls -lh /etc'],
  },
  {
    aula: 1, title: 'Navegando',
    cmds: ['cd /etc', 'pwd', 'cd ..', 'cd ~', 'cd -', 'cd'],
  },
  {
    aula: 1, title: 'Criando',
    cmds: ['mkdir aula', 'mkdir -p aula/projeto/{scripts,dados}', 'touch aula/notas.txt', 'echo "Minha primeira linha" > aula/notas.txt', 'ls -R aula'],
  },
  {
    aula: 1, title: 'Copiar, mover, remover',
    cmds: ['cp aula/notas.txt aula/copia.txt', 'mv aula/copia.txt aula/backup.txt', 'cp -r aula aula_bkp', 'rm aula/backup.txt', 'rm -r aula_bkp'],
  },
  {
    aula: 1, title: 'Lendo arquivos',
    cmds: ['cat /etc/hostname', 'head -n 3 /etc/passwd', 'tail -n 2 /etc/passwd', 'wc -l /etc/passwd', 'man ls'],
  },
  {
    aula: 2, title: 'Redirecionamento',
    cmds: ['echo "linha 1" > teste.txt', 'echo "linha 2" >> teste.txt', 'cat teste.txt', 'ls /nao_existe 2> erros.txt', 'cat erros.txt'],
  },
  {
    aula: 2, title: 'Pipes',
    cmds: ['cat /etc/passwd | grep bash | wc -l', 'ls -l /etc | grep conf', 'cut -d: -f1 /etc/passwd | sort | head -n 5'],
  },
  {
    aula: 2, title: 'Busca',
    cmds: ['grep "root" /etc/passwd', 'grep -i "erro" /var/log/syslog', 'find ~ -name "*.txt"', 'find /etc -name "*.conf"'],
  },
  {
    aula: 2, title: 'Permissões',
    cmds: ['touch script.sh', 'ls -l script.sh', 'chmod 755 script.sh', 'ls -l script.sh', 'chmod go-rx script.sh'],
  },
  {
    aula: 2, title: 'Primeiro script',
    cmds: ['echo \'echo "Olá, $USER!"\' > ola.sh', 'cat ola.sh', './ola.sh', 'chmod +x ola.sh', './ola.sh', 'nano ola.sh', 'vi ola.sh'],
  },
  {
    aula: 2, title: 'Variáveis, if e laços',
    cmds: ['nome="Ana"; echo "Olá, $nome"', 'echo "Soma: $((2 + 3))"', 'idade=20; if [ "$idade" -ge 18 ]; then echo "Maior"; else echo "Menor"; fi', 'for i in 1 2 3; do echo "Número $i"; done', 'for i in $(seq 1 5); do echo $i; done'],
  },
];

// Desafio para casa de cada aula (feito no terminal de prática ou no Git Bash).
export const DESAFIOS = {
  1: {
    titulo: 'Meu primeiro projeto no terminal',
    passos: [
      'Na sua home, crie com um único comando: estudos/linux/anotacoes, estudos/linux/exercicios e estudos/linux/arquivo-morto',
      'Em anotacoes, crie comandos.txt com 5 comandos que você aprendeu, um por linha (use echo com > e >>)',
      'Copie comandos.txt para exercicios/ com o nome revisao.txt',
      'Crie 3 arquivos vazios em arquivo-morto/ (touch) e depois apague só um deles',
      'Mostre o resultado: ls -R estudos · wc -l estudos/linux/anotacoes/comandos.txt · head -n 2 estudos/linux/exercicios/revisao.txt',
      'Bônus: descubra no man ls como listar ordenando por tamanho e use em /etc',
    ],
    entrega: 'Copie a saída dos comandos do passo 5 (ou tire um print) e envie no canal da turma.',
  },
  2: {
    titulo: 'organizador.sh',
    passos: [
      'Crie um script que recebe uma pasta como argumento e valida se ela existe',
      'Mova os arquivos para imagens/, documentos/, audio/ e outros/, de acordo com a extensão',
      'Mostre um relatório no final (quantos arquivos foram para cada pasta)',
      'Bônus: opção -n para só simular, sem mover nada',
    ],
    entrega: 'Repositório no GitHub com o script e um README com um exemplo de uso.',
  },
};
