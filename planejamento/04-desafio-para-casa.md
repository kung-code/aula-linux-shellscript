# Desafio para casa

Duas frentes: uma **construção** (entregável) e uma **trilha de prática** (autoestudo).

---

## Parte A: Construção, o "Organizador de Downloads" 🗂️

Crie o script `organizador.sh`, que arruma uma pasta bagunçada separando os arquivos por tipo.

```bash
./organizador.sh ~/Downloads
```

**Antes:**
```
Downloads/
├── foto.jpg
├── trabalho.pdf
├── musica.mp3
├── notas.txt
└── script.sh
```
**Depois:**
```
Downloads/
├── imagens/     foto.jpg
├── documentos/  trabalho.pdf, notas.txt
├── audio/       musica.mp3
└── outros/      script.sh
```

### Requisitos por nível

| Nível | Requisito |
|---|---|
| 🟢 **Básico** | Recebe o diretório por argumento; valida se o argumento foi passado e se é um diretório (`exit 1` em caso de erro); move os arquivos para as pastas por extensão (`jpg/png/gif` → imagens, `pdf/txt/docx` → documentos, `mp3/wav` → audio, demais → outros) |
| 🟡 **Intermediário** | Mostra um relatório no final (`imagens: 3, documentos: 5...`); grava um log em `organizador.log` com data/hora de cada movimentação; não sobrescreve arquivos com o mesmo nome (renomeia para `arquivo_1.txt`) |
| 🔴 **Avançado** | Opção `-n` (*dry-run*: só mostra o que faria); opção `-h` (ajuda); usa `case` para mapear as extensões; usa funções; trata nomes com espaços |

### Para testar sem medo

Script auxiliar que gera uma pasta bagunçada para teste:
```bash
mkdir -p teste_bagunca && cd teste_bagunca
touch foto{1..3}.jpg doc{1..4}.pdf musica.mp3 "nome com espaco.txt" sem_extensao
```

### Entrega
- Repositório no GitHub com `organizador.sh` e um `README.md` mostrando um exemplo de uso (antes e depois).
- **Prazo:** [definir]

### Critérios de avaliação

| Critério | Peso |
|---|---|
| Funciona nos casos básicos | 40% |
| Valida entradas e trata erros | 20% |
| Requisitos intermediários/avançados | 25% |
| Legibilidade (comentários, nomes de variáveis, indentação) | 15% |

---

## Parte B: Trilha de prática

1. **OverTheWire, Bandit** (overthewire.org/wargames/bandit): CTF clássico de Linux via SSH. Meta: chegar ao **nível 10**. Os níveis 0 a 10 reforçam exatamente o que vimos em aula (`ls -a`, arquivos com `-` no nome, `find`, `grep`, `sort | uniq`).
2. **Terminar o CTF da aula**, se ainda faltar alguma flag (principalmente a do Cofre).
3. **Leitura:** *The Linux Command Line* (William Shotts, gratuito em linuxcommand.org), capítulos 1 a 10.
4. **Explorar por conta própria** (temas que ficaram de fora): `ps`, `top`, `kill`, `apt install`, `ssh`, `crontab`, `case`, funções, `awk` e `sed`.
