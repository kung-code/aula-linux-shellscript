# Linux & Shell Script: do zero ao primeiro script

> **Público:** estudantes de TI dos primeiros semestres
> **Formato:** online, síncrono · **Duração:** ~60 min
> **Status:** RASCUNHO PARA VALIDAÇÃO. Depois de aprovado, vira apresentação em HTML/CSS/JS.

---

## 1. Objetivos de aprendizagem

Ao final da aula, o aluno deve conseguir:

1. Explicar o que são Linux, kernel, distribuição, terminal e shell.
2. Navegar no sistema de arquivos com caminhos absolutos e relativos.
3. Criar, copiar, mover, remover e ler arquivos e diretórios.
4. Buscar arquivos (`find`) e conteúdo (`grep`).
5. Usar pipes (`|`) e redirecionamentos (`>`, `>>`, `2>`).
6. Ler e alterar permissões (`ls -l`, `chmod`).
7. Escrever e executar um shell script com variáveis, argumentos, `if` e `for`.

---

## 2. Pré-aula (enviar aos alunos 2 ou 3 dias antes)

A aula é curta, então **ninguém pode gastar 15 minutos instalando ambiente**. Mande uma mensagem com:

| Situação do aluno | Ambiente recomendado |
|---|---|
| Windows 10/11 | **WSL + Ubuntu** (`wsl --install` no PowerShell como administrador, reiniciar) |
| Linux | Terminal nativo |
| macOS | Terminal nativo (zsh/bash; quase tudo funciona igual) |
| Não conseguiu instalar | **Plano B no navegador:** GitHub Codespaces ou Killercoda (Ubuntu Playground) |

**Checklist de "estou pronto":** abrir o terminal e rodar `echo "Pronto para a aula!"`, depois mandar um print no chat ou fórum.

---

## 3. Cronograma (60 min)

| Tempo | Bloco | Tipo | Conteúdo |
|---|---|---|---|
| 00–04 | **Abertura** | Interação | Enquete rápida: "Já usou terminal?", "Qual SO você usa?". Motivação: servidores, nuvem, Docker, DevOps, segurança, Android |
| 04–12 | **Teoria 1: O que é Linux** | Teoria | Kernel × distro × shell × terminal; árvore de diretórios; "tudo é arquivo"; anatomia de um comando |
| 12–24 | **Prática 1: Terminal essencial** | Demo ao vivo | Navegação, arquivos, leitura, ajuda (`man`, `--help`) |
| 24–29 | **Exercício 1** | Alunos | Missão "Montando o projeto" (5 min) |
| 29–36 | **Prática 2: Superpoderes** | Demo ao vivo | Pipes, redirecionamento, `grep`, `find`, permissões |
| 36–46 | **Teoria + Prática 3: Shell Script** | Teoria + Demo | Shebang, variáveis, `read`, argumentos, `if`, `for`, código de saída |
| 46–49 | **Exercício 2** | Alunos | Primeiro script: `saudacao.sh` (3 min) |
| 49–58 | **Capture The Flag** | Alunos | 7 flags, placar ao vivo (continua depois da aula) |
| 58–60 | **Encerramento** | — | Resumo, cola de comandos, desafio para casa |

> **Dica de condução:** alunos com terminal aberto **digitando junto** durante as demos. O professor digita devagar e lê cada comando em voz alta. A cada bloco, perguntar "deu certo para todos? Reaja com 👍".

> **Se atrasar:** o CTF é o bloco elástico. Os alunos podem terminar depois da aula, e o placar continua aberto.

---

## 4. Conteúdo detalhado

### Bloco 1: Abertura (4 min)

- Pergunta provocativa: *"Você usa Linux todo dia e talvez não saiba."* (Android, roteador, servidores do Google/Netflix, ~100% dos supercomputadores, a maior parte da nuvem.)
- Por que um profissional de TI precisa do terminal: servidores não têm interface gráfica, automação, Docker/Kubernetes, CI/CD, cibersegurança, ciência de dados.
- Promessa da aula: *"Em 1 hora vocês vão escrever um script e capturar flags como hackers."*

### Bloco 2: Teoria, o que é Linux (8 min)

**2.1 Peças do quebra-cabeça**
- **Kernel:** o núcleo, que fala com o hardware (Linus Torvalds, 1991).
- **Distribuição (distro):** kernel + ferramentas GNU + gerenciador de pacotes + extras. Exemplos: Ubuntu, Debian, Fedora, Arch, Kali.
- **Shell:** o programa que interpreta seus comandos (bash, zsh, sh).
- **Terminal:** a janela onde o shell roda.
- Analogia: kernel = motor, distro = modelo do carro, shell = volante e pedais, terminal = painel.

**2.2 Sistema de arquivos (árvore única a partir de `/`)**

| Diretório | Para quê |
|---|---|
| `/` | Raiz de tudo |
| `/home/usuario` (`~`) | Seus arquivos |
| `/etc` | Configurações |
| `/bin`, `/usr/bin` | Programas/comandos |
| `/var/log` | Logs |
| `/tmp` | Temporários |
| `/root` | Home do administrador |

- Não existe `C:\`. Tudo fica pendurado no `/`.
- **Caminho absoluto** (`/home/ana/docs`) × **relativo** (`docs`, `../fotos`).
- Atalhos: `.` (aqui), `..` (pai), `~` (home), `-` (diretório anterior).
- Linux diferencia maiúsculas de minúsculas: `Arquivo.txt` ≠ `arquivo.txt`.
- Arquivos que começam com `.` são **ocultos**.

**2.3 Anatomia de um comando**
```
ls   -la     /etc
│    │       └── argumento (sobre o quê)
│    └── opções/flags (como)
└── comando (o quê)
```
- O prompt `usuario@maquina:~$`. O `$` indica usuário comum e o `#` indica root.
- **Usuário comum × root**, e o `sudo` ("com grandes poderes...").

### Bloco 3: Prática 1, terminal essencial (12 min, demo ao vivo)

| Categoria | Comandos | Exemplo da demo |
|---|---|---|
| Onde estou? | `pwd`, `whoami` | `pwd` |
| Navegar | `cd`, `ls`, `ls -l`, `ls -a`, `ls -lh` | `cd /etc && ls`, depois `cd ~` e `cd -` |
| Criar | `mkdir`, `mkdir -p`, `touch` | `mkdir -p aula/{scripts,dados}` |
| Copiar/mover/renomear | `cp`, `cp -r`, `mv` | `mv nota.txt notas.txt` |
| Remover | `rm`, `rm -r`, `rmdir` | Aviso: **não existe lixeira!** |
| Ler | `cat`, `less`, `head`, `tail`, `wc` | `head -n 5 /etc/passwd` |
| Escrever rápido | `echo`, `nano` | `echo "oi" > a.txt` |
| Ajuda | `man`, `--help`, `Tab`, `↑`, `Ctrl+C`, `Ctrl+L`, `history` | `man ls` (sair com `q`) |

**Momentos-chave para enfatizar:**
- **TAB completa tudo.** Use e abuse.
- `rm -rf` é perigoso. Nunca rode comandos da internet sem entender o que fazem.

### Bloco 4: Exercício 1 (5 min), ver `02-exercicios.md`

### Bloco 5: Prática 2, superpoderes (7 min, demo ao vivo)

**5.1 Redirecionamento**
| Operador | Efeito |
|---|---|
| `>` | Escreve na saída (sobrescreve) |
| `>>` | Acrescenta ao final |
| `2>` | Redireciona erros |
| `<` | Lê entrada de um arquivo |

**5.2 Pipe `|`:** a saída de um vira a entrada do outro (filosofia Unix: pequenas ferramentas combinadas).
```bash
cat /etc/passwd | wc -l
ls -l /etc | grep conf
history | grep cd
cat /etc/passwd | cut -d: -f1 | sort | head -n 5
```

**5.3 Busca**
```bash
grep "root" /etc/passwd        # conteúdo
grep -ri "erro" ./logs          # recursivo, sem diferenciar maiúsc./minúsc.
find ~ -name "*.txt"            # arquivos pelo nome
find . -type f -size +1M        # por tamanho
```

**5.4 Permissões**
```
-rwxr-xr--  1 ana alunos 512 out 16 notas.sh
│└┬┘└┬┘└┬┘
│ │  │  └── outros:  r-- (só lê)
│ │  └───── grupo:   r-x (lê e executa)
│ └──────── dono:    rwx (lê, escreve, executa)
└────────── tipo: - arquivo | d diretório | l link
```
- `r=4`, `w=2`, `x=1`, então `chmod 755 = rwxr-xr-x` e `chmod 644 = rw-r--r--`.
- Forma simbólica: `chmod +x script.sh`, `chmod u+w,o-r arquivo`.
- Gancho para o próximo bloco: *"Para um script rodar, ele precisa do `x`."*

### Bloco 6: Shell Script (10 min, teoria + demo)

**6.1 O que é:** um arquivo de texto com comandos que o shell executa em sequência. Serve para automatizar o que você faria à mão.

**6.2 O primeiro script**
```bash
#!/bin/bash
# Meu primeiro script
echo "Olá, $USER! Hoje é $(date +%d/%m/%Y)."
```
```bash
nano ola.sh       # escrever
chmod +x ola.sh   # dar permissão
./ola.sh          # executar
```
- **Shebang** `#!/bin/bash`: diz qual interpretador usar.
- Por que `./`? Porque o diretório atual não está no `PATH`.

**6.3 Variáveis**
```bash
nome="Ana"             # SEM espaço em volta do =
echo "Olá, $nome"
hoje=$(date +%A)       # substituição de comando
echo "Hoje é $hoje"
```
- Aspas duplas expandem variáveis e aspas simples não: `'$nome'` imprime literalmente `$nome`.

**6.4 Entrada do usuário e argumentos**
```bash
read -p "Qual sua idade? " idade
echo "Argumento 1: $1 | Total de argumentos: $# | Todos: $@ | Script: $0"
```

**6.5 Condicional**
```bash
if [ "$idade" -ge 18 ]; then
  echo "Maior de idade"
else
  echo "Menor de idade"
fi
```
| Números | Strings | Arquivos |
|---|---|---|
| `-eq -ne -lt -le -gt -ge` | `=`, `!=`, `-z` (vazia) | `-f` (arquivo existe), `-d` (diretório existe) |

- Os espaços dentro de `[ ]` são **obrigatórios**.

**6.6 Laços**
```bash
for i in 1 2 3 4 5; do echo "Número $i"; done
for arq in *.txt; do echo "Encontrei: $arq"; done
for i in $(seq 1 10); do echo $i; done

contador=1
while [ $contador -le 3 ]; do
  echo "Volta $contador"
  contador=$((contador + 1))     # aritmética
done
```

**6.7 Código de saída:** `echo $?`. `0` = sucesso, diferente de `0` = erro. Use `exit 1` no script para sinalizar falha.

**Demo final integrando tudo:** `backup.sh` (ver exemplo completo em `02-exercicios.md`).

### Bloco 7: Exercício 2 (3 min), ver `02-exercicios.md`

### Bloco 8: Capture The Flag (9 min + continua depois), ver `03-ctf.md`

### Bloco 9: Encerramento (2 min)

- Recap em 1 slide: **navegar → manipular → buscar → combinar → automatizar**.
- Entregar a **cola de comandos** (cheat sheet), que vira uma página do material HTML.
- Apresentar o **desafio para casa** (`04-desafio-para-casa.md`) e onde entregar.
- Recomendações: OverTheWire *Bandit*, `man`, livro gratuito *"The Linux Command Line"* (William Shotts).

---

## 5. Pontos para você validar

1. **Ambiente:** WSL + plano B no navegador está bom? Ou prefere padronizar todos em uma única plataforma online (ex.: Codespaces) para evitar problemas?
2. **Profundidade:** deixei de fora de propósito processos (`ps`, `kill`), gerenciamento de pacotes (`apt`), `ssh`, funções em bash e `case`. Quer incluir algum, mesmo que só citado?
3. **CTF:** o ambiente é montado por um script `setup_ctf.sh` que os alunos rodam (detalhes em `03-ctf.md`). Os alunos validam as flags **na própria página HTML** (comparação por hash, sem revelar a resposta). Quer também um placar compartilhado entre a turma? Isso exige backend ou planilha.
4. **Desafio para casa:** prazo e forma de entrega (GitHub, AVA/Moodle, e-mail)?
5. **Material HTML:** a ideia é ter (a) slides navegáveis por teclado, (b) blocos de código com botão "copiar", (c) timer visível nos exercícios, (d) página do CTF com validação de flags e (e) cheat sheet para impressão. Ok?
