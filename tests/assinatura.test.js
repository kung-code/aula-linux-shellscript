import assert from 'assert';
import fs from 'fs';
import { test } from './harness.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const PAGES = ['docs/index.html', 'docs/slides/index.html', 'docs/ctf/index.html', 'docs/terminal/index.html', 'docs/cola/index.html'];

test('assinatura Kung-Code: símbolo Ensō definido e usado em cada página', () => {
  for (const p of PAGES) {
    const s = read(p);
    assert.ok(s.includes('<symbol id="kc-enso"'), p + ' sem o símbolo');
    assert.ok(s.includes('id="kc-enso-g"'), p + ' sem o degradê do símbolo');
    assert.ok(/<use href="#kc-enso"\/>/.test(s), p + ' não usa o símbolo');
    assert.ok(/Kung-Code|KUNG-CODE/.test(s), p + ' sem o nome da marca');
    assert.ok(/<link rel="icon" href="data:image\/svg\+xml,[^"]*M71 21A34 34/.test(s), p + ' sem o ícone Ensō na aba');
  }
});

test('assinatura usa a paleta atual do curso (não a paleta nova da marca)', () => {
  for (const p of PAGES) {
    const s = read(p).toLowerCase();
    const sym = /<symbol id="kc-enso"[\s\S]*?<\/symbol>/.exec(s)[0] + /<lineargradient id="kc-enso-g"[\s\S]*?<\/lineargradient>/.exec(s)[0];
    assert.ok(sym.includes('#ffcc33') && sym.includes('#4fd1c5') && sym.includes('#151f38'), p + ': símbolo fora da paleta atual');
    for (const novo of ['#004d40', '#00796b', '#fbc02d']) assert.ok(!s.includes(novo), p + ' usa cor da paleta nova: ' + novo);
  }
});
