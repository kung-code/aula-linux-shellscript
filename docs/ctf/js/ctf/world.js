// Gera os diretórios e arquivos de cada nível do CTF dentro de ~/ctf.
// Os níveis dependem da aula (docs/aula.js): cada um mora em ~/ctf/nivelN.

import { makeRng } from '../shell/util.js';
import { AULA } from '../../../aula.js';
import { levelsFor, seedFor, flagsFor, flagBody, countFor } from './game.js';

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

const BIN = '\x7fELF\u0002\u0001\u0001\u0000 (binário simulado)\n';

function fmtTime(rng) {
  const p = (n) => String(n).padStart(2, '0');
  return '2026-10-' + p(rng.int(1, 15)) + ' ' + p(rng.int(0, 23)) + ':' + p(rng.int(0, 59)) + ':' + p(rng.int(0, 59));
}

export function buildCtf(vfs, home, nick, { now = Date.now(), aula = AULA } = {}) {
  const rng = makeRng(seedFor(nick, aula));
  const flags = flagsFor(nick, aula);
  const levels = levelsFor(aula);
  const base = home + '/ctf';
  const dir = (p) => vfs.mkdir(p, { parents: true });
  const file = (p, content, mode = 0o644) => {
    const n = vfs.writeFile(p, content, { mode });
    n.mtime = now;
    return n;
  };
  const binary = (p, exec) => {
    const n = vfs.writeFile(p, BIN, { mode: 0o755, exec });
    n.mtime = now;
  };
  if (vfs.exists(base)) vfs.remove(base, { recursive: true });
  dir(base);

  const builders = {
    boasvindas(_d, l) {
      // o próprio LEIA-ME, em ~/ctf
      file(base + '/LEIA-ME.txt', [
        '==========================================================',
        '   🐧  PINGUIMCORP · MISSÃO SERVIDOR PINGUIM · AULA ' + aula,
        '==========================================================',
        '',
        'Olá, ' + nick + '! Você acaba de ser contratado(a) como',
        'administrador(a) de sistemas da PinguimCorp.',
        '',
        'O administrador anterior deixou ' + levels.length + ' fragmentos de configuração',
        '(as flags) espalhados por este servidor. Recupere todos!',
        '',
        'Fragmento ' + l.id + ': ' + flags[l.id],
        '',
        'COMO JOGAR',
        '  • Cada nível está em um diretório: nivel2, nivel3, ..., nivel' + levels.length,
        '  • Leia a missão de cada nível:   cat nivel2/missao.txt',
        '  • Achou uma flag? Envie com:     enviar FLAG{...}',
        '  • Travou? Peça uma dica:         dica 2',
        '  • Veja seu progresso:            progresso',
        '  • Lista de comandos:             help',
        '',
        'Comece enviando o fragmento 1 acima. Boa sorte! 🚩',
        '',
      ].join('\n'));
    },

    oculto(d, l) {
      file(d + '/missao.txt', 'NÍVEL ' + l.id + ' · O Invisível\n\nO fragmento está neste diretório... mas o ls comum não mostra tudo.\n');
      file(d + '/nada_aqui.txt', 'Nada aqui... 👀\nTem certeza de que listou TODOS os arquivos?\n');
      file(d + '/.fragmento_secreto', 'Muito bem! Arquivos que começam com "." são ocultos.\nFragmento ' + l.id + ': ' + flags[l.id] + '\n');
    },

    nomes(d, l) {
      file(d + '/missao.txt', 'NÍVEL ' + l.id + ' · Nome Traiçoeiro\n\nO fragmento foi dividido em DOIS arquivos com nomes difíceis de abrir.\nLeia os dois e junte as metades (sem espaços) para formar a flag.\n');
      const body = flagBody(nick, 'nomes', aula);
      const cut = 'aspas_e_barras_'.length;
      file(d + '/meia flag.txt', 'Primeira metade: FLAG{' + body.slice(0, cut) + '\n');
      file(d + '/-outra-metade', 'Segunda metade: ' + body.slice(cut) + '}\n');
    },

    // Aula 1: caminhos relativos (..) e absolutos (/), seguindo pistas
    tesouro(d, l) {
      file(d + '/missao.txt', [
        'NÍVEL ' + l.id + ' · Caça ao Tesouro', '',
        'Um mapa foi dividido em pistas. Comece em inicio/ e, em cada pasta,',
        'leia o pista.txt e faça o que ele pede (com cd).', '',
        '  cd inicio', '  cat pista.txt', '',
      ].join('\n'));
      const esconderijo = '/tmp/pinguim_' + nick.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) + '/cofre';
      dir(d + '/inicio');
      dir(d + '/predio/andar1/sala_a');
      dir(d + '/predio/andar1/sala_b');
      dir(d + '/predio/andar2/sala_c');
      dir(d + '/predio/andar2/sala_d/armario');
      dir(d + '/porao');
      file(d + '/inicio/pista.txt', 'Pista 1: suba um nível (cd ..) e entre na pasta predio.\nDepois, entre em andar2.\nLá você encontra a próxima pista.\n');
      file(d + '/predio/andar2/pista.txt', 'Pista 2: entre em sala_d e depois em armario.\nDica: dá para fazer de uma vez: cd sala_d/armario\n');
      file(d + '/predio/andar2/sala_d/armario/pista.txt', 'Pista 3: o tesouro foi levado para fora daqui!\nUse um caminho ABSOLUTO (começa com /):\n\n  cd ' + esconderijo + '\n');
      file(d + '/predio/andar1/sala_a/pista.txt', 'Esta sala está vazia. Volte (cd ..) e confira as pistas de novo.\n');
      file(d + '/predio/andar1/sala_b/pista.txt', 'Caminho errado! Volte duas pastas (cd ../..) e recomece pelo andar2.\n');
      file(d + '/predio/andar2/sala_c/pista.txt', 'Nada aqui. O armário fica na sala_d.\n');
      file(d + '/porao/pista.txt', 'O porão está escuro e vazio. Comece pela pasta inicio.\n');
      const top = esconderijo.split('/').slice(0, 3).join('/');
      if (vfs.exists(top)) vfs.remove(top, { recursive: true });
      dir(esconderijo);
      file(esconderijo + '/tesouro.txt', 'Você achou o tesouro seguindo caminhos relativos e absolutos!\nFragmento ' + l.id + ': ' + flags[l.id] + '\n');
    },

    // Aula 1: a flag está no começo de um arquivo enorme (head)
    inicio(d, l) {
      file(d + '/missao.txt', 'NÍVEL ' + l.id + ' · O Começo de Tudo\n\nhistorico.log tem milhares de linhas. O fragmento foi anotado logo no começo.\n');
      const lines = ['# Histórico do servidor PinguimCorp', '# fragmento ' + l.id + ': ' + flags[l.id], '# (não apague este cabeçalho)'];
      for (let i = 0; i < 6000; i++) lines.push('[' + fmtTime(rng) + '] ' + rng.pick(SERVICOS) + ': ' + rng.pick(MENSAGENS));
      file(d + '/historico.log', lines.join('\n') + '\n');
    },

    // Aula 1: a flag depende do número de linhas (wc -l)
    contagem(d, l) {
      const n = countFor(nick, aula);
      const tag = flagBody(nick, 'contagem', aula).split('_').pop();
      file(d + '/missao.txt', [
        'NÍVEL ' + l.id + ' · Contagem', '',
        'O auditor quer saber quantos registros existem em registros.txt.',
        'A flag é montada com esse número N:', '',
        '  FLAG{contei_N_linhas_' + tag + '}', '',
        'Exemplo: se o arquivo tivesse 42 linhas, a flag seria FLAG{contei_42_linhas_' + tag + '}',
        '',
      ].join('\n'));
      const regs = [];
      for (let i = 1; i <= n; i++) regs.push('registro ' + String(i).padStart(4, '0') + ' · ' + rng.pick(PALAVRAS) + ' ' + rng.pick(PALAVRAS));
      rng.shuffle(regs);
      file(d + '/registros.txt', regs.join('\n') + '\n');
    },

    // Aula 1: criar pasta, copiar com outro nome e apagar arquivo (mkdir, cp, rm)
    mudanca(d, l) {
      file(d + '/missao.txt', [
        'NÍVEL ' + l.id + ' · Organizando a Casa', '',
        'O sistema de entregas só libera o fragmento quando tudo estiver organizado:', '',
        '  1. Crie a pasta entrega (dentro deste nível).',
        '  2. COPIE rascunhos/relatorio_v3.txt para entrega/, com o nome relatorio_final.txt.',
        '     (o original deve continuar em rascunhos/)',
        '  3. Apague o arquivo rascunhos/lixo.tmp.', '',
        'Depois rode ./conferir para ver o que já está certo.', '',
      ].join('\n'));
      dir(d + '/rascunhos');
      file(d + '/rascunhos/relatorio_v1.txt', 'Relatório (versão 1, desatualizada)\n');
      file(d + '/rascunhos/relatorio_v2.txt', 'Relatório (versão 2, desatualizada)\n');
      file(d + '/rascunhos/relatorio_v3.txt', 'Relatório final da PinguimCorp\nServidores: 12 · Incidentes: 0 · Pinguins felizes: muitos\n');
      file(d + '/rascunhos/lixo.tmp', 'arquivo temporário (pode apagar)\n');
      binary(d + '/conferir', 'conferir');
    },

    labirinto(d, l) {
      const lab = d + '/labirinto';
      dir(lab);
      file(d + '/missao.txt', 'NÍVEL ' + l.id + ' · O Labirinto\n\nEm algum lugar dentro de labirinto/ existe um arquivo chamado chave.flag.\nSão mais de 100 salas. Procurar uma por uma não é uma boa ideia...\n');
      const salas = [];
      for (const a of ['ala_norte', 'ala_sul', 'ala_leste', 'ala_oeste', 'ala_central']) {
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
      file(rng.pick(salas) + '/chave.flag', 'Você encontrou a chave!\nFragmento ' + l.id + ': ' + flags[l.id] + '\n');
    },

    palheiro(d, l) {
      file(d + '/missao.txt', 'NÍVEL ' + l.id + ' · Agulha no Palheiro\n\npalheiro.txt é um log com 10.000 linhas. O fragmento está em UMA delas.\n');
      const total = 10000;
      const secretAt = rng.int(3000, 9000);
      const lines = [];
      for (let i = 0; i < total; i++) {
        if (i === secretAt) lines.push('[' + fmtTime(rng) + '] cofre: fragmento ' + l.id + ' = ' + flags[l.id]);
        else lines.push('[' + fmtTime(rng) + '] ' + rng.pick(SERVICOS) + ': ' + rng.pick(MENSAGENS));
      }
      file(d + '/palheiro.txt', lines.join('\n') + '\n');
    },

    // Aula 2: a flag sai pelo canal de erros (stderr)
    canal(d, l) {
      file(d + '/missao.txt', [
        'NÍVEL ' + l.id + ' · Canal Errado', '',
        'O ./transmissor despeja milhares de linhas: as normais na saída (stdout)',
        'e as de erro no canal de erros (stderr). O fragmento veio num pacote com erro.', '',
        'Teste: ./transmissor | grep FLAG   ...e repare no que passa direto pelo grep.', '',
      ].join('\n'));
      binary(d + '/transmissor', 'transmissor');
    },

    permissao(d, l) {
      file(d + '/missao.txt', 'NÍVEL ' + l.id + ' · Porta Trancada\n\nO fragmento está em cofre.txt, mas ninguém consegue lê-lo.\nInvestigue as permissões do arquivo.\n');
      file(d + '/cofre.txt', 'Destrancado! O dono de um arquivo pode alterar as permissões dele.\nFragmento ' + l.id + ': ' + flags[l.id] + '\n', 0o000);
    },

    unico(d, l) {
      file(d + '/missao.txt', 'NÍVEL ' + l.id + ' · O Único\n\necos.txt é cheio de ecos: quase toda linha aparece várias vezes.\nA resposta é a ÚNICA linha que aparece uma só vez.\nEnvie-a dentro de FLAG{...}. Exemplo: se a linha for abc_123, envie FLAG{abc_123}\n');
      const used = new Set();
      const eco = [];
      while (used.size < 120) {
        const phrase = rng.pick(PALAVRAS) + '_' + rng.pick(PALAVRAS) + '_' + rng.pick(PALAVRAS) + '_' + rng.int(1000, 9999).toString(16);
        if (used.has(phrase)) continue;
        used.add(phrase);
        const times = rng.int(2, 5);
        for (let t = 0; t < times; t++) eco.push(phrase);
      }
      eco.push(flagBody(nick, 'unico', aula));
      rng.shuffle(eco);
      file(d + '/ecos.txt', eco.join('\n') + '\n');
    },

    fechadura(d, l) {
      file(d + '/missao.txt', [
        'NÍVEL ' + l.id + ' · A Fechadura', '',
        'O último fragmento está protegido por uma fechadura com código de 3 dígitos (000 a 999).',
        'Teste um código:   ./fechadura 123', '',
        'Digitar 1000 códigos à mão? Nem pensar! Esse é o trabalho perfeito para um script.',
        'Há um modelo pela metade em modelo.sh: complete as lacunas e rode  bash modelo.sh', '',
      ].join('\n'));
      binary(d + '/fechadura', 'fechadura');
      file(d + '/modelo.sh', MODELO_SH);
    },
  };

  for (const l of levels) {
    const d = base + '/nivel' + l.id;
    if (l.key !== 'boasvindas') dir(d);
    builders[l.key](d, l);
  }
  return { levels: levels.length };
}
