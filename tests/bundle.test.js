import assert from 'assert';
import fs from 'fs';
import vm from 'vm';
import { test } from './harness.js';
import { bundle, BUNDLES } from '../tools/build.js';

// Regressão: abrir o index.html direto do disco (file://) não carregava módulos ES.
// As páginas agora usam um script clássico gerado; ele precisa existir e estar atualizado.
test('páginas usam o script empacotado (funciona via file://), não type="module"', () => {
  for (const page of ['docs/ctf/index.html', 'docs/slides/index.html']) {
    const html = fs.readFileSync(new URL('../' + page, import.meta.url), 'utf8');
    assert.ok(!/type="module"/.test(html), page + ' ainda usa type="module"');
    assert.ok(/\.bundle\.js/.test(html), page + ' não carrega o bundle');
  }
});

test('bundles estão atualizados (rode: node tools/build.js)', () => {
  for (const b of BUNDLES) {
    const current = fs.readFileSync(new URL('../' + b.out, import.meta.url), 'utf8');
    assert.ok(current === bundle(b.entry), b.out + ' está desatualizado: rode "node tools/build.js"');
    assert.ok(!/^(export\s+(\{|\*|default|function|class|const|let|var|async)|import\s.+\sfrom\s|import\s+')/m.test(current), b.out + ' contém import/export');
  }
});

test('bundle do CTF executa num navegador simulado e monta o jogo', () => {
  const code = fs.readFileSync(new URL('../docs/ctf/js/ctf.bundle.js', import.meta.url), 'utf8');
  // DOM mínimo: só o necessário para a tela inicial (sem codinome salvo)
  const listeners = {};
  const fakeEl = () => ({
    hidden: false, value: '', textContent: '', innerHTML: '', style: {}, classList: { add() {}, remove() {}, toggle() {} },
    addEventListener(t, fn) { listeners[t] = fn; }, focus() {}, append() {}, querySelector: () => fakeEl(), querySelectorAll: () => [],
    setAttribute() {},
  });
  const els = {};
  const sandbox = {
    document: {
      querySelector: (sel) => (els[sel] = els[sel] || fakeEl()),
      querySelectorAll: () => [],
      createElement: fakeEl,
      addEventListener() {},
    },
    window: { addEventListener() {} },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    setTimeout, clearTimeout, console, Intl, Math, Date, JSON,
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  assert.ok(listeners.submit, 'tela inicial não registrou o formulário de codinome');
});
