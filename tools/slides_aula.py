# Utilitários para montar o deck de cada aula a partir do deck completo.
import re


def sections(html):
    """Lista (título, início, fim) de cada <section class="slide ..."> do deck."""
    out = []
    for m in re.finditer(r'<section class="slide[^"]*" data-title="([^"]+)"[^>]*>[\s\S]*?</section>\n', html):
        out.append((m.group(1), m.start(), m.end()))
    return out


def find(html, title):
    for t, a, b in sections(html):
        if t == title:
            return a, b
    raise KeyError('slide não encontrado: ' + title)


def remove(html, titles):
    for t in titles:
        a, b = find(html, t)
        # remove também uma linha em branco que sobrar depois
        while b < len(html) and html[b] == '\n':
            b += 1
        html = html[:a] + html[b:]
    return html


def replace(html, title, new):
    a, b = find(html, title)
    return html[:a] + new.rstrip('\n') + '\n' + html[b:]


def insert_after(html, title, new):
    a, b = find(html, title)
    return html[:b] + '\n' + new.rstrip('\n') + '\n' + html[b:]


def drop_comment(html, text):
    return re.sub(r'<!-- =+ ' + re.escape(text) + r' =+ -->\n+', '', html)
