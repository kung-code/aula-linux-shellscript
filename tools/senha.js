// Troca a senha de acesso do CTF.
// Uso: node tools/senha.js NOVA_SENHA
// Atualiza o hash em docs/ctf/js/gate.js, a senha mostrada no slide do CTF e gera os bundles de novo.

import fs from 'fs';
import path from 'path';
import { accessHash, normalizeAccess } from '../docs/ctf/js/gate.js';
import { buildAll } from './build.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const nova = normalizeAccess(process.argv[2]);
if (!nova) {
  console.error('Uso: node tools/senha.js NOVA_SENHA');
  process.exit(1);
}

const gate = path.join(ROOT, 'docs/ctf/js/gate.js');
fs.writeFileSync(gate, fs.readFileSync(gate, 'utf8').replace(/ACCESS_HASH = '[0-9a-f]{64}'/, "ACCESS_HASH = '" + accessHash(nova) + "'"));

const slides = path.join(ROOT, 'docs/slides/index.html');
const html = fs.readFileSync(slides, 'utf8');
const updated = html.replace(/(data-password=")[^"]*(")/, '$1' + nova + '$2');
if (updated === html && !html.includes('data-password="' + nova + '"')) {
  console.error('Não encontrei data-password="..." no slide do CTF.');
  process.exit(1);
}
fs.writeFileSync(slides, updated);
buildAll();
console.log('Senha do CTF trocada para: ' + nova);
