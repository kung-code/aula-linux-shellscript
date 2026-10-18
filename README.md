# Aula de Linux & Shell Script

Material de uma aula de ~1h para estudantes de TI: slides, um CTF com terminal Linux **simulado no navegador** e uma cola de comandos. Tudo é estático, então dá para publicar no GitHub Pages sem servidor.

```
docs/                 ← site publicado (GitHub Pages)
  index.html          página inicial (links para tudo)
  slides/             apresentação (atalhos abaixo)
  terminal/           terminal de prática para acompanhar a aula (sem jogo, com roteiro de comandos)
  ctf/                CTF "Missão Servidor Pinguim" + terminal simulado
    js/shell/         shell simulado: sistema de arquivos, parser bash, ~60 comandos
    js/vi.js          editor vi/vim (modos normal, inserção e :comandos)
    js/ctf/           níveis, flags, dicas e pontuação
  cola/               cola de comandos para imprimir
preparacao/           página pré-aula (publicada num site SEPARADO; ver abaixo)
src/preparacao/       código-fonte da página pré-aula
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

## Duas aulas, uma branch para cada

O conteúdo foi dividido em duas aulas. Cada uma tem a sua branch com o site completo daquela aula:

| Branch | Conteúdo | Senha do CTF |
|---|---|---|
| `aula-1` | teoria e terminal essencial (navegar, criar, copiar/mover/remover, ler), Exercício 1, CTF da aula 1 e desafio para casa | definida no slide do CTF da aula 1 |
| `aula-2` | redirecionamento, pipes, busca, permissões e shell script, Exercício 2, CTF da aula 2 e desafio `organizador.sh` | definida no slide do CTF da aula 2 |

Para publicar a aula do dia, em **Settings → Pages** escolha a branch (`aula-1` ou `aula-2`) e a pasta **`/docs`**. A troca leva de 1 a 2 minutos.

O número da aula fica em `docs/aula.js`. O CTF, o roteiro do terminal de prática e o desafio para casa usam esse número. O progresso do CTF fica salvo separado por aula, então quem jogou a aula 1 começa a aula 2 do zero.

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

- **Senha de acesso:** o CTF só abre com a senha que você mostra no slide do CTF. Nesse slide, aperte `→` ou clique em "Revelar senha". O site guarda apenas um hash da senha, e o texto dela fica só no slide. Para trocar a senha, rode `node tools/senha.js NOVA_SENHA`: o comando atualiza o hash, o slide e os bundles. Quem já tinha entrado precisa digitar a senha nova. Como tudo roda no navegador, um aluno curioso pode descobrir a senha lendo o código-fonte dos slides; a senha serve para organizar a aula, não como segurança.

- **Flags por codinome:** cada aluno escolhe um codinome, e as flags são derivadas dele. Copiar a flag do colega não funciona.
- **Progresso no navegador:** o progresso e os arquivos criados ficam salvos no `localStorage` do navegador do aluno. Não há placar compartilhado.
- **Modo celular:** liga sozinho em telas pequenas, e o botão no topo alterna entre os modos. Nele, o terminal ocupa a tela inteira e as outras áreas (Níveis, Enviar, Ajuda) viram abas na parte de baixo. Há teclas extras, como `Enter`, `*`, `.`, `>`, `{` e `}`, e os botões `A−`/`A+` ajustam a fonte.
- **Dicas:** o botão "Dica" abre um visualizador em que dá para voltar e avançar entre as dicas já liberadas sem gastar pontos. Liberar a próxima dica é um botão separado. No terminal, `dica N` mostra todas as dicas já liberadas do nível.
- **Código de conclusão:** quem termina os 8 níveis recebe um código (`PINGUIM-XXXXXXXX`) para mostrar ao professor.
- **Limite do modelo:** como tudo roda no navegador, um aluno curioso pode achar as respostas lendo o JavaScript. Para o objetivo da aula (praticar), isso é aceitável.

## Página de preparação (pré-aula)

`preparacao/` é uma página de cerca de 15 minutos para os alunos lerem **antes** da aula. Ela traz três temas (como o Linux se organiza, o que o shell faz com um comando e para onde vai a saída), cada um com um terminal simulado embutido. Não tem notas, cadastro nem progresso salvo.

Ela é **independente do site do curso**: não tem links para os slides, o CTF ou o terminal de prática, e o script (`prep.bundle.js`) não revela os caminhos do curso. Um teste garante isso. Para os alunos não chegarem ao curso pelo endereço, publique-a num **repositório separado**:

1. No GitHub, crie um repositório **público** novo, por exemplo `linux-preparacao`.
2. Envie para ele **apenas o conteúdo** da pasta `preparacao/` (`index.html`, `prep.css` e `prep.bundle.js`), com o `index.html` na raiz.
3. Em **Settings → Pages**, escolha **Deploy from a branch**, branch `main`, pasta **`/ (root)`**.
4. O endereço para enviar aos alunos fica `https://SEU-USUARIO.github.io/linux-preparacao/`.

Para editar a página, altere `preparacao/index.html`, `preparacao/prep.css` ou `src/preparacao/*.js`. Depois rode `node tools/build.js` e copie de novo os três arquivos para o repositório da preparação.

> O site do curso continua público no endereço dele. Se quiser escondê-lo até o dia da aula, desative o GitHub Pages deste repositório (Settings → Pages → Unpublish site) ou torne o repositório privado, e reative na véspera.
