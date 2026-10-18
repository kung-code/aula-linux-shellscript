// CTF "Missão Servidor Pinguim": flags, dicas, pontuação e comandos do jogo.
// Cada aula tem o seu conjunto de níveis (LEVEL_SETS), escolhido por docs/aula.js.

import { sha256, C } from '../shell/util.js';
import { AULA } from '../../../aula.js';

// Textos-base das flags, invertidos para não aparecerem "de bandeja" no código-fonte.
const rev = (s) => s.split('').reverse().join('');
const BASES = {
  boasvindas: rev('lanimret_oa_odniv_meb'),
  oculto: rev('emos_ednocse_es_euq_odut_men'),
  nomes: rev('sadiv_mavlas_sarrab_e_sapsa'),
  tesouro: rev('oruoset_oa_mavel_sohnimac'),
  inicio: rev('ocemoc_o_artsom_daeh'),
  mudanca: rev('sodanimod_mr_e_pc_ridkm'),
  labirinto: rev('ahluga_eta_artnocne_dnif'),
  palheiro: rev('ogima_rohlem_uem_e_perg'),
  canal: rev('oirporp_lanac_met_rredts'),
  permissao: rev('satrop_erba_domhc'),
  unico: rev('odut_matcenoc_sepip'),
  fechadura: rev('aferat_ariemirp_ahnim_iezitamotua'),
};

const L = {
  boasvindas: {
    title: 'Boas-vindas', points: 10, skill: 'cd · ls · cat',
    hints: [
      'O arquivo LEIA-ME.txt fica dentro do diretório ctf, na sua home.',
      'Para ver o conteúdo de um arquivo, use o comando cat.',
      'Digite: cat ~/ctf/LEIA-ME.txt',
    ],
  },
  oculto: {
    title: 'O Invisível', points: 10, skill: 'ls -a (arquivos ocultos)',
    hints: [
      'No Linux, arquivos cujo nome começa com "." ficam escondidos do ls comum.',
      'Consulte o manual: man ls — procure a opção que mostra todos ("all").',
      'Entre no diretório do nível e use: ls -a   (depois, cat no arquivo que começa com ponto)',
    ],
  },
  nomes: {
    title: 'Nome Traiçoeiro', points: 15, skill: 'aspas · ./ · --',
    hints: [
      'O shell separa as palavras pelos espaços. Como dizer que "meia flag.txt" é UM nome só?',
      'Use aspas: cat "meia flag.txt". No outro arquivo, o nome começa com - e parece uma opção…',
      'Indique o caminho: cat ./-outra-metade   (ou cat -- -outra-metade). Depois, junte as duas partes.',
    ],
  },
  tesouro: {
    title: 'Caça ao Tesouro', points: 15, skill: 'cd · .. · caminhos',
    hints: [
      'Em cada pasta existe um pista.txt: leia com cat e faça o que ele pede.',
      'cd .. sobe um nível, cd ../.. sobe dois. Um caminho que começa com / é absoluto e funciona de qualquer lugar.',
      'Perdido? pwd mostra onde você está. Recomece com: cd ~/ctf/nivel4/inicio e cat pista.txt',
    ],
  },
  inicio: {
    title: 'O Começo de Tudo', points: 15, skill: 'head · tail · less',
    hints: [
      'O arquivo é enorme: o cat mostra tudo, mas a tela só guarda o final. O que você precisa está no começo.',
      'Existe um comando para mostrar só as primeiras linhas de um arquivo.',
      'Rode: head -n 5 historico.log',
    ],
  },
  contagem: {
    title: 'Contagem', points: 20, skill: 'wc -l',
    hints: [
      'A resposta é um número: quantas linhas tem o arquivo registros.txt.',
      'O comando wc conta linhas, palavras e bytes. A opção -l conta só as linhas.',
      'Rode: wc -l registros.txt   e monte a flag como a missão explica.',
    ],
  },
  mudanca: {
    title: 'Organizando a Casa', points: 25, skill: 'mkdir · cp · rm',
    hints: [
      'Leia a missão com atenção: são três tarefas. Depois de cada uma, rode ./conferir para ver o que falta.',
      'mkdir cria a pasta; cp ORIGEM DESTINO copia (e pode dar outro nome); rm apaga um arquivo.',
      'mkdir entrega · cp rascunhos/relatorio_v3.txt entrega/relatorio_final.txt · rm rascunhos/lixo.tmp · ./conferir',
    ],
  },
  labirinto: {
    title: 'O Labirinto', points: 15, skill: 'find -name',
    hints: [
      'Abrir sala por sala levaria muito tempo. Existe um comando para PROCURAR arquivos.',
      'O find procura pelo nome: find CAMINHO -name "PADRÃO"',
      'Dentro do diretório do nível, rode: find labirinto -name "chave.flag"  e depois cat no caminho encontrado.',
    ],
  },
  palheiro: {
    title: 'Agulha no Palheiro', points: 15, skill: 'grep',
    hints: [
      'O arquivo tem 10.000 linhas (confira com wc -l palheiro.txt). Ler tudo com cat não ajuda.',
      'O grep mostra só as linhas que contêm um texto. Todas as flags começam com FLAG…',
      'Rode: grep "FLAG" palheiro.txt   (maiúsculas e minúsculas fazem diferença!)',
    ],
  },
  canal: {
    title: 'Canal Errado', points: 20, skill: 'stderr · 2> · 2>&1',
    hints: [
      'O transmissor escreve milhares de linhas. Tente ./transmissor | grep FLAG e repare: muitas linhas passam direto pelo grep.',
      'Essas linhas vêm do canal de erros (stderr), que não entra no pipe. A flag está nesse canal.',
      'Mande os erros para o pipe: ./transmissor 2>&1 | grep FLAG   (ou: ./transmissor 2> erros.txt e depois grep FLAG erros.txt)',
    ],
  },
  permissao: {
    title: 'Porta Trancada', points: 20, skill: 'ls -l · chmod',
    hints: [
      '"Permissão negada"? Veja as permissões do arquivo com ls -l.',
      'O arquivo é SEU (veja a coluna do dono), e o dono pode mudar as permissões com chmod.',
      'Rode: chmod u+r cofre.txt   (ou chmod 644 cofre.txt) e depois cat cofre.txt',
    ],
  },
  unico: {
    title: 'O Único', points: 20, skill: 'sort | uniq -u',
    hints: [
      'Quase todas as linhas se repetem. Você precisa da que aparece UMA vez só.',
      'O uniq trata só repetições VIZINHAS. Como deixar as linhas iguais lado a lado?',
      'Combine com um pipe: sort ecos.txt | uniq -u   e envie a resposta como FLAG{...}',
    ],
  },
  fechadura: {
    title: 'A Fechadura', points: 30, skill: 'shell script: for · seq · if',
    hints: [
      'Teste a fechadura: ./fechadura 123. São 1000 códigos possíveis (000 a 999). Automatize!',
      'seq -w 0 999 gera 000, 001, ..., 999. Use um laço: for c in $(seq -w 0 999); do ...; done',
      'Uma linha resolve: for c in $(seq -w 0 999); do ./fechadura $c; done | grep FLAG   (ou complete o modelo.sh)',
    ],
  },
};

// Níveis de cada aula, na ordem. O diretório de cada um é ~/ctf/nivelN.
const SETS = {
  1: ['boasvindas', 'oculto', 'nomes', 'tesouro', 'inicio', 'contagem', 'mudanca'],
  2: ['boasvindas', 'labirinto', 'palheiro', 'canal', 'permissao', 'unico', 'fechadura'],
};

export function levelsFor(aula) {
  const keys = SETS[aula];
  if (!keys) throw new Error('aula sem CTF: ' + aula);
  return keys.map((key, i) => Object.assign({ id: i + 1, key }, L[key]));
}

export const LEVELS = levelsFor(AULA);

const HINT_COST = 0.25; // cada dica usada antes de resolver reduz 25% dos pontos do nível

export function normalizeNick(nick) {
  return String(nick || '').trim().toLowerCase();
}

export function seedFor(nick, aula = AULA) {
  return sha256('pinguimcorp:aula' + aula + ':' + normalizeNick(nick));
}

export function tagFor(seed, key) {
  return sha256(seed + ':' + key).slice(0, 4);
}

// Quantas linhas tem o arquivo do nível "Contagem" (varia por codinome)
export function countFor(nick, aula = AULA) {
  return 300 + (parseInt(sha256(seedFor(nick, aula) + ':contagem').slice(0, 6), 16) % 600);
}

export function flagBody(nick, key, aula = AULA) {
  const seed = seedFor(nick, aula);
  if (key === 'contagem') return 'contei_' + countFor(nick, aula) + '_linhas_' + tagFor(seed, key);
  return BASES[key] + '_' + tagFor(seed, key);
}

// { idDoNível: 'FLAG{...}' }
export function flagsFor(nick, aula = AULA) {
  const flags = {};
  for (const l of levelsFor(aula)) flags[l.id] = 'FLAG{' + flagBody(nick, l.key, aula) + '}';
  return flags;
}

export function codeFor(nick, aula = AULA) {
  const n = parseInt(sha256(seedFor(nick, aula) + ':codigo').slice(0, 6), 16) % 1000;
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
  constructor(nick, state, onChange, aula = AULA) {
    this.nick = nick;
    this.aula = aula;
    this.levels = levelsFor(aula);
    this.flags = flagsFor(nick, aula);
    this.state = Object.assign({ solved: {}, hints: {} }, state || {});
    this.onChange = onChange || (() => {});
  }

  level(id) { return this.levels.find((l) => l.id === id); }

  levelByKey(key) { return this.levels.find((l) => l.key === key); }

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

  score() { return this.levels.reduce((acc, l) => acc + this.levelScore(l.id), 0); }

  maxScore() { return this.levels.reduce((acc, l) => acc + l.points, 0); }

  solvedCount() { return this.levels.filter((l) => this.isSolved(l.id)).length; }

  allSolved() { return this.solvedCount() === this.levels.length; }

  completionCode() {
    return 'PINGUIM' + this.aula + '-' + sha256(seedFor(this.nick, this.aula) + ':fim').slice(0, 8).toUpperCase();
  }

  // Retorna { ok, level, already, message }
  submit(text) {
    if (!String(text || '').trim()) return { ok: false, message: 'Uso: enviar FLAG{...}' };
    const flag = normalizeFlag(text);
    for (const l of this.levels) {
      if (this.flags[l.id] === flag) {
        if (this.isSolved(l.id)) return { ok: true, level: l.id, already: true, message: 'Você já tinha enviado a flag do nível ' + l.id + '.' };
        this.state.solved[l.id] = { at: Date.now(), hints: this.hintsUsed(l.id) };
        this.onChange(this);
        return { ok: true, level: l.id, already: false, message: 'Flag do nível ' + l.id + ' (' + l.title + ') correta! +' + this.levelScore(l.id) + ' pontos' };
      }
    }
    if (/^FLAG\{[a-z0-9_]+_[0-9a-f]{4}\}$/.test(flag)) {
      return { ok: false, message: 'Essa flag parece ser de outro codinome (ou de outra aula). Cada aluno tem flags próprias: procure as suas!' };
    }
    return { ok: false, message: 'Flag incorreta. Confira se copiou tudo (letras, números, _ e as chaves { }).' };
  }

  // Revela a próxima dica do nível. Retorna { text, index, total, free } ou { error }.
  hint(id) {
    const l = this.level(id);
    if (!l) return { error: 'Nível inválido. Use: dica 1 a dica ' + this.levels.length };
    const used = this.hintsUsed(id);
    const solved = this.isSolved(id);
    if (used >= l.hints.length) return { text: l.hints[l.hints.length - 1], index: l.hints.length, total: l.hints.length, repeat: true, free: solved };
    this.state.hints[id] = used + 1;
    this.onChange(this);
    return { text: l.hints[used], index: used + 1, total: l.hints.length, free: solved };
  }

  levelDir(shell, key) {
    const l = this.levelByKey(key);
    return l ? shell.home + '/ctf/nivel' + l.id : null;
  }

  // Registra os comandos do jogo no shell.
  install(shell) {
    const game = this;
    const enviar = (ctx) => {
      const r = game.submit(ctx.args.join(' '));
      if (r.ok && !r.already) {
        ctx.out(C.bgreen + '✔ ' + r.message + C.reset + '\n');
        ctx.out('Pontuação: ' + game.score() + '/' + game.maxScore() + ' · níveis: ' + game.solvedCount() + '/' + game.levels.length + '\n');
        if (game.allSolved()) {
          ctx.out('\n' + C.byellow + 'Parabéns! Você concluiu todos os níveis!' + C.reset + '\n');
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
      ctx.out(C.bold + 'Agente ' + game.nick + ' · Aula ' + game.aula + ' · ' + game.score() + '/' + game.maxScore() + ' pontos' + C.reset + '\n');
      for (const l of game.levels) {
        const mark = game.isSolved(l.id) ? C.bgreen + '✔' + C.reset : C.gray + '·' + C.reset;
        const pts = game.isSolved(l.id) ? game.levelScore(l.id) + '/' + l.points : '0/' + l.points;
        ctx.out(' ' + mark + ' Nível ' + l.id + ' — ' + l.title.padEnd(18) + ' ' + pts.padStart(5) + ' pts   ' + C.gray + l.skill + C.reset + '\n');
      }
      if (game.allSolved()) ctx.out('Código de conclusão: ' + game.completionCode() + '\n');
      return 0;
    };
    progresso.help = 'progresso - mostra seus níveis concluídos e a pontuação';
    shell.commands.progresso = progresso;

    // ----- "binários" dos níveis -----
    const code = codeFor(this.nick, this.aula);
    const fechaduraLevel = this.levelByKey('fechadura');
    shell.binaries.fechadura = (ctx) => {
      const c = ctx.args[0];
      if (c === undefined) { ctx.err('Uso: ./fechadura CÓDIGO   (código de 3 dígitos, ex.: 042)\n'); return 2; }
      if (!/^\d{3}$/.test(c)) { ctx.err('O código deve ter exatamente 3 dígitos (ex.: 007).\n'); return 2; }
      if (c !== code) { ctx.out('🔒 Código ' + c + ' incorreto.\n'); return 1; }
      ctx.out('🔓 Código ' + c + ' correto! A fechadura abriu.\n' + (fechaduraLevel ? game.flags[fechaduraLevel.id] : '') + '\n');
      return 0;
    };

    // Nível "Canal Errado": a flag sai pelo stderr, no meio de milhares de linhas
    const canalLevel = this.levelByKey('canal');
    shell.binaries.transmissor = (ctx) => {
      const N = 4000;
      let out = '';
      let err = '';
      for (let i = 1; i <= N; i++) {
        out += '[ok] pacote ' + i + ' recebido\n';
        err += i === 37 && canalLevel ? '[erro] pacote 37 corrompido: ' + game.flags[canalLevel.id] + '\n' : '[erro] pacote ' + i + ' com ruído\n';
      }
      ctx.out(out);
      ctx.err(err);
      return 0;
    };

    // Nível "Organizando a Casa": confere se o aluno criou, copiou e apagou o que a missão pede
    const mudancaLevel = this.levelByKey('mudanca');
    shell.binaries.conferir = (ctx) => {
      const dir = game.levelDir(ctx.shell, 'mudanca');
      if (!dir) { ctx.err('conferir: nada para conferir nesta aula\n'); return 1; }
      const vfs = ctx.vfs;
      const node = (p) => vfs.tryLookup(dir + '/' + p);
      const original = node('rascunhos/relatorio_v3.txt');
      const final = node('entrega/relatorio_final.txt');
      const checks = [
        ['pasta entrega/ criada', !!node('entrega') && node('entrega').type === 'dir'],
        ['entrega/relatorio_final.txt é uma cópia de rascunhos/relatorio_v3.txt', !!final && final.type === 'file' && !!original && final.content === original.content],
        ['o original continua em rascunhos/ (copiar, não mover)', !!original],
        ['rascunhos/lixo.tmp apagado', !node('rascunhos/lixo.tmp')],
      ];
      for (const [label, ok] of checks) ctx.out((ok ? C.bgreen + '  ✔ ' : C.red + '  ✘ ') + label + C.reset + '\n');
      if (checks.every((c) => c[1])) {
        ctx.out(C.byellow + 'Tudo certo! Fragmento liberado: ' + C.reset + game.flags[mudancaLevel.id] + '\n');
        return 0;
      }
      ctx.out(C.gray + 'Ainda falta algo. Corrija os itens com ✘ e rode ./conferir de novo.' + C.reset + '\n');
      return 1;
    };

    shell.extraHelp = (ctx) => {
      const y = (s) => (ctx.isTTY ? C.byellow + s + C.reset : s);
      return y('Comandos do CTF:') + '  enviar FLAG{...}  ·  dica NÍVEL  ·  progresso  ·  cat ~/ctf/LEIA-ME.txt';
    };
  }
}
