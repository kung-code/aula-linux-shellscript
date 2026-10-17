// Dados do diagrama interativo "As camadas do Linux".

export const LAYERS = [
  {
    id: 'user', name: 'Você', sub: 'o usuário', icon: 'i-user', space: 'user',
    desc: 'É quem dá as ordens. Você digita comandos no terminal (ou clica em ícones numa interface gráfica).',
    examples: ['digitar ls -l', 'rodar um script', 'abrir o navegador'],
  },
  {
    id: 'shell', name: 'Shell', sub: 'bash · zsh · sh', icon: 'i-shell', space: 'user',
    desc: 'O intérprete de comandos. Lê o que você digitou, expande variáveis e curingas (*.txt), e chama o programa certo.',
    examples: ['separa comando e opções', 'expande $USER e *.txt', 'liga programas com |'],
  },
  {
    id: 'apps', name: 'Programas', sub: 'ls · grep · cat · navegador', icon: 'i-apps', space: 'user',
    desc: 'Cada comando é um programa (fica em /usr/bin). Programas não mexem direto no hardware: eles pedem ao kernel por meio de chamadas de sistema.',
    examples: ['/usr/bin/ls', '/usr/bin/grep', 'firefox, python, docker'],
  },
  {
    id: 'kernel', name: 'Kernel', sub: 'o núcleo do Linux', icon: 'i-chip', space: 'kernel',
    desc: 'O coração do sistema. Gerencia processos, memória, sistema de arquivos, permissões, rede e os drivers de cada dispositivo.',
    examples: ['agenda os processos', 'confere permissões', 'drivers: disco, rede, USB'],
  },
  {
    id: 'hw', name: 'Hardware', sub: 'CPU · RAM · disco · rede', icon: 'i-drive', space: 'hw',
    desc: 'A parte física: processador, memória, disco, placa de rede. Só o kernel conversa diretamente com ela.',
    examples: ['CPU executa instruções', 'SSD guarda os arquivos', 'placa de rede'],
  },
];

// Jornada de um comando: o que acontece quando você digita "ls -l".
export const JOURNEY = [
  { layer: 'user', dir: 'down', text: 'Você digita <code>ls -l</code> no terminal e aperta Enter.' },
  { layer: 'shell', dir: 'down', text: 'O <b>shell</b> lê a linha, separa o comando (<code>ls</code>) da opção (<code>-l</code>) e encontra o programa <code>/usr/bin/ls</code>.' },
  { layer: 'apps', dir: 'down', text: 'O programa <b>ls</b> começa a rodar. Para ler o diretório, ele faz uma <b>chamada de sistema</b> (system call) ao kernel.' },
  { layer: 'kernel', dir: 'down', text: 'O <b>kernel</b> confere suas <b>permissões</b>, consulta o sistema de arquivos e aciona o driver do disco.' },
  { layer: 'hw', dir: 'down', text: 'O <b>disco</b> entrega os dados pedidos.' },
  { layer: 'kernel', dir: 'up', text: 'O kernel devolve a lista de arquivos para o <code>ls</code>.' },
  { layer: 'apps', dir: 'up', text: 'O <code>ls</code> formata o resultado: permissões, dono, tamanho e data.' },
  { layer: 'user', dir: 'up', text: 'O resultado aparece no seu terminal. Tudo isso em poucos <b>milissegundos</b>!' },
];
