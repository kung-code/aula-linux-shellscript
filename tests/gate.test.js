import assert from 'assert';
import fs from 'fs';
import { test } from './harness.js';
import { ACCESS_HASH, checkAccess, isUnlocked, normalizeAccess, accessHash } from '../docs/ctf/js/gate.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');

// A senha fica só no slide do CTF; o teste a lê de lá (para não repeti-la em outro arquivo).
function slidePassword() {
  const m = /data-password="([^"]+)"/.exec(read('docs/slides/index.html'));
  assert.ok(m, 'slide do CTF sem data-password');
  return m[1];
}

test('senha do slide abre o CTF; outras não', () => {
  const pw = slidePassword();
  assert.ok(checkAccess(pw));
  assert.ok(checkAccess('  ' + pw.toLowerCase() + ' '), 'deve aceitar minúsculas e espaços');
  assert.ok(!checkAccess(''));
  assert.ok(!checkAccess('LINUX'));
  assert.ok(!checkAccess(pw + 'X'));
  assert.strictEqual(normalizeAccess(' ' + pw.toLowerCase().split('').join(' ') + ' '), pw.toUpperCase());
});

test('desbloqueio salvo só vale para a senha atual', () => {
  assert.ok(isUnlocked(ACCESS_HASH));
  assert.ok(!isUnlocked(null));
  assert.ok(!isUnlocked('1'));
  assert.ok(!isUnlocked(accessHash('OUTRA')));
});

test('a senha aparece só no slide do CTF (nunca em texto puro no site ou no código)', () => {
  const pw = slidePassword();
  const files = [];
  const walk = (dir) => {
    for (const f of fs.readdirSync(new URL('../' + dir, import.meta.url))) {
      const p = dir + '/' + f;
      if (fs.statSync(new URL('../' + p, import.meta.url)).isDirectory()) walk(p);
      else if (/\.(html|js|css|md|json)$/.test(f)) files.push(p);
    }
  };
  walk('docs');
  walk('tools');
  walk('planejamento');
  files.push('README.md');
  const found = files.filter((p) => read(p).toUpperCase().includes(pw.toUpperCase()) && p !== 'docs/slides/index.html');
  assert.deepStrictEqual(found, []);
  // e no slide aparece uma única vez
  assert.strictEqual(read('docs/slides/index.html').split(pw).length - 1, 1);
});

test('página do CTF pede a senha antes do codinome', () => {
  const html = read('docs/ctf/index.html');
  assert.ok(html.indexOf('id="gate"') >= 0 && html.indexOf('id="gate"') < html.indexOf('id="start"'));
  assert.ok(/id="gate-input"[^>]*type="password"/.test(html));
  assert.ok(/id="start"[^>]*hidden/.test(html), 'tela do codinome deve começar escondida');
});
