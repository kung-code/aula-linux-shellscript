// Lógica pura dos visuais da página de preparação (testada em tests/preparacao.test.js).

import { tokenize } from '../../docs/ctf/js/shell/parser.js';

// Como o shell separa uma linha em palavras (usa o parser de verdade do simulador).
export function splitWords(line) {
  return tokenize(line)
    .filter((t) => t.t === 'word')
    .map((t) => t.segs.map((s) => (s.type === 'lit' ? s.text : '$' + s.name)).join(''));
}

// Passo a passo de como o shell encontra o programa de um comando.
// exists(caminho) → true se o arquivo existe. Retorna [{ dir, path, found }] e o resultado final.
export function resolveSteps(cmd, pathDirs, exists, cwd) {
  if (cmd.includes('/')) {
    const full = cmd.startsWith('/') ? cmd : (cwd.replace(/\/$/, '') + '/' + cmd.replace(/^\.\//, ''));
    const found = exists(full);
    return { direct: true, steps: [{ dir: cmd.startsWith('./') ? '. (pasta atual)' : '', path: full, found }], result: found ? full : null };
  }
  const steps = [];
  for (const dir of pathDirs) {
    const full = dir.replace(/\/$/, '') + '/' + cmd;
    const found = exists(full);
    steps.push({ dir, path: full, found });
    if (found) return { direct: false, steps, result: full };
  }
  return { direct: false, steps, result: null };
}

// Para onde vão a saída (stdout) e os erros (stderr) em cada cenário do diagrama.
export const STREAM_SCENARIOS = {
  padrao: { cmd: 'ls /etc /nao_existe', stdout: 'tela', stderr: 'tela', note: 'Sem redirecionamento, a saída e os erros vão para a tela.' },
  arquivo: { cmd: 'ls /etc /nao_existe > lista.txt', stdout: 'arquivo lista.txt', stderr: 'tela', note: 'O > desvia só a saída. O erro continua aparecendo na tela.' },
  erros: { cmd: 'ls /etc /nao_existe 2> erros.txt', stdout: 'tela', stderr: 'arquivo erros.txt', note: 'O 2> desvia só os erros (o canal 2).' },
  pipe: { cmd: 'ls /etc | wc -l', stdout: 'programa wc', stderr: 'tela', note: 'O | entrega a saída de um programa como entrada do próximo.' },
};

export function streamRoute(name) {
  const s = STREAM_SCENARIOS[name];
  if (!s) throw new Error('cenário desconhecido: ' + name);
  return s;
}
