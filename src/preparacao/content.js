// Conteúdo de apoio da página de preparação: glossário e arquivos de exemplo do terminal.

export const GLOSSARIO = {
  sublinhadas: ['Assim!', 'Toque de novo (ou em outro lugar) para fechar.'],
  kernel: ['Kernel:', 'o núcleo do sistema operacional. Controla o hardware, a memória, os processos e as permissões.'],
  shell: ['Shell:', 'o programa que lê o que você digita e executa os comandos. No Linux, normalmente é o bash.'],
  raiz: ['Raiz:', 'o diretório /, o topo da árvore. Todos os arquivos e pastas ficam dentro dele.'],
  home: ['Home:', 'sua pasta pessoal (/home/seu-usuario). O atalho ~ sempre leva até ela.'],
  argumento: ['Argumento:', 'cada palavra que vem depois do comando. Diz sobre o que ele vai agir, como um arquivo ou uma pasta.'],
  opcao: ['Opção:', 'um argumento que começa com - e muda o jeito de o comando funcionar. Exemplo: o -l em ls -l.'],
  path: ['PATH:', 'a lista de pastas onde o shell procura os programas. Veja a sua com: echo $PATH'],
  stdin: ['stdin (0):', 'a entrada padrão, de onde o programa lê. Normalmente é o teclado, ou o que chega por um pipe.'],
  stdout: ['stdout (1):', 'a saída padrão, onde o programa escreve os resultados. Normalmente vai para a tela.'],
  stderr: ['stderr (2):', 'o canal de erros. Também vai para a tela, mas é separado da saída normal.'],
  codigo: ['Código de saída:', 'o número que todo comando devolve ao terminar: 0 é sucesso, qualquer outro valor é erro. Fica em $?'],
  root: ['root:', 'o administrador do sistema, que pode tudo. O sudo executa um comando como root.'],
};

// Arquivos usados pelos exemplos dos terminais da página.
export function setupPrepFiles(vfs, home) {
  vfs.writeFile(home + '/meu arquivo.txt', 'Este arquivo tem um espaço no nome.\nPara o shell, "meu arquivo.txt" (com aspas) é uma palavra só.\n');
  vfs.writeFile(home + '/ola.sh', '#!/bin/bash\necho "Olá, $USER! Você rodou um script da pasta atual."\n', { mode: 0o755 });
}
