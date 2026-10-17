// Executor de testes mínimo (o Node 12 não tem node:test).
import { buildSystem } from '../docs/ctf/js/shell/system.js';
import { Shell } from '../docs/ctf/js/shell/interpreter.js';
import { commands } from '../docs/ctf/js/shell/commands.js';
import { stripAnsi } from '../docs/ctf/js/shell/util.js';
import { CtfGame } from '../docs/ctf/js/ctf/game.js';
import { buildCtf } from '../docs/ctf/js/ctf/world.js';

const tests = [];
export function test(name, fn) { tests.push({ name, fn }); }

export async function runAll() {
  let failed = 0;
  for (const t of tests) {
    try {
      await t.fn();
      console.log('  ✔ ' + t.name);
    } catch (e) {
      failed++;
      console.log('  ✘ ' + t.name);
      console.log('    ' + String(e && e.stack ? e.stack : e).split('\n').slice(0, 6).join('\n    '));
    }
  }
  console.log('\n' + (tests.length - failed) + '/' + tests.length + ' testes passaram');
  return failed;
}

// Cria um shell com o sistema simulado. Retorna helpers para rodar comandos e capturar a saída.
export function makeShell({ nick = null, inputs = [] } = {}) {
  const vfs = buildSystem();
  let out = '';
  const queue = inputs.slice();
  const io = {
    write(s) { out += s; },
    writeErr(s) { out += s; },
    readLine: async () => (queue.length ? queue.shift() : null),
    edit: async ({ save }) => { if (io.nextEdit !== undefined) save(io.nextEdit); },
    clear() { out = ''; },
    columns: 80,
  };
  const shell = new Shell({ vfs, io, commands });
  let game = null;
  if (nick) {
    buildCtf(vfs, shell.home, nick);
    game = new CtfGame(nick, null);
    game.install(shell);
  }
  return {
    vfs, shell, io, game,
    async run(src) {
      out = '';
      const status = await shell.run(src);
      return { status, out: stripAnsi(out) };
    },
    async out(src) { return (await this.run(src)).out; },
    queue,
  };
}
