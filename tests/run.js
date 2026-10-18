import { runAll } from './harness.js';
import './util.test.js';
import './parser.test.js';
import './shell.test.js';
import './commands.test.js';
import './ctf.test.js';
import './deck.test.js';
import './vi.test.js';
import './ui.test.js';
import './gate.test.js';
import './lab.test.js';
import './preparacao.test.js';
import './assinatura.test.js';
import './aula.test.js';
import './bundle.test.js';

runAll().then((failed) => { process.exitCode = failed ? 1 : 0; });
