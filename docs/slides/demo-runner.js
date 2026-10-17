// Executa os exemplos dos slides num shell simulado, gerando a saída REAL de cada comando.
// Usado pelos slides (no navegador) e pelos testes (no Node).

import { splitCommands } from './deck.js';

export function makeDemoIo({ columns = 72 } = {}) {
  let buf = '';
  let queue = [];
  return {
    columns,
    write(s) { buf += s; },
    writeErr(s) { buf += s; },
    // "read": usa a resposta pré-definida no slide e a ecoa como se tivesse sido digitada
    readLine: async (prompt) => {
      const answer = queue.length ? queue.shift() : '';
      buf += (prompt || '') + answer + '\n';
      return answer;
    },
    edit: async () => {},
    clear() {},
    take() { const b = buf; buf = ''; return b; },
    setInputs(list) { queue = list.slice(); },
  };
}

// specs: [{ kind: 'cmds' | 'script' | 'file', text, name, input }]
// Retorna um resultado por spec:
//   cmds   → { steps: [{ prompt, cmd, out }], promptAfter }
//   script → { prompt, cmd, out, promptAfter }
//   file   → {}
export async function runDemos(specs, shell, io) {
  const results = [];
  for (const spec of specs) {
    io.setInputs(spec.input ? spec.input.split('|') : []);
    if (spec.kind === 'file') {
      shell.vfs.writeFile(shell.resolve(spec.name), spec.text.replace(/\n*$/, '\n'));
      results.push({});
      continue;
    }
    if (spec.kind === 'script') {
      shell.vfs.writeFile(shell.resolve(spec.name), spec.text.replace(/\n*$/, '\n'));
      const prompt = shell.prompt();
      const cmd = 'bash ' + spec.name;
      io.take();
      await shell.run(cmd);
      results.push({ prompt, cmd, out: io.take(), promptAfter: shell.prompt() });
      continue;
    }
    const steps = [];
    for (const cmd of splitCommands(spec.text)) {
      const prompt = shell.prompt();
      io.take();
      await shell.run(cmd);
      steps.push({ prompt, cmd, out: io.take() });
    }
    results.push({ steps, promptAfter: shell.prompt() });
  }
  return results;
}
