# Aula de Linux & Shell Script

Material de uma aula de ~1h para estudantes de TI: slides, um CTF com terminal Linux **simulado no navegador** e uma cola de comandos. Tudo é estático, então dá para publicar no GitHub Pages sem servidor.

```
docs/                 ← site publicado (GitHub Pages)
  index.html          página inicial (links para tudo)
  slides/             apresentação (atalhos abaixo)
  ctf/                CTF "Missão Servidor Pinguim" + terminal simulado
    js/shell/         shell simulado: sistema de arquivos, parser bash, ~60 comandos
    js/vi.js          editor vi/vim (modos normal, inserção e :comandos)
    js/ctf/           níveis, flags, dicas e pontuação
  cola/               cola de comandos para imprimir
planejamento/         plano de aula, exercícios, CTF e desafio para casa (rascunho validado)
tests/                testes automatizados (node tests/run.js)
```

## Apresentando os slides

| Tecla | Ação |
|---|---|
| `→` / `Espaço` | próximo passo: digita o próximo comando no terminal animado ou avança o diagrama. Sem passos pendentes, vai para o próximo slide |
| `←` | desfaz o último passo (ou volta ao slide anterior, já completo) |
| `Shift` + `→` / `←` | pula o slide inteiro |
| `S` | abre o **sumário**: busca por tema ou número e vai direto ao slide (também pelo botão "Sumário" no rodapé) |
| `P` | reproduz automaticamente os comandos do slide |
| `T` | inicia/pausa o cronômetro do exercício |
| `N` | notas do professor · `F` tela cheia |

Clicar no terminal também avança. Durante a digitação, um novo `→` termina o passo na hora.

Os terminais mostram a **saída real**: ao abrir a página, todos os exemplos rodam, na ordem, no mesmo shell simulado do CTF. Para mudar um exemplo, edite o bloco `<pre data-demo="cmds">` (linhas começando com `$ `) ou `<pre data-demo="script" data-name="x.sh">`. A saída se atualiza sozinha.

## Publicar no GitHub Pages

1. Crie um repositório e envie esta pasta.
2. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta **`/docs`**.
3. O site fica em `https://SEU-USUARIO.github.io/NOME-DO-REPO/`.

## Rodar localmente

Basta abrir `docs/index.html` (ou `docs/ctf/index.html`) direto no navegador, com dois cliques. Não precisa de servidor. Se preferir, um servidor local também funciona:

```bash
python -m http.server 8080 --directory docs
```

## Editando o código

As páginas carregam um script único gerado (`docs/ctf/js/ctf.bundle.js` e `docs/slides/slides.bundle.js`). Os navegadores bloqueiam módulos JavaScript (`type="module"`) em páginas abertas direto do disco, por isso o script precisa ser gerado. Depois de alterar qualquer arquivo `.js` em `docs/`, gere os scripts de novo:

```bash
node tools/build.js
```

Se você esquecer, um teste avisa que um script ficou desatualizado.

## Testes

```bash
node tests/run.js
```

Os testes cobrem o shell simulado (parser, expansões, scripts, permissões, comandos), cada nível do CTF (incluindo as armadilhas, como o `cat` sem aspas falhar), a pontuação e as dicas. Também executam no simulador todos os exemplos dos slides marcados com `data-run`. Funciona a partir do Node 12, sem dependências.

## Sobre o CTF

- **Flags por codinome:** cada aluno escolhe um codinome, e as flags são derivadas dele. Copiar a flag do colega não funciona.
- **Progresso no navegador:** o progresso e os arquivos criados ficam salvos no `localStorage` do navegador do aluno. Não há placar compartilhado.
- **Modo celular:** liga sozinho em telas pequenas, e o botão no topo alterna entre os modos. Nele, o terminal ocupa a tela inteira e as outras áreas (Níveis, Enviar, Ajuda) viram abas na parte de baixo. Há teclas extras, como `Enter`, `*`, `.`, `>`, `{` e `}`, e os botões `A−`/`A+` ajustam a fonte.
- **Dicas:** o botão "Dica" abre um visualizador em que dá para voltar e avançar entre as dicas já liberadas sem gastar pontos. Liberar a próxima dica é um botão separado. No terminal, `dica N` mostra todas as dicas já liberadas do nível.
- **Código de conclusão:** quem termina os 8 níveis recebe um código (`PINGUIM-XXXXXXXX`) para mostrar ao professor.
- **Limite do modelo:** como tudo roda no navegador, um aluno curioso pode achar as respostas lendo o JavaScript. Para o objetivo da aula (praticar), isso é aceitável.
