# Brev.ly — Servidor

**Status:** Implementado · 104 testes · [`DESIGN.md`](./DESIGN.md) é a especificação

Este documento é a referência da implementação do servidor: o que existe, por que
está assim, e onde é fácil quebrar. O `DESIGN.md` diz **o que** construir e por
quê; aqui está **como ficou** — em particular, as escolhas em que o caminho óbvio
é o errado.

---

## Arquitetura em uma página

Use-cases isolados devolvem `Either<Error, T>` e nunca lançam exceção de negócio.
As rotas Fastify só traduzem esse retorno em status HTTP — nada mais. Acesso a
dados via Drizzle sobre `postgres-js`.

```
server/src/
├── env.ts                    valida process.env no boot, falha alto
├── app/
│   ├── functions/            os 6 use-cases (create, list, get, increment, delete, export)
│   └── errors/               4 classes de erro de domínio
└── infra/
    ├── db/                   schema, conexão (exporta db E o driver pg cru)
    ├── shared/               either, schemas de validação, cursor, slugs reservados
    ├── storage/              interface Uploader + implementação R2
    └── http/                 app, error-handler, 6 rotas
```

**Regra de dependência:** `infra/shared/` não importa de `app/` nem de outras
pastas de `infra/`. `app/` não importa de `infra/http/`. É o que torna os
use-cases testáveis sem subir servidor.

---

## Dados e paginação

### O índice precisa casar com o `ORDER BY` até na ordenação de nulos

A paginação é keyset, ancorada em `(created_at, id)`, e existe um índice composto
`(created_at DESC, id DESC)` para sustentá-la.

**A armadilha:** no Postgres, `DESC` implica `NULLS FIRST`. Mas o `.desc()` do
Drizzle numa coluna de **índice** emite `DESC NULLS LAST`, enquanto o `desc()` num
**orderBy** emite `DESC` puro. Pathkeys incompatíveis — o índice existe, está
correto, e é inútil para a ordenação que deveria servir.

| `ORDER BY` | plano de execução | custo |
|---|---|---|
| `created_at DESC, id DESC` | `Seq Scan` + heapsort | 1246 |
| casando com o índice | `Index Scan` | 2.97 |

Isso passa em qualquer suíte de testes. Com poucas linhas o `Seq Scan` é até mais
rápido. Só aparece com volume — e a única forma de detectar é `EXPLAIN`.

A migration `0001` corrige o índice. As queries ficaram como estão, porque o
`DESIGN.md` §4.2 especifica `DESC` puro: quem havia divergido era o índice.

### A condição de seek precisa ser comparação de tupla

Escrever a condição keyset como `created_at < X OR (created_at = X AND id < Y)` é
o idioma mais comum — e no Postgres ela não vira condição de início de índice. É
aplicada como `Filter` depois do scan.

Com âncora na profundidade 10.000:

| forma | uso do índice | buffers | linhas descartadas |
|---|---|---|---|
| booleana (`OR`/`AND`) | `Filter` | 177 | **10.001** |
| tupla `(created_at, id) < (X, Y)` | `Index Cond` | 3 | 0 |

A forma booleana faz exatamente o que o keyset existe para evitar: varrer e
descartar todas as linhas anteriores. As duas formas só divergem se alguma coluna
aceitar nulo — aqui as duas são `NOT NULL`.

### `drizzle.config.ts` aponta para `links.ts`, não para o barril

O código da aplicação importa o barril `schemas/index.ts`, e isso está certo. Mas
o `drizzle-kit` **não**: o barril exporta `const schema = { links }`, um objeto
comum, e o loader dele procura símbolos de tabela exportados. Apontar o config
para o barril faz ele enxergar zero tabelas e gerar `DROP TABLE "links" CASCADE`.

Ao acrescentar uma segunda tabela, liste os dois arquivos — o campo aceita array
ou glob. Não aponte para o barril.

---

## Contrato HTTP

### O mapeamento erro → status vive num lugar só

As rotas lançam o erro que veio no `Left`; o tratador central converte por
`error.name`. Por isso as classes de erro declaram `readonly name` explicitamente
— minificação altera `constructor.name`.

| Erro | Status |
|---|---|
| `SlugAlreadyExists`, `SlugIsReserved` | 409 |
| `LinkNotFound` | 404 |
| `NoLinksToExport` | 422 |
| `ZodError` | 400, com `issues` |

O tratador também honra `error.statusCode` na faixa 4xx antes do fallback 500 —
sem isso, JSON malformado e `Content-Type` não suportado voltavam como **500**, e
qualquer cliente podia inundar o log de erros com bytes inválidos.

### O schema do body é frouxo de propósito

A rota `POST /links` valida `originalUrl` e `slug` apenas como `z.string()`. A
validação real acontece no `.parse()` dentro do use-case.

Duas razões: a regra fica junto do domínio, testável sem HTTP, e o use-case
continua protegido se for chamado de outro lugar. A consequência prática é que o
caminho percorrido é o `ZodError` do use-case — e como o Zod acumula todos os
problemas num erro só, **dois campos inválidos aparecem juntos em `issues`**.
Apertar o schema da rota faria o type provider rejeitar no primeiro campo, e o
formulário do front exibiria um erro onde existem dois.

### `GET /links/:slug` devolve 404 para slug malformado, não 400

Um apelido de dois caracteres não passa na validação. O impulso é devolver 400 —
mas o front discrimina em `status === 404` para escolher entre "link não
encontrado" e a tela de falha de rede com botão "tentar novamente".

Com 400, quem acessasse `brev.ly/ab` receberia a tela de **falha de rede**, com
botão de tentar de novo, para um apelido que jamais poderá existir. Um slug que
não pode ser válido não pode ser encontrado.

Isso vale **só nessa rota**. Em `DELETE` e `PATCH` o slug vem de um link que a
aplicação já listou, então 400 está certo lá.

### O `id` interno nunca aparece numa resposta

Garantido por construção em três camadas: os use-cases fazem `select`/`returning`
com lista explícita de colunas; a listagem seleciona `id` (o cursor precisa dele)
e o remove por destructuring antes de devolver; e `linkToJson` reprojeta os quatro
campos públicos.

### O CORS precisa listar os métodos explicitamente

O `@fastify/cors` na versão 11 estreitou o default de `methods` para os métodos
safelisted: `GET,HEAD,POST`. `DELETE` e `PATCH` são não-safelisted, exigem
preflight, e sem `methods` explícito **ambos são bloqueados no navegador** —
derrubando remoção de link e contagem de acessos.

Nada denuncia isso do lado do servidor. Testes de rota com `app.inject()` injetam
direto no roteador e não percorrem o preflight; `curl` sem cabeçalho `Origin`
também não. Existe um teste de preflight justamente por isso.

---

## Validação e segurança

### A URL original aceita só `http` e `https`

`z.url()` sem restrição aceita `javascript:`, `data:`, `vbscript:` e `file:`. O
endpoint de criação é público e sem autenticação, e a página de redirect renderiza
a URL original como âncora clicável — um `<a href="javascript:...">` clicado
executa na origem da página. XSS armazenado por uma feature que o spec exige.

### O slug é normalizado antes de ser validado

`slugSchema` faz `trim` + `toLowerCase` num `.transform()`, e só então valida
comprimento e formato via `.pipe()`. Invertido, `MeuLink` seria rejeitado em vez
de virar `meulink`.

A normalização acontecer primeiro também é o que faz a checagem de duplicidade
funcionar com uma comparação simples de igualdade.

### Falha de validação lança; erro de domínio devolve `Left`

Formato inválido é erro de quem chamou, e vira 400 na borda HTTP. `Left` fica
reservado para o que só o domínio sabe: slug duplicado, slug reservado, link
inexistente, nada a exportar. Misturar os dois faria o `Either` virar um canal
genérico de erro, e cada rota teria que discriminar tipos de `Left` para escolher
o status.

### O sucesso do `Either` nunca é `undefined`

A implementação canônica discrimina os lados por `!== undefined`. Um
`makeRight(undefined)` produz um valor em que `isLeft()` e `isRight()` são **ambos
falsos** e o `unwrapEither` lança em runtime — e o TypeScript não protege, porque
`Either<Error, void>` compila normalmente.

Por isso `deleteLink` devolve `Either<Error, true>` com `makeRight(true)`. Há um
teste que documenta a armadilha em vez de escondê-la.

### A criação de link fecha a corrida no banco

O `SELECT` prévio é o caminho comum. Mas entre ele e o `INSERT` há uma janela:
duas criações simultâneas do mesmo apelido passam ambas pela checagem. A perdedora
é capturada por um catch estreito no SQLSTATE `23505` e vira
`Left(SlugAlreadyExists)` — 409, e não um 500 com erro cru do driver.

Detalhe não-óbvio: o Drizzle embrulha o `PostgresError` num `DrizzleQueryError` e
move o original para `.cause`. Um catch checando só `instanceof PostgresError`
fica morto.

---

## Exportação em streaming

O pipeline é `cursor do Postgres → Transform → csv-stringify → PassThrough →
Upload → R2`, com memória constante independente do volume.

Três coisas que falham **em silêncio** se mexidas:

**A ordem do upload.** A promise do upload tem que ser criada **antes** do
pipeline ser aguardado. O `PassThrough` tem buffer limitado; sem consumidor
conectado, o pipeline enche e trava para sempre por contrapressão. Reestruturar em
awaits sequenciais não dá erro — dá *hang*.

**Os nomes das colunas.** `pg.unsafe()` passa por baixo do mapeamento do Drizzle,
então as linhas voltam em `snake_case` (`original_url`, `access_count`). Ler
`row.originalUrl` escreve `undefined` em toda célula — e as asserções de cabeçalho
continuam passando.

**O cursor entrega lotes.** `.cursor(50)` produz arrays de até 50 linhas, não
linhas avulsas. O teste exporta 120 linhas justamente para exercitar mais de um
lote.

O nome do objeto é `exports/<uuid>-links.csv`: o prefixo é o que a regra de ciclo
de vida do bucket usa para expirar relatórios antigos, e o uuid é o que impede
duas exportações no mesmo segundo de sobrescreverem uma à outra.

---

## Empacotamento

A imagem é multi-stage sobre `node:22-alpine` (não a versão local — a imagem
precisa ser reprodutível), roda como usuário `node`, e o `.dockerignore` fica na
**raiz do repositório**, porque o Docker o lê da raiz do contexto de build.

As migrations rodam num serviço separado sob o profile `tools`, fora do entrypoint
da aplicação — migrar é decisão explícita. Esse serviço constrói a partir do
estágio `builder`, porque o `drizzle-kit` é devDependency e não existe na imagem
de runtime instalada com `--prod`.

**Consequência operacional:** a ordem `postgres` → `migrate` → `server` é
obrigatória. Sem a migration, o servidor sobe normalmente e devolve 500 em toda
requisição ao banco. Não há guarda-corpo contra esquecer o passo.

O build é `tsc && tsc-alias`. O segundo passo não é opcional: o `tsc` sozinho não
reescreve o alias `@/`, e o `dist/` resultante não roda.

---

## O que só se verifica fora do repositório

**Download do CSV pela CDN.** Verificado manualmente em 24/08/2026 contra um
bucket real: `POST /links/exports` → objeto em `exports/<uuid>-links.csv` →
download pela URL pública `r2.dev` com `200`, `text/csv`,
`Content-Disposition: attachment`, e 20.001 linhas de dados — exatamente o
`count(*)` da tabela. A suíte cobre o conteúdo com um duplo em memória; o
caminho até o bucket depende de credenciais e precisa ser repetido a cada
ambiente novo.

**A regra de ciclo de vida do bucket.** Expirar objetos com prefixo `exports/`
após 7 dias é configuração de painel, invisível a partir do repositório.
Configurada no bucket atual; sem ela o armazenamento cresce indefinidamente,
porque cada exportação cria um objeto e nada os remove.

---

## Pendências

**Para o front — o item mais importante desta lista:**

O `DESIGN.md` (§4.3.1, §4.9) exige **um teste que confronte a blocklist de slugs
reservados com a tabela de rotas do front**, para que as duas não divirjam em
silêncio. Ele não existe e não pode existir ainda: `web/` ainda não tem tabela de
rotas. Hoje `reserved-slugs.spec.ts` espelha os valores à mão.

Um apelido que colida com uma rota estática do front é criado com sucesso e fica
**inalcançável para sempre, sem erro em lugar nenhum**. O teste é a única defesa
contra a lista e as rotas divergirem no futuro.

**Uma observação registrada, sem correção:**

- O cursor tem precisão de milissegundo (serializa um `Date` do JavaScript),
  enquanto `created_at` é `timestamptz` com precisão de microssegundo. Uma linha
  criada no mesmo milissegundo da âncora, com fração menor, pode ser pulada na
  virada de página.

---

## Evidência

| Verificação | Resultado |
|---|---|
| Suíte | 104 testes em 14 arquivos |
| `pnpm lint` · `tsc --noEmit` (app e testes) · `pnpm build` | limpos |
| `EXPLAIN` da listagem | `Index Scan using links_created_at_id_idx` |
| Seek em profundidade 10.000 | `Index Cond`, 3 buffers, zero descartes |
| Imagem Docker | roda como `node`, sem binários de desenvolvimento |
| Volume | link sobrevive a `down` + `up` |
| Exportação no R2 | round trip real: upload, download pela CDN, 20.001 linhas = `count(*)` |

Três testes provam decisões de design em vez de comportamento superficial:

- **`create-link`** dispara 50 criações simultâneas do mesmo apelido e afirma
  exatamente um sucesso, 49 `SlugAlreadyExists`, zero rejeições.
- **`increment-link-visits`** dispara 20 incrementos paralelos e afirma total 21.
  O driver abre pool de até 10 conexões, então ler-somar-gravar em JavaScript
  perderia contagens e falharia aqui.
- **`list-links`** insere um link *entre* duas páginas e afirma que nada duplica
  nem some — a regressão que motivou escolher keyset em vez de `OFFSET`.
