// CTF "Missão Servidor Pinguim": flags, dicas, pontuação e comandos do jogo.

import { sha256, C } from '../shell/util.js';

// Textos-base das flags, invertidos para não aparecerem "de bandeja" no código-fonte.
const rev = (s) => s.split('').reverse().join('');
const BASES = {
  1: rev('lanimret_oa_odniv_meb'),
  2: rev('emos_ednocse_es_euq_odut_men'),
  3: rev('sadiv_mavlas_sarrab_e_sapsa'),
  4: rev('ahluga_eta_artnocne_dnif'),
  5: rev('ogima_rohlem_uem_e_perg'),
  6: rev('satrop_erba_domhc'),
  7: rev('odut_matcenoc_sepip'),
  8: rev('afaret_ariemirp_ahnim_ieziztamotua'),
};

export const LEVELS = [
  {
    id: 1, title: 'Boas-vindas', points: 10, skill: 'cd · ls · cat',
    hints: [
      'O arquivo LEIA-ME.txt fica dentro do diretório ctf, na sua home.',
      'Para ver o conteúdo de um arquivo, use o comando cat.',
      'Digite: cat ~/ctf/LEIA-ME.txt',
    ],
  },
  {
    id: 2, title: 'O Invisível', points: 10, skill: 'ls -a (arquivos ocultos)',
    hints: [
      'No Linux, arquivos cujo nome começa com "." ficam escondidos do ls comum.',
      'Consulte o manual: man ls — procure a opção que mostra todos ("all").',
      'Entre em nivel2 e use: ls -a   (depois, cat no arquivo que começa com ponto)',
    ],
  },
  {
    id: 3, title: 'Nome Traiçoeiro', points: 15, skill: 'aspas · ./ · --',
    hints: [
      'O shell separa as palavras pelos espaços. Como dizer que "meia flag.txt" é UM nome só?',
      'Use aspas: cat "meia flag.txt". No outro arquivo, o nome começa com - e parece uma opção…',
      'Indique o caminho: cat ./-outra-metade   (ou cat -- -outra-metade). Depois, junte as duas partes.',
    ],
  },
  {
    id: 4, title: 'O Labirinto', points: 15, skill: 'find -name',
    hints: [
      'Abrir sala por sala levaria muito tempo. Existe um comando para PROCURAR arquivos.',
      'O find procura pelo nome: find CAMINHO -name "PADRÃO"',
      'Dentro de nivel4, rode: find labirinto -name "chave.flag"  e depois cat no caminho encontrado.',
    ],
  },
  {
    id: 5, title: 'Agulha no Palheiro', points: 15, skill: 'grep',
    hints: [
      'O arquivo tem 10.000 linhas (confira com wc -l palheiro.txt). Ler tudo com cat não ajuda.',
      'O grep mostra só as linhas que contêm um texto. Todas as flags começam com FLAG…',
      'Rode: grep "FLAG" palheiro.txt   (maiúsculas e minúsculas fazem diferença!)',
    ],
  },
  {
    id: 6, title: 'Porta Trancada', points: 20, skill: 'ls -l · chmod',
    hints: [
      '"Permissão negada"? Veja as permissões do arquivo com ls -l.',
      'O arquivo é SEU (veja a coluna do dono), e o dono pode mudar as permissões com chmod.',
      'Rode: chmod u+r cofre.txt   (ou chmod 644 cofre.txt) e depois cat cofre.txt',
    ],
  },
  {
    id: 7, title: 'O Único', points: 20, skill: 'sort | uniq -u',
    hints: [
      'Quase todas as linhas se repetem. Você precisa da que aparece UMA vez só.',
      'O uniq trata só repetições VIZINHAS. Como deixar as linhas iguais lado a lado?',
      'Combine com um pipe: sort ecos.txt | uniq -u   e envie a resposta como FLAG{...}',
    ],
  },
  {
    id: 8, title: 'A Fechadura', points: 30, skill: 'shell script: for · seq · if',
    hints: [
      'Teste a fechadura: ./fechadura 123. São 1000 códigos possíveis (000 a 999). Automatize!',
      'seq -w 0 999 gera 000, 001, ..., 999. Use um laço: for c in $(seq -w 0 999); do ...; done',
      'Uma linha resolve: for c in $(seq -w 0 999); do ./fechadura $c; done | grep FLAG   (ou complete o modelo.sh)',
    ],
  },
];

const HINT_COST = 0.25; // cada dica usada antes de resolver reduz 25% dos pontos do nível

export function normalizeNick(nick) {
  return String(nick || '').trim().toLowerCase();
}

export function seedFor(nick) {
  return sha256('pinguimcorp:' + normalizeNick(nick));
}

export function tagFor(seed, level) {
  return sha256(seed + ':' + level).slice(0, 4);
}

export function flagBody(nick, level) {
  return BASES[level] + '_' + tagFor(seedFor(nick), level);
}

export function flagsFor(nick) {
  const flags = {};
  for (const l of LEVELS) flags[l.id] = 'FLAG{' + flagBody(nick, l.id) + '}';
  return flags;
}

export function codeFor(nick) {
  const n = parseInt(sha256(seedFor(nick) + ':codigo').slice(0, 6), 16) % 1000;
  return String(n).padStart(3, '0');
}

// Normaliza o que o aluno digitou: aceita com ou sem FLAG{ }.
export function normalizeFlag(text) {
  let t = String(text || '').trim();
  t = t.replace(/^["']|["']$/g, '');
  const m = /^flag\{(.*)\}$/i.exec(t);
  return 'FLAG{' + (m ? m[1] : t) + '}';
}

export class CtfGame {
  constructor(nick, state, onChange) {
    this.nick = nick;
    this.flags = flagsFor(nick);
    this.state = Object.assign({ solved: {}, hints: {} }, state || {});
    this.onChange = onChange || (() => {});
  }

  level(id) { return LEVELS.find((l) => l.id === id); }

  isSolved(id) { return !!this.state.solved[id]; }

  hintsUsed(id) { return this.state.hints[id] || 0; }

  // Dicas já liberadas do nível (para navegar entre elas sem gastar pontos)
  unlockedHints(id) {
    const l = this.level(id);
    return l ? l.hints.slice(0, Math.min(this.hintsUsed(id), l.hints.length)) : [];
  }

  // A próxima dica custa pontos? (dicas liberadas depois de resolver o nível são grátis)
  nextHintFree(id) { return this.isSolved(id); }

  levelScore(id) {
    if (!this.isSolved(id)) return 0;
    const l = this.level(id);
    const used = this.state.solved[id].hints || 0;
    return Math.round(l.points * Math.max(0.25, 1 - HINT_COST * used));
  }

  score() { return LEVELS.reduce((acc, l) => acc + this.levelScore(l.id), 0); }

  maxScore() { return LEVELS.reduce((acc, l) => acc + l.points, 0); }

  solvedCount() { return LEVELS.filter((l) => this.isSolved(l.id)).length; }

  allSolved() { return this.solvedCount() === LEVELS.length; }

  completionCode() {
    return 'PINGUIM-' + sha256(seedFor(this.nick) + ':fim').slice(0, 8).toUpperCase();
  }

  // Retorna { ok, level, already, message }
  submit(text) {
    if (!String(text || '').trim()) return { ok: false, message: 'Uso: enviar FLAG{...}' };
    const flag = normalizeFlag(text);
    for (const l of LEVELS) {
      if (this.flags[l.id] === flag) {
        if (this.isSolved(l.id)) return { ok: true, level: l.id, already: true, message: 'Você já tinha enviado a flag do nível ' + l.id + '. 😉' };
        this.state.solved[l.id] = { at: Date.now(), hints: this.hintsUsed(l.id) };
        this.onChange(this);
        return { ok: true, level: l.id, already: false, message: 'Flag do nível ' + l.id + ' (' + l.title + ') correta! +' + this.levelScore(l.id) + ' pontos' };
      }
    }
    if (/^FLAG\{[a-z_]+_[0-9a-f]{4}\}$/.test(flag)) {
      return { ok: false, message: 'Essa flag parece ser de outro codinome. Cada aluno tem flags próprias: procure as suas! 🙂' };
    }
    return { ok: false, message: 'Flag incorreta. Confira se copiou tudo (letras, _ e as chaves { }).' };
  }

  // Revela a próxima dica do nível. Retorna { text, index, total, free } ou { error }.
  hint(id) {
    const l = this.level(id);
    if (!l) return { error: 'Nível inválido. Use: dica 1 a dica ' + LEVELS.length };
    const used = this.hintsUsed(id);
    const solved = this.isSolved(id);
    if (used >= l.hints.length) return { text: l.hints[l.hints.length - 1], index: l.hints.length, total: l.hints.length, repeat: true, free: solved };
    this.state.hints[id] = used + 1;
    this.onChange(this);
    return { text: l.hints[used], index: used + 1, total: l.hints.length, free: solved };
  }

  // Registra os comandos do jogo no shell.
  install(shell) {
    const game = this;
    const enviar = (ctx) => {
      const r = game.submit(ctx.args.join(' '));
      if (r.ok && !r.already) {
        ctx.out(C.bgreen + '✔ ' + r.message + C.reset + '\n');
        ctx.out('Pontuação: ' + game.score() + '/' + game.maxScore() + ' · níveis: ' + game.solvedCount() + '/' + LEVELS.length + '\n');
        if (game.allSolved()) {
          ctx.out('\n' + C.byellow + '🏆 Parabéns! Você concluiu todos os níveis!' + C.reset + '\n');
          ctx.out('Código de conclusão: ' + C.bold + game.completionCode() + C.reset + '  (mostre ao professor)\n');
        }
        return 0;
      }
      if (r.ok) { ctx.out(C.yellow + r.message + C.reset + '\n'); return 0; }
      ctx.err(C.red + '✘ ' + r.message + C.reset + '\n');
      return 1;
    };
    enviar.help = 'enviar - envia uma flag encontrada\nUSO: enviar FLAG{...}';
    shell.commands.enviar = enviar;
    shell.commands.submit = enviar;

    const dica = (ctx) => {
      const id = parseInt(ctx.args[0], 10);
      if (!id) { ctx.err('Uso: dica NÍVEL   (exemplo: dica 2)\n'); return 1; }
      const h = game.hint(id);
      if (h.error) { ctx.err(h.error + '\n'); return 1; }
      // mostra todas as dicas já liberadas, marcando a nova
      game.unlockedHints(id).forEach((text, i) => {
        const isNew = !h.repeat && i === h.index - 1;
        const tag = isNew ? (h.free ? C.gray + ' (nova, grátis: nível resolvido)' : C.gray + ' (nova: custa ' + HINT_COST * 100 + '% dos pontos do nível)') + C.reset : '';
        ctx.out((isNew ? C.byellow : C.yellow) + 'Dica ' + (i + 1) + '/' + h.total + ' do nível ' + id + ':' + C.reset + tag + '\n  ' + text + '\n');
      });
      if (h.repeat) ctx.out(C.gray + 'Você já liberou todas as dicas deste nível.' + C.reset + '\n');
      else if (h.index < h.total) ctx.out(C.gray + 'Rode "dica ' + id + '" de novo para a próxima.' + C.reset + '\n');
      return 0;
    };
    dica.help = 'dica - libera a próxima dica de um nível e mostra as já liberadas\nUSO: dica NÍVEL';
    shell.commands.dica = dica;

    const progresso = (ctx) => {
      ctx.out(C.bold + 'Agente ' + game.nick + ' · ' + game.score() + '/' + game.maxScore() + ' pontos' + C.reset + '\n');
      for (const l of LEVELS) {
        const mark = game.isSolved(l.id) ? C.bgreen + '✔' + C.reset : C.gray + '·' + C.reset;
        const pts = game.isSolved(l.id) ? game.levelScore(l.id) + '/' + l.points : '0/' + l.points;
        ctx.out(' ' + mark + ' Nível ' + l.id + ' — ' + l.title.padEnd(18) + ' ' + pts.padStart(5) + ' pts   ' + C.gray + l.skill + C.reset + '\n');
      }
      if (game.allSolved()) ctx.out('Código de conclusão: ' + game.completionCode() + '\n');
      return 0;
    };
    progresso.help = 'progresso - mostra seus níveis concluídos e a pontuação';
    shell.commands.progresso = progresso;

    // "Binário" da fechadura do nível 8
    const code = codeFor(this.nick);
    const flag8 = this.flags[8];
    shell.binaries.fechadura = (ctx) => {
      const c = ctx.args[0];
      if (c === undefined) { ctx.err('Uso: ./fechadura CÓDIGO   (código de 3 dígitos, ex.: 042)\n'); return 2; }
      if (!/^\d{3}$/.test(c)) { ctx.err('O código deve ter exatamente 3 dígitos (ex.: 007).\n'); return 2; }
      if (c !== code) { ctx.out('🔒 Código ' + c + ' incorreto.\n'); return 1; }
      ctx.out('🔓 Código ' + c + ' correto! A fechadura abriu.\n' + flag8 + '\n');
      return 0;
    };

    shell.extraHelp = (ctx) => {
      const y = (s) => (ctx.isTTY ? C.byellow + s + C.reset : s);
      return y('Comandos do CTF:') + '  enviar FLAG{...}  ·  dica NÍVEL  ·  progresso  ·  cat ~/ctf/LEIA-ME.txt';
    };
  }
}
