import { runAll } from './harness.js';
import './util.test.js';
import './parser.test.js';
import './shell.test.js';
import './commands.test.js';
import './ctf.test.js';
import './deck.test.js';
import './vi.test.js';
import './bundle.test.js';

runAll().then((failed) => { process.exitCode = failed ? 1 : 0; });
