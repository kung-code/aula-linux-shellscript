# Capture The Flag: "Missão Servidor Pinguim" 🐧🚩

> **Atualização (implementado):** a versão final roda inteira no navegador (`docs/ctf/`), com terminal simulado. Não há `setup_ctf.sh` nem validação por hash. Mudanças em relação a este rascunho:
> - As flags são geradas a partir do codinome do aluno.
> - O nível 8 virou "A Fechadura", com `./fechadura` e o modelo `modelo.sh`.
> - O narrador agora é "você é o novo administrador da PinguimCorp".
>
> Veja o `README.md` na raiz para os detalhes atuais.

## Narrativa

> *"Um servidor da empresa PinguimCorp foi abandonado e ninguém lembra das senhas. Seus fragmentos de acesso (flags) estão espalhados pelo sistema. Use o terminal para recuperá-los antes que o servidor seja desligado!"*

## Regras

- Toda flag tem o formato **`FLAG{...}`**.
- As flags são submetidas na **página do CTF** (parte do material HTML). Ela valida comparando o hash SHA-256, então a resposta não fica exposta no código da página.
- Cada nível tem **dicas progressivas**. Abrir uma dica custa pontos.
- Durante a aula: 9 min. Depois, o CTF continua aberto até a data definida pelo professor.
- O ponto de partida é `~/ctf/LEIA-ME.txt`.

## Preparação do ambiente

O aluno roda um script de setup que monta tudo em `~/ctf`:

```bash
wget <URL>/setup_ctf.sh
bash setup_ctf.sh
cd ~/ctf && cat LEIA-ME.txt
```

- O script é **idempotente**: pode ser rodado de novo para "resetar" o CTF.
- Não precisa de `sudo` e funciona em WSL, Linux, Codespaces e Killercoda.
- As flags ficam **ofuscadas dentro do setup** (ex.: base64 + rotação), para não aparecerem em texto puro se alguém abrir o arquivo.
- Seguindo a regra do projeto, o `setup_ctf.sh` e o `cofre.sh` terão **testes automatizados**. Eles verificam que cada nível é criado corretamente e que cada flag é recuperável pela solução esperada.

> **Alternativa:** distribuir como imagem Docker (`docker run -it pinguimcorp/ctf`). É mais isolado, mas exige Docker, o que é uma barreira para alunos iniciantes.

---

## Níveis

| Nível | Nome | Pts | Onde | Habilidade |
|---|---|---|---|---|
| 1 | Boas-vindas | 10 | `~/ctf/LEIA-ME.txt` | `cd`, `cat` |
| 2 | O Invisível | 10 | `~/ctf/nivel2/` | `ls -a` (arquivo oculto) |
| 3 | Nome Traiçoeiro | 15 | `~/ctf/nivel3/` | Aspas e escape (arquivo com espaços e outro começando com `-`) |
| 4 | O Labirinto | 15 | `~/ctf/nivel4/` (≈ 100 diretórios aninhados) | `find -name` |
| 5 | Agulha no Palheiro | 15 | `~/ctf/nivel5/palheiro.txt` (10.000 linhas) | `grep` |
| 6 | Porta Trancada | 20 | `~/ctf/nivel6/cofre.txt` (permissão `000`) | `ls -l`, `chmod` |
| 7 | O Único | 20 | `~/ctf/nivel7/ecos.txt` (milhares de linhas repetidas; a flag é a única linha que aparece só uma vez) | `sort \| uniq -u` (pipes) |
| 8 | 🔐 O Cofre Final | 30 | `~/ctf/nivel8/cofre.sh` (pede um PIN de 3 dígitos) | Escrever um laço `for` em shell script (força bruta) |

**Total:** 135 pontos.

### Detalhes de cada nível

**Nível 1: Boas-vindas**
- O arquivo traz a história, a flag 1 e a instrução: *"o próximo fragmento está em `nivel2`, mas você não vai vê-lo de primeira..."*
- Solução: `cat ~/ctf/LEIA-ME.txt`
- Flag: `FLAG{bem_vindo_ao_terminal}`

**Nível 2: O Invisível**
- `ls` mostra só um arquivo-isca (`nada_aqui.txt`). A flag está em `.fragmento_secreto`.
- Solução: `ls -a` e depois `cat .fragmento_secreto`
- Flag: `FLAG{nem_tudo_que_se_esconde_some}`
- Dicas: (1) "Arquivos podem ser tímidos." (2) "Leia `man ls` e procure por *all*."

**Nível 3: Nome Traiçoeiro**
- Dois arquivos: `meia flag.txt` (com espaço) e `-outra-metade`. A flag é a junção dos dois conteúdos.
- Solução: `cat "meia flag.txt"` e `cat ./-outra-metade` (ou `cat -- -outra-metade`)
- Flag: `FLAG{aspas_e_barras_salvam_vidas}`
- Dicas: (1) "O shell separa palavras por espaços." (2) "Para o shell, tudo que começa com `-` parece uma opção."

**Nível 4: O Labirinto**
- Uma árvore com cerca de 100 diretórios e muitos arquivos `.txt` falsos. O verdadeiro se chama `chave.flag`.
- Solução: `find ~/ctf/nivel4 -name "*.flag"`
- Flag: `FLAG{find_encontra_ate_agulha}`

**Nível 5: Agulha no Palheiro**
- Um arquivo com 10.000 linhas de texto aleatório e uma linha com `FLAG{`.
- Solução: `grep "FLAG" palheiro.txt`
- Flag: `FLAG{grep_e_meu_melhor_amigo}`

**Nível 6: Porta Trancada**
- `cat cofre.txt` retorna `Permission denied`. O arquivo é do próprio aluno, mas está com `chmod 000`.
- Solução: `ls -l`, `chmod u+r cofre.txt` e depois `cat cofre.txt`
- Flag: `FLAG{chmod_abre_portas}`
- Lição: o dono do arquivo pode mudar as permissões dele.

**Nível 7: O Único**
- `ecos.txt` tem milhares de linhas, cada uma repetida várias vezes. Só uma aparece exatamente uma vez, e ela é a flag (sem o prefixo `FLAG`, para não funcionar com `grep`).
- Solução: `sort ecos.txt | uniq -u`
- Flag: `FLAG{pipes_conectam_tudo}` (no arquivo aparece como `pipes_conectam_tudo`; o LEIA-ME do nível explica que é preciso colocar a resposta dentro de `FLAG{}`)

**Nível 8: O Cofre Final (bônus)**
- `./cofre.sh 123` responde `PIN incorreto`. O PIN vai de `000` a `999`.
- O script guarda **apenas o hash do PIN** e a flag **cifrada com o PIN**. Ler o código mostra como usar o script, mas não entrega a resposta.
- Solução esperada:
  ```bash
  for pin in $(seq -w 0 999); do
    ./cofre.sh "$pin" | grep -q "FLAG" && { echo "PIN: $pin"; ./cofre.sh "$pin"; break; }
  done
  ```
- Flag: `FLAG{automatizei_minha_primeira_invasao}`
- Dicas: (1) "Você não vai digitar 1000 vezes, vai?" (2) "`seq -w 0 999` gera números com zeros à esquerda." (3) "Use `for` e `grep`."

---

## Placar

- **Mínimo (já planejado):** placar individual na própria página. O aluno manda um print no chat ao terminar.
- **Opcional:** placar compartilhado da turma em tempo real. Exige um pequeno backend ou integração com planilha. Definir na validação.
