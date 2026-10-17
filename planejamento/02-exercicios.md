# Exemplos práticos e exercícios

---

## Exemplo da demo final: `backup.sh`

Usado no fim do Bloco 6. Junta variáveis, argumentos, `if`, `for`, `$( )` e códigos de saída.

```bash
#!/bin/bash
# Uso: ./backup.sh <diretorio>
# Copia todos os .txt do diretório para uma pasta de backup datada.

origem="$1"

if [ -z "$origem" ]; then
  echo "Uso: $0 <diretorio>"
  exit 1
fi

if [ ! -d "$origem" ]; then
  echo "Erro: '$origem' não é um diretório."
  exit 2
fi

destino="backup_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$destino"

total=0
for arq in "$origem"/*.txt; do
  [ -f "$arq" ] || continue
  cp "$arq" "$destino/"
  echo "Copiado: $arq"
  total=$((total + 1))
done

echo "Backup concluído: $total arquivo(s) em $destino"
```

Executar na demo, nesta ordem, mostrando cada saída: `./backup.sh` (sem argumento), `./backup.sh pasta_que_nao_existe`, `./backup.sh aula/dados`, e depois `echo $?`.

---

## Exercício 1: Missão "Montando o projeto" (5 min)

> Faça tudo **só pelo terminal**. Ao final, cole a saída do último comando no chat.

1. Vá para sua home.
2. Crie a estrutura abaixo **com um único comando**:
   ```
   projeto/
   ├── docs/
   ├── src/
   └── testes/
   ```
3. Dentro de `docs`, crie o arquivo `leia-me.txt` contendo a frase `Projeto da aula de Linux`.
4. Acrescente uma segunda linha com o seu nome (sem apagar a primeira).
5. Copie `leia-me.txt` para `src/` com o nome `copia.txt`.
6. Renomeie `testes` para `tests`.
7. Mostre a árvore de arquivos de `projeto` (dica: `find` ou `ls -R`).

**Bônus:** quantas linhas tem o arquivo `/etc/passwd`? E quantos usuários usam `bash`?

<details><summary>Gabarito</summary>

```bash
cd ~
mkdir -p projeto/{docs,src,testes}
echo "Projeto da aula de Linux" > projeto/docs/leia-me.txt
echo "Seu Nome" >> projeto/docs/leia-me.txt
cp projeto/docs/leia-me.txt projeto/src/copia.txt
mv projeto/testes projeto/tests
find projeto        # ou: ls -R projeto

# Bônus
wc -l /etc/passwd
grep -c "bash" /etc/passwd
```
</details>

---

## Exercício 2: Primeiro script, `saudacao.sh` (3 min + término em casa)

Crie um script que:

1. Receba um **nome como argumento** (`./saudacao.sh Maria`).
2. Se nenhum nome for passado, pergunte o nome com `read`.
3. Imprima `Olá, <nome>! Agora são HH:MM.`
4. **Bônus:** imprima a saudação de acordo com a hora: "Bom dia" (antes das 12h), "Boa tarde" (até as 18h) e "Boa noite" (depois disso).

<details><summary>Gabarito</summary>

```bash
#!/bin/bash
nome="$1"

if [ -z "$nome" ]; then
  read -p "Qual o seu nome? " nome
fi

hora=$(date +%H)

if [ "$hora" -lt 12 ]; then
  saudacao="Bom dia"
elif [ "$hora" -lt 18 ]; then
  saudacao="Boa tarde"
else
  saudacao="Boa noite"
fi

echo "$saudacao, $nome! Agora são $(date +%H:%M)."
```
```bash
chmod +x saudacao.sh
./saudacao.sh Maria
```
</details>

---

## Exercícios extras (para quem terminar antes ou para revisão)

| # | Enunciado | Conceito |
|---|---|---|
| E1 | Liste os 5 maiores arquivos de `/etc` | `ls -lS`, `head`, pipe |
| E2 | Salve em `erros.txt` apenas os erros de `ls /pasta_inexistente /etc` | `2>` |
| E3 | Script `tabuada.sh N` que imprime a tabuada de N (1 a 10) | `for`, `$(( ))`, `$1` |
| E4 | Script `conta.sh` que diz quantos arquivos e quantos diretórios existem no diretório atual | `-f`, `-d`, contador |
| E5 | Script `existe.sh arquivo` que avisa se o arquivo existe e, se existir, mostra as permissões dele | `-f`, `ls -l` |
