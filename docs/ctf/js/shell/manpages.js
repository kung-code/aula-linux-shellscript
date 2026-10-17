// Páginas de manual resumidas (pt-BR). Usadas por "man <cmd>" e "<cmd> --help".

export const MAN = {
  pwd: `pwd - mostra o diretório atual (print working directory)
USO: pwd
EXEMPLO: pwd   →   /home/aluno`,

  cd: `cd - muda de diretório (change directory)
USO: cd [DIRETÓRIO]
  cd          vai para a sua home (~)
  cd ..       sobe um nível
  cd -        volta ao diretório anterior
  cd /etc     caminho absoluto     cd docs   caminho relativo`,

  ls: `ls - lista o conteúdo de diretórios
USO: ls [OPÇÕES] [ARQUIVO...]
  -a   mostra também os arquivos ocultos (que começam com .)
  -A   como -a, mas sem . e ..
  -l   formato longo (permissões, dono, tamanho, data)
  -h   tamanhos legíveis (1,5K, 2M) — use com -l
  -R   lista subdiretórios recursivamente
  -S   ordena por tamanho      -t  ordena por data      -r  inverte a ordem
  -d   lista o diretório em si, não o conteúdo
  -1   um item por linha       -F  indica tipo (/ diretório, * executável)
EXEMPLOS: ls -la      ls -lh /etc      ls *.txt`,

  cat: `cat - concatena e mostra o conteúdo de arquivos
USO: cat [OPÇÕES] [ARQUIVO...]
  -n   numera as linhas
EXEMPLOS: cat notas.txt      cat a.txt b.txt > juntos.txt
DICA: nome com espaço → cat "meu arquivo.txt"   nome começando com - → cat ./-arquivo`,

  less: `less - mostra o conteúdo de um arquivo (no Linux real, permite rolar; aqui funciona como o cat)
USO: less ARQUIVO`,

  more: `more - mostra o conteúdo de um arquivo (aqui funciona como o cat)
USO: more ARQUIVO`,

  head: `head - mostra o início de um arquivo
USO: head [-n N] [ARQUIVO...]
  -n N   mostra as N primeiras linhas (padrão: 10). Também aceita: head -5
EXEMPLO: head -n 3 /etc/passwd`,

  tail: `tail - mostra o final de um arquivo
USO: tail [-n N] [ARQUIVO...]
  -n N    mostra as N últimas linhas (padrão: 10)
  -n +N   mostra a partir da linha N
EXEMPLO: tail -n 5 /var/log/syslog`,

  wc: `wc - conta linhas, palavras e bytes
USO: wc [-l] [-w] [-c] [ARQUIVO...]
  -l  linhas     -w  palavras     -c  bytes
EXEMPLOS: wc -l /etc/passwd      ls | wc -l`,

  echo: `echo - imprime um texto
USO: echo [-n] [-e] [TEXTO...]
  -n   não pula linha no final
  -e   interpreta \\n (nova linha), \\t (tab), \\e (cores)
EXEMPLOS: echo "Olá, $USER"      echo "linha" >> arquivo.txt`,

  printf: `printf - imprime texto formatado
USO: printf FORMATO [ARGUMENTOS...]
  %s texto   %d número inteiro   %.2f decimal   \\n nova linha
EXEMPLO: printf "%s tem %d anos\\n" Ana 20`,

  touch: `touch - cria um arquivo vazio (ou atualiza a data de um existente)
USO: touch ARQUIVO...
EXEMPLO: touch notas.txt foto{1..3}.jpg`,

  mkdir: `mkdir - cria diretórios
USO: mkdir [-p] DIRETÓRIO...
  -p   cria os diretórios intermediários, sem erro se já existir
EXEMPLOS: mkdir projeto      mkdir -p projeto/{src,docs,testes}`,

  rmdir: `rmdir - remove diretórios VAZIOS
USO: rmdir DIRETÓRIO...`,

  rm: `rm - remove arquivos e diretórios (NÃO existe lixeira!)
USO: rm [OPÇÕES] ARQUIVO...
  -r   remove diretórios e todo o conteúdo (recursivo)
  -f   força, sem avisar se não existir
  -i   pergunta antes de remover
  -v   mostra o que está sendo removido
CUIDADO: rm -rf apaga tudo sem perguntar.`,

  cp: `cp - copia arquivos e diretórios
USO: cp [-r] ORIGEM... DESTINO
  -r   copia diretórios recursivamente
  -v   mostra o que está sendo copiado
EXEMPLOS: cp a.txt b.txt      cp -r projeto projeto_backup      cp *.txt docs/`,

  mv: `mv - move ou renomeia arquivos e diretórios
USO: mv ORIGEM... DESTINO
EXEMPLOS: mv velho.txt novo.txt (renomeia)      mv foto.jpg imagens/ (move)`,

  grep: `grep - procura linhas que contêm um padrão
USO: grep [OPÇÕES] PADRÃO [ARQUIVO...]
  -i   ignora maiúsculas/minúsculas      -v   mostra as linhas que NÃO combinam
  -n   mostra o número da linha          -c   conta as linhas que combinam
  -r   procura recursivamente em diretórios
  -l   mostra só o nome dos arquivos     -o   mostra só o trecho que combinou
  -w   palavra inteira                   -E   expressão regular estendida
  -q   silencioso (só o código de saída)
EXEMPLOS: grep root /etc/passwd      grep -ri "erro" /var/log      ls | grep txt`,

  find: `find - procura arquivos e diretórios
USO: find [CAMINHO...] [EXPRESSÃO]
  -name PADRÃO    pelo nome (use aspas: -name "*.txt")
  -iname PADRÃO   pelo nome, ignorando maiúsculas/minúsculas
  -type f|d       f = arquivo, d = diretório
  -size [+-]N[c|k|M]   pelo tamanho (+1M = maior que 1 MB)
  -maxdepth N     limita a profundidade      -empty   vazios
  ! / -not        nega o teste seguinte
EXEMPLOS: find ~ -name "*.txt"      find . -type d      find /etc -name "*.conf"`,

  chmod: `chmod - altera permissões
USO: chmod [-R] MODO ARQUIVO...
  Numérico: r=4 w=2 x=1, somados para dono/grupo/outros
    chmod 755 script.sh   → rwxr-xr-x       chmod 644 notas.txt → rw-r--r--
  Simbólico: [u g o a][+ - =][r w x]
    chmod +x script.sh     chmod u+r arquivo     chmod go-w arquivo
  -R   aplica recursivamente`,

  sort: `sort - ordena linhas
USO: sort [OPÇÕES] [ARQUIVO...]
  -r  ordem reversa     -n  numérica     -u  remove repetidas     -f  ignora maiúsculas
  -t SEP -k N   ordena pelo campo N, separado por SEP
EXEMPLOS: sort nomes.txt      sort -n numeros.txt      cut -d: -f1 /etc/passwd | sort`,

  uniq: `uniq - remove/conta linhas repetidas VIZINHAS (use sort antes!)
USO: uniq [OPÇÕES] [ARQUIVO]
  -c  conta as repetições     -u  só as linhas que aparecem uma vez     -d  só as repetidas
EXEMPLOS: sort nomes.txt | uniq      sort nomes.txt | uniq -c      sort x | uniq -u`,

  cut: `cut - extrai colunas de cada linha
USO: cut -d SEPARADOR -f CAMPOS [ARQUIVO...]   ou   cut -c CARACTERES
  -d  separador (padrão: tab)     -f  campos (ex.: 1   1,3   2-4)     -c  caracteres
EXEMPLO: cut -d: -f1 /etc/passwd   (lista os usuários)`,

  tr: `tr - troca ou apaga caracteres
USO: tr CONJUNTO1 CONJUNTO2     tr -d CONJUNTO
EXEMPLOS: echo "oi" | tr a-z A-Z      echo "a-b-c" | tr -d "-"`,

  seq: `seq - gera uma sequência de números
USO: seq [-w] [-s SEP] [INÍCIO [PASSO]] FIM
  -w   iguala a largura com zeros à esquerda (001, 002, ...)
EXEMPLOS: seq 5      seq 2 2 10      seq -w 0 999`,

  date: `date - mostra a data e hora
USO: date [+FORMATO]
  %d dia  %m mês  %Y ano  %H hora  %M minuto  %S segundo  %A dia da semana
EXEMPLOS: date      date +%d/%m/%Y      date +%H:%M`,

  whoami: `whoami - mostra o nome do usuário atual`,
  id: `id - mostra o usuário e os grupos (uid/gid)`,
  hostname: `hostname - mostra o nome da máquina`,
  uname: `uname - informações do sistema
USO: uname [-a]
  -a   todas as informações (kernel, máquina, arquitetura)`,
  clear: `clear - limpa a tela (atalho: Ctrl+L)`,
  history: `history - mostra os comandos já digitados
USO: history      history | grep cd      history -c (limpa)
DICA: use as setas ↑ ↓ para navegar no histórico`,
  man: `man - mostra o manual de um comando
USO: man COMANDO
EXEMPLO: man ls`,
  which: `which - mostra onde está o programa de um comando
USO: which COMANDO
EXEMPLO: which ls   →   /usr/bin/ls`,
  type: `type - diz se um comando é interno do shell ou um programa
USO: type COMANDO`,
  tree: `tree - mostra a árvore de diretórios
USO: tree [-a] [-d] [-L NÍVEL] [DIRETÓRIO]
  -a  inclui ocultos     -d  só diretórios     -L N  limita a profundidade`,
  file: `file - descobre o tipo de um arquivo
USO: file ARQUIVO...`,
  base64: `base64 - codifica/decodifica em Base64
USO: base64 [-d] [ARQUIVO]
  -d   decodifica
EXEMPLO: echo "oi" | base64      echo "b2kK" | base64 -d`,
  rev: `rev - inverte os caracteres de cada linha
EXEMPLO: echo "abc" | rev   →   cba`,
  sha256sum: `sha256sum - calcula o hash SHA-256
USO: sha256sum [ARQUIVO...]`,
  nano: `nano - editor de texto simples
USO: nano ARQUIVO
ATALHOS: Ctrl+O salva     Ctrl+X sai`,
  vi: `vi / vim - editor de texto com modos (o clássico dos servidores Linux)
USO: vi ARQUIVO
MODOS:
  normal    (ao abrir) as teclas são comandos      Esc volta para ele
  inserção  i (antes do cursor) · a (depois) · o (nova linha abaixo) · A (fim da linha)
  comando   : seguido de um comando e Enter
COMANDOS:
  :w  salva     :q  sai     :wq ou :x ou ZZ  salva e sai     :q!  sai SEM salvar
  h j k l ou setas  movem o cursor     0 / $  início / fim da linha     gg / G  início / fim do arquivo
  x apaga caractere   dd apaga linha   yy copia linha   p cola   u desfaz
DICA: travou? Aperte Esc e digite :q!`,

  test: `test / [ ] - avalia condições (usado com if e while)
USO: [ EXPRESSÃO ]   (os espaços dentro dos colchetes são obrigatórios!)
  Números:  -eq igual  -ne diferente  -lt menor  -le menor/igual  -gt maior  -ge maior/igual
  Textos:   =  igual    != diferente   -z vazio   -n não vazio
  Arquivos: -e existe   -f é arquivo   -d é diretório   -r legível   -w gravável   -x executável
  !  nega
EXEMPLOS: [ "$idade" -ge 18 ]     [ -f notas.txt ]     [ -z "$nome" ]`,
  read: `read - lê uma linha digitada pelo usuário e guarda em variáveis
USO: read [-p "PERGUNTA"] VARIÁVEL...
EXEMPLO: read -p "Seu nome: " nome; echo "Olá, $nome"`,
  export: `export - torna uma variável visível para os scripts executados
USO: export NOME=valor`,
  unset: `unset - remove uma variável
USO: unset NOME`,
  exit: `exit - encerra o script (ou o shell) com um código de saída
USO: exit [CÓDIGO]    (0 = sucesso, outro valor = erro)`,
  source: `source - executa um script no shell atual (as variáveis permanecem)
USO: source ARQUIVO   ou   . ARQUIVO`,
  bash: `bash - executa um script com o interpretador bash
USO: bash SCRIPT [ARGUMENTOS...]     bash -c "COMANDOS"`,
  sleep: `sleep - espera N segundos
USO: sleep N`,
  env: `env - mostra as variáveis de ambiente`,
  printenv: `printenv - mostra variáveis de ambiente
USO: printenv [NOME]`,
  sudo: `sudo - executa um comando como administrador (root)
Neste simulador você é um usuário comum, sem sudo.`,
};

MAN['['] = MAN.test;
MAN.vim = MAN.vi;
MAN.sh = MAN.bash;
MAN['.'] = MAN.source;
