// Gera os diretórios e arquivos de cada nível do CTF dentro de ~/ctf.

import { makeRng } from '../shell/util.js';
import { LEVELS, seedFor, flagsFor, flagBody } from './game.js';

const PALAVRAS = ['abacaxi', 'azul', 'rato', 'veloz', 'nuvem', 'pedra', 'luz', 'trem', 'gato', 'sol', 'mar', 'vento',
  'folha', 'rio', 'lua', 'fogo', 'neve', 'barco', 'ponte', 'livro', 'porta', 'torre', 'sino', 'vidro',
  'tigre', 'lobo', 'urso', 'coruja', 'raposa', 'verde', 'roxo', 'branco', 'lento', 'antigo', 'novo', 'quieto', 'forte'];

const SERVICOS = ['nginx', 'sshd', 'cron', 'app-pinguim', 'kernel', 'systemd', 'backup', 'mysql'];
const MENSAGENS = [
  'requisição atendida em 12ms', 'conexão encerrada', 'verificando atualizações', 'cache limpo',
  'usuário autenticado', 'tarefa agendada concluída', 'memória em 43%', 'disco em 71%',
  'reiniciando worker', 'certificado válido', 'sincronização ok', 'fila vazia', 'nenhuma alteração detectada',
  'verificando flag de configuração... ok', 'a flag não está nesta linha', 'flag de depuração desativada',
];

const MODELO_SH = `#!/bin/bash
# Testa todos os códigos da fechadura, de 000 a 999.
# Complete as lacunas (____) e execute com:  bash modelo.sh

for codigo in ____ ; do          # dica: $(seq -w 0 999)
  resultado=$(./fechadura $codigo)
  if echo "$resultado" | grep -q "FLAG"; then
    echo "Código encontrado: $codigo"
    echo "$resultado"
    ____                         # dica: qual comando encerra um laço?
  fi
done
`;

export function buildCtf(vfs, home, nick, { now = Date.now() } = {}) {
  const rng = makeRng(seedFor(nick));
  const flags = flagsFor(nick);
  const base = home + '/ctf';
  const dir = (p) => vfs.mkdir(p, { parents: true });
  const file = (p, content, mode = 0o644) => {
    const n = vfs.writeFile(p, content, { mode });
    n.mtime = now;
    return n;
  };
  if (vfs.exists(base)) vfs.remove(base, { recursive: true });
  dir(base);

  // ----- Nível 1 -----
  file(base + '/LEIA-ME.txt', [
    '==========================================================',
    '   🐧  PINGUIMCORP · MISSÃO SERVIDOR PINGUIM',
    '==========================================================',
    '',
    'Olá, ' + nick + '! Você acaba de ser contratado(a) como',
    'administrador(a) de sistemas da PinguimCorp.',
    '',
    'O administrador anterior deixou 8 fragmentos de configuração',
    '(as flags) espalhados por este servidor. Recupere todos!',
    '',
    'Fragmento 1: ' + flags[1],
    '',
    'COMO JOGAR',
    '  • Cada nível está em um diretório: nivel2, nivel3, ..., nivel8',
    '  • Leia a missão de cada nível:   cat nivel2/missao.txt',
    '  • Achou uma flag? Envie com:     enviar FLAG{...}',
    '  • Travou? Peça uma dica:         dica 2',
    '  • Veja seu progresso:            progresso',
    '  • Lista de comandos:             help',
    '',
    'Comece enviando o fragmento 1 acima. Boa sorte! 🚩',
    '',
  ].join('\n'));

  // ----- Nível 2: arquivo oculto -----
  dir(base + '/nivel2');
  file(base + '/nivel2/missao.txt', 'NÍVEL 2 · O Invisível\n\nO fragmento 2 está neste diretório... mas o ls comum não mostra tudo.\n');
  file(base + '/nivel2/nada_aqui.txt', 'Nada aqui... 👀\nTem certeza de que listou TODOS os arquivos?\n');
  file(base + '/nivel2/.fragmento_secreto', 'Muito bem! Arquivos que começam com "." são ocultos.\nFragmento 2: ' + flags[2] + '\n');

  // ----- Nível 3: nomes com espaço e começando com "-" -----
  dir(base + '/nivel3');
  file(base + '/nivel3/missao.txt', 'NÍVEL 3 · Nome Traiçoeiro\n\nO fragmento 3 foi dividido em DOIS arquivos com nomes difíceis de abrir.\nLeia os dois e junte as metades (sem espaços) para formar a flag.\n');
  const body3 = flagBody(nick, 3);
  const cut = 'aspas_e_barras_'.length;
  file(base + '/nivel3/meia flag.txt', 'Primeira metade: FLAG{' + body3.slice(0, cut) + '\n');
  file(base + '/nivel3/-outra-metade', 'Segunda metade: ' + body3.slice(cut) + '}\n');

  // ----- Nível 4: labirinto de diretórios -----
  const lab = base + '/nivel4/labirinto';
  dir(lab);
  file(base + '/nivel4/missao.txt', 'NÍVEL 4 · O Labirinto\n\nEm algum lugar dentro de labirinto/ existe um arquivo chamado chave.flag.\nSão mais de 100 salas. Procurar uma por uma não é uma boa ideia...\n');
  const alas = ['ala_norte', 'ala_sul', 'ala_leste', 'ala_oeste', 'ala_central'];
  const salas = [];
  for (const a of alas) {
    for (let c = 1; c <= 5; c++) {
      for (const s of ['sala_a', 'sala_b', 'sala_c', 'sala_d']) {
        const p = lab + '/' + a + '/corredor_' + c + '/' + s;
        dir(p);
        salas.push(p);
        const r = rng.next();
        if (r < 0.35) file(p + '/pista.txt', 'Nada por aqui. Continue procurando...\n');
        else if (r < 0.45) file(p + '/chave.txt', 'Quase! Esta é só uma cópia falsa. Procure o arquivo chave.flag.\n');
      }
    }
  }
  file(rng.pick(salas) + '/chave.flag', 'Você encontrou a chave!\nFragmento 4: ' + flags[4] + '\n');

  // ----- Nível 5: 10.000 linhas -----
  dir(base + '/nivel5');
  file(base + '/nivel5/missao.txt', 'NÍVEL 5 · Agulha no Palheiro\n\npalheiro.txt é um log com 10.000 linhas. O fragmento 5 está em UMA delas.\n');
  const total = 10000;
  const secretAt = rng.int(3000, 9000);
  const lines = [];
  for (let i = 0; i < total; i++) {
    if (i === secretAt) lines.push('[' + fmtTime(rng) + '] cofre: fragmento 5 = ' + flags[5]);
    else lines.push('[' + fmtTime(rng) + '] ' + rng.pick(SERVICOS) + ': ' + rng.pick(MENSAGENS));
  }
  file(base + '/nivel5/palheiro.txt', lines.join('\n') + '\n');

  // ----- Nível 6: permissão 000 -----
  dir(base + '/nivel6');
  file(base + '/nivel6/missao.txt', 'NÍVEL 6 · Porta Trancada\n\nO fragmento 6 está em cofre.txt, mas ninguém consegue lê-lo.\nInvestigue as permissões do arquivo.\n');
  file(base + '/nivel6/cofre.txt', 'Destrancado! O dono de um arquivo pode alterar as permissões dele.\nFragmento 6: ' + flags[6] + '\n', 0o000);

  // ----- Nível 7: a única linha sem repetição -----
  dir(base + '/nivel7');
  file(base + '/nivel7/missao.txt', 'NÍVEL 7 · O Único\n\necos.txt é cheio de ecos: quase toda linha aparece várias vezes.\nA resposta é a ÚNICA linha que aparece uma só vez.\nEnvie-a dentro de FLAG{...}. Exemplo: se a linha for abc_123, envie FLAG{abc_123}\n');
  const used = new Set();
  const eco = [];
  while (used.size < 120) {
    const phrase = rng.pick(PALAVRAS) + '_' + rng.pick(PALAVRAS) + '_' + rng.pick(PALAVRAS) + '_' + rng.int(1000, 9999).toString(16);
    if (used.has(phrase)) continue;
    used.add(phrase);
    const times = rng.int(2, 5);
    for (let t = 0; t < times; t++) eco.push(phrase);
  }
  eco.push(flagBody(nick, 7));
  rng.shuffle(eco);
  file(base + '/nivel7/ecos.txt', eco.join('\n') + '\n');

  // ----- Nível 8: fechadura (automatização com laço) -----
  dir(base + '/nivel8');
  file(base + '/nivel8/missao.txt', [
    'NÍVEL 8 · A Fechadura',
    '',
    'O último fragmento está protegido por uma fechadura com código de 3 dígitos (000 a 999).',
    'Teste um código:   ./fechadura 123',
    '',
    'Digitar 1000 códigos à mão? Nem pensar! Esse é o trabalho perfeito para um script.',
    'Há um modelo pela metade em modelo.sh: complete as lacunas e rode  bash modelo.sh',
    '',
  ].join('\n'));
  const lock = vfs.writeFile(base + '/nivel8/fechadura', '\x7fELF\u0002\u0001\u0001\u0000 (binário simulado da fechadura)\n', { mode: 0o755, exec: 'fechadura' });
  lock.mtime = now;
  file(base + '/nivel8/modelo.sh', MODELO_SH);

  return { levels: LEVELS.length };
}

function fmtTime(rng) {
  const p = (n) => String(n).padStart(2, '0');
  return '2026-10-' + p(rng.int(1, 15)) + ' ' + p(rng.int(0, 23)) + ':' + p(rng.int(0, 59)) + ':' + p(rng.int(0, 59));
}
