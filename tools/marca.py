# Aplica a assinatura Kung-Code (símbolo Ensō na paleta atual) nas páginas do curso.
# Idempotente: só insere o que ainda não existe.
import re, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent

GRAD = ('<linearGradient id="kc-enso-g" x1="0" y1="1" x2="1" y2="0">'
        '<stop offset="0" stop-color="#4fd1c5"/><stop offset=".55" stop-color="#ffcc33"/><stop offset="1" stop-color="#ffe680"/>'
        '</linearGradient>')
SYMBOL = ('<symbol id="kc-enso" viewBox="0 0 100 100">'
          '<circle cx="50" cy="50" r="46" fill="#151f38"/>'
          '<path d="M71 21A34 34 0 1 0 82 41" fill="none" stroke="url(#kc-enso-g)" stroke-width="10" stroke-linecap="round"/>'
          '<path d="M66 27A28 28 0 0 0 30 33" fill="none" stroke="#ffcc33" stroke-width="3" stroke-linecap="round" opacity=".55"/>'
          '<path d="M36 41l11 9-11 9" fill="none" stroke="#e6ebf5" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'
          '<path d="M53 61h14" stroke="#ffcc33" stroke-width="7" stroke-linecap="round"/>'
          '</symbol>')
SPRITE = ('<!-- símbolo Kung-Code (Ensō) -->\n<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
          + GRAD + SYMBOL + '</defs></svg>\n')
LOGO = '<svg class="kc-logo" aria-hidden="true"><use href="#kc-enso"/></svg>'
FAVICON = ('<link rel="icon" href="data:image/svg+xml,<svg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 100 100\'>'
           '<circle cx=\'50\' cy=\'50\' r=\'46\' fill=\'%23151f38\'/>'
           '<path d=\'M71 21A34 34 0 1 0 82 41\' fill=\'none\' stroke=\'%23ffcc33\' stroke-width=\'11\' stroke-linecap=\'round\'/>'
           '<path d=\'M36 41l11 9-11 9\' fill=\'none\' stroke=\'%23e6ebf5\' stroke-width=\'8\' stroke-linecap=\'round\' stroke-linejoin=\'round\'/>'
           '<path d=\'M53 61h14\' stroke=\'%23ffcc33\' stroke-width=\'8\' stroke-linecap=\'round\'/></svg>">')


def edit(rel, fn):
    p = ROOT / rel
    s = p.read_text(encoding='utf-8')
    out = fn(s)
    if out != s:
        with open(p, 'w', encoding='utf-8', newline='\n') as fh:
            fh.write(out)
        print('atualizado:', rel)


def common(s):
    s = re.sub(r'<link rel="icon" href="data:image/svg\+xml,[^"]*">', lambda m: FAVICON, s, count=1)
    if 'id="kc-enso"' not in s:
        s = s.replace('<body>\n', '<body>\n' + SPRITE, 1) if '<body>\n' in s else re.sub(r'(<body[^>]*>\n)', lambda m: m.group(1) + SPRITE, s, count=1)
    return s


def slides(s):
    s = re.sub(r'<link rel="icon" href="data:image/svg\+xml,[^"]*">', lambda m: FAVICON, s, count=1)
    if 'id="kc-enso"' not in s:
        s = s.replace('  <defs>\n', '  <defs>\n    ' + GRAD + '\n    ' + SYMBOL + '\n', 1)
    if 'kc-cover' not in s:
        s = s.replace('  <h1>Linux &amp; Shell Script</h1>\n  <p class="subtitle">',
                      '  <p class="kc-cover">' + LOGO + '<span>KUNG-CODE</span></p>\n  <h1>Linux &amp; Shell Script</h1>\n  <p class="subtitle">', 1)
    if 'hud-brand' not in s:
        s = s.replace('<div class="hud">\n  <div class="progress"><div id="bar"></div></div>\n',
                      '<div class="hud">\n  <div class="progress"><div id="bar"></div></div>\n  <span class="hud-brand">' + LOGO + '<span>KUNG-CODE</span></span>\n', 1)
    if 'kc-thanks' not in s:
        s = s.replace('  <p class="terminal-line"><span class="p">aluno@aula:~$</span> exit<span class="caret"></span></p>\n</section>',
                      '  <p class="terminal-line"><span class="p">aluno@aula:~$</span> exit<span class="caret"></span></p>\n  <p class="kc-thanks">' + LOGO + '<span>KUNG-CODE</span></p>\n</section>', 1)
    return s


def ctf(s):
    s = common(s)
    s = s.replace('<div class="brand"><span aria-hidden="true">🐧</span> Missão Servidor Pinguim</div>',
                  '<div class="brand">' + LOGO + '<span class="brand-kc">Kung-Code</span><span class="brand-sep" aria-hidden="true"></span>Missão Servidor Pinguim</div>')
    s = s.replace('<div class="start-logo" aria-hidden="true">🐧🚩</div>', '<p class="brand-kicker">' + LOGO + 'Kung-Code</p>')
    if '<p class="brand-kicker">' + LOGO + 'Kung-Code</p>\n      <div class="gate-lock"' not in s:
        s = s.replace('      <div class="gate-lock" aria-hidden="true">', '      <p class="brand-kicker">' + LOGO + 'Kung-Code</p>\n      <div class="gate-lock" aria-hidden="true">', 1)
    s = s.replace('<h2>🏆 Missão cumprida!</h2>', '<h2>Missão cumprida!</h2>')
    s = s.replace('(copiar a flag do colega não funciona 😉)', '(copiar a flag do colega não funciona)')
    return s


def terminal(s):
    s = common(s)
    if 'brand-kc' not in s:
        s = s.replace('<div class="brand">\n        <svg class="brand-ico"',
                      '<div class="brand">\n        ' + LOGO + '<span class="brand-kc">Kung-Code</span><span class="brand-sep" aria-hidden="true"></span>\n        <svg class="brand-ico"', 1)
    return s


def landing(s):
    s = common(s)
    s = s.replace('  <div class="hero" aria-hidden="true">🐧</div>\n', '  <p class="kc">' + LOGO + '<span>Kung-Code</span></p>\n')
    if '.kc {' not in s:
        s = s.replace('  </style>', "    .kc { display: flex; align-items: center; gap: 12px; margin: 0 0 14px; font: 700 .8rem 'Space Grotesk', 'Inter', sans-serif; letter-spacing: .22em; text-transform: uppercase; color: var(--accent); }\n"
                                    "    .kc-logo { width: 44px; height: 44px; }\n"
                                    "    h1 { font-family: 'Space Grotesk', 'Inter', sans-serif; letter-spacing: -.02em; }\n  </style>", 1)
    return s


def cola(s):
    s = common(s)
    s = s.replace('      <h1>🐧 Cola de Comandos: Linux &amp; Shell Script</h1>',
                  '      <p class="kc">' + LOGO + '<span>Kung-Code</span></p>\n      <h1>Cola de Comandos: Linux &amp; Shell Script</h1>')
    s = s.replace('onclick="print()">🖨️ Imprimir</button>', 'onclick="print()">Imprimir</button>')
    if '.kc {' not in s:
        s = s.replace('  </style>', "    .kc { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; font: 700 .72rem 'Space Grotesk', var(--sans); letter-spacing: .22em; text-transform: uppercase; color: var(--accent); }\n"
                                    "    .kc-logo { width: 26px; height: 26px; }\n  </style>", 1)
    return s


edit('docs/slides/index.html', slides)
edit('docs/ctf/index.html', ctf)
edit('docs/terminal/index.html', terminal)
edit('docs/index.html', landing)
edit('docs/cola/index.html', cola)
