// Empacota os módulos ES (import/export) num único script clássico.
// Motivo: navegadores bloqueiam <script type="module"> ao abrir o HTML direto do disco (file://).
// Uso: node tools/build.js        (sem dependências; funciona no Node 12+)

import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');

export const BUNDLES = [
  { entry: 'docs/ctf/js/main.js', out: 'docs/ctf/js/ctf.bundle.js' },
  { entry: 'docs/slides/slides.js', out: 'docs/slides/slides.bundle.js' },
  { entry: 'docs/terminal/js/lab.js', out: 'docs/terminal/js/lab.bundle.js' },
];

const IMPORT_RE = /^import\s+(?:\{([^}]*)\}\s+from\s+)?'([^']+)';?[ \t]*$/gm;

function rel(file) {
  return path.relative(ROOT, file).split(path.sep).join('/');
}

function transform(code, file, idOf) {
  const exportsList = [];
  let out = code.replace(IMPORT_RE, (m, names, spec) => {
    const dep = idOf(path.resolve(path.dirname(file), spec));
    if (!names) return '';
    const binds = names.split(',').map((s) => s.trim()).filter(Boolean)
      .map((s) => { const [a, b] = s.split(/\s+as\s+/); return b ? a + ': ' + b : a; });
    return 'const { ' + binds.join(', ') + ' } = __m[' + JSON.stringify(dep) + '];';
  });
  out = out.replace(/^export\s+(async\s+function|function|class|const|let)\s+([A-Za-z_$][\w$]*)/gm, (m, kw, name) => {
    exportsList.push(name);
    return kw + ' ' + name;
  });
  out = out.replace(/^export\s*\{([^}]*)\};?[ \t]*$/gm, (m, names) => {
    for (const n of names.split(',').map((s) => s.trim()).filter(Boolean)) {
      const [a, b] = n.split(/\s+as\s+/);
      exportsList.push(b ? b + ': ' + a : a);
    }
    return '';
  });
  if (/^(import\s.+\sfrom\s|import\s+'|export\s+(\{|\*|default|function|class|const|let|var|async))/m.test(out)) throw new Error('import/export não suportado pelo empacotador em ' + rel(file));
  return { code: out, exportsList };
}

export function bundle(entry) {
  const order = [];
  const seen = new Set();
  const visit = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const code = fs.readFileSync(file, 'utf8');
    let m;
    IMPORT_RE.lastIndex = 0;
    const deps = [];
    while ((m = IMPORT_RE.exec(code))) deps.push(path.resolve(path.dirname(file), m[2]));
    for (const d of deps) visit(d);
    order.push({ file, code });
  };
  visit(path.resolve(ROOT, entry));
  const parts = order.map(({ file, code }) => {
    const id = rel(file);
    const t = transform(code, file, rel);
    return '// ---- ' + id + ' ----\n__m[' + JSON.stringify(id) + '] = (function () {\n' + t.code + '\nreturn { ' + t.exportsList.join(', ') + ' };\n})();\n';
  });
  return '// Arquivo gerado por tools/build.js a partir de ' + entry + ' — NÃO edite à mão.\n' +
    '(function () {\n\'use strict\';\nconst __m = {};\n' + parts.join('\n') + '})();\n';
}

export function buildAll({ write = true } = {}) {
  const results = [];
  for (const b of BUNDLES) {
    const code = bundle(b.entry);
    const outFile = path.resolve(ROOT, b.out);
    const current = fs.existsSync(outFile) ? fs.readFileSync(outFile, 'utf8').replace(/\r\n/g, '\n') : null;
    const upToDate = current === code.replace(/\r\n/g, '\n');
    if (write && !upToDate) fs.writeFileSync(outFile, code);
    results.push({ out: b.out, upToDate, size: code.length });
  }
  return results;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(ROOT, 'tools/build.js')) {
  for (const r of buildAll()) console.log((r.upToDate ? '= ' : '✔ ') + r.out + ' (' + Math.round(r.size / 1024) + ' KB)');
}
