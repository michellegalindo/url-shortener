# Brev.ly — Design

**Data:** 2026-08-24
**Status:** Aprovado
**Escopo:** Encurtador de URLs fullstack — desafio prático de pós-graduação (Front-end + Back-end + DevOps)

---

## 1. Objetivo

Aplicação fullstack para cadastro, listagem, remoção e redirecionamento de links
encurtados, com contagem de acessos e exportação de relatório em CSV hospedado em
CDN.

Os requisitos vêm do enunciado do desafio, mantido fora deste repositório. As
seções abaixo reproduzem tudo o que o design precisa, de forma que este
documento se sustenta sozinho.

### Critério de sucesso

Todos os requisitos funcionais e não funcionais do enunciado cumpridos, com
qualidade de código defensável em revisão. Entrega em repositório público no
GitHub, com as subpastas `web/` e `server/`.

### Nota sobre o script obrigatório

A cópia de trabalho do enunciado que usamos continha uma transcrição corrompida
do requisito de scripts, pedindo *"um script com a chave exata `d` para seed de
dados"*. O requisito original é outro: **um script com a chave exata `db:migrate`
para executar as migrations do banco**. Este design segue o requisito original.
Um script `db:seed` existe adicionalmente, por conveniência, sem ser exigido.

---

## 2. Decisões tomadas

| # | Decisão | Escolha | Razão |
|---|---|---|---|
| D1 | Identificador nas operações de delete/incremento | **`slug`** | Chave natural única e imutável. A página de redirect só conhece o slug; usar UUID exigiria duas requisições encadeadas antes de redirecionar. Consistente em toda a API. |
| D2 | Arquitetura do back-end | **Use-cases + Either** | Erros como valor tipado no retorno, não exceções. Rotas Fastify só traduzem HTTP. Use-cases testáveis sem subir servidor. |
| D3 | Testes automatizados | **Sim, nos use-cases** | Não exigido pelo enunciado, mas é o que o padrão Either destrava a custo baixo. |
| D4 | Storage do CSV | **Cloudflare R2** (via SDK S3-compatível) | Chaves `CLOUDFLARE_*` são as exigidas no `.env.example` do enunciado. |
| D5 | Gerenciador de pacotes | **pnpm workspace** | Um `pnpm install` na raiz; mantém `web/` e `server/` como subpastas independentes, como a entrega exige. |
| D6 | UUID exposto na API | **Não** | `id` existe como PK interna. A API inteira opera por `slug` (consequência de D1). |
| D7 | Valor de sucesso do `Either` | **Nunca `undefined`** | A implementação canônica discrimina `Left`/`Right` por `!== undefined`. `makeRight(undefined)` faz `isLeft` e `isRight` retornarem ambos `false` e o `unwrapEither` lançar em runtime. Ver §4.4.1. |
| D8 | Incremento de acessos no front | **`fetch` com `keepalive: true`** | Requisição disparada sem `await` é abortada pelo navegador ao iniciar a navegação. Sem `keepalive`, a contagem incrementa de forma intermitente. Ver §5.3. |
| D9 | Leitura do banco na exportação | **Cursor real do Postgres** via `pg.unsafe(...).cursor(n)` | Lote por `LIMIT/OFFSET` é O(n²) e não garante snapshot consistente. Exige sair do Drizzle, com consequência em §4.5. |
| D10 | Isolamento dos testes | **`TRUNCATE` por teste, sem paralelismo entre arquivos** | Testes de estado vazio são impossíveis num banco compartilhado que nunca é limpo. Ver §4.9. |
| D11 | Paginação de `GET /links` | **Keyset** com âncora `(created_at, id)` | `OFFSET` referencia posição, não identidade: criar ou remover um link enquanto o usuário rola duplica ou pula itens. A home cria links na mesma tela da lista, então isso aconteceria de fato. Ver §4.3. |
| D12 | Slugs que colidem com rotas da aplicação | **Blocklist na criação**, derivada das rotas | `/:slug` disputa a raiz do domínio com as rotas do próprio front. Um link com slug `not-found` seria criado com sucesso e ficaria inalcançável para sempre, sem erro em lugar nenhum. Ver §4.3.1. |
| D13 | Exportação sem links | **422**, não 400 | 400 já significa falha de validação. Com o mesmo status para os dois casos, o front não consegue distinguir "requisição malformada" de "não há nada a exportar". Ver §4.3. |
| D14 | Navegação no redirect | **`window.location.replace`**, não `href` | `href` empilha a página de redirect no histórico: o botão Voltar retorna a ela, que redireciona de novo, prendendo o usuário. Ver §5.3. |
| D15 | Retenção dos CSVs no R2 | **Lifecycle rule de 7 dias** sobre o prefixo `exports/` | Cada exportação cria um objeto novo e nada apaga: o armazenamento cresceria de forma monotônica para sempre. Regra no bucket em vez de job na aplicação — não há código para manter nem para falhar em silêncio. Também limita a janela de exposição dos arquivos públicos. Ver §4.5.1. |
| D16 | Topologia de publicação | **Front e API em origens separadas**, sem proxy reverso; execução local via `docker-compose` | O enunciado exige o repositório, não deploy público. Front em `:5173`, API em `:3333`. Define a blocklist de slugs reservados (§4.3.1) e mantém o Dockerfile do web fora de escopo. |
| D17 | Tela de erro do redirect | **Renderizada dentro de `/:slug`**, sem rota `/not-found` | Uma rota estática venceria `/:slug` na resolução, tornando o apelido `not-found` inalcançável — é o bug que as duas referências têm. Renderizar no lugar também preserva o apelido na URL, permitindo que um F5 refaça a consulta. Ver §5.3. |
| D18 | Erro de rede no redirect | **Tela distinta do 404**, com "Tentar novamente" | Tratar toda falha como "link não encontrado" informa ao usuário que um link válido não existe. Ver §5.3. |

### Ambiente verificado

Node 25.4.0 · pnpm 11.0.5 · Docker 29.1.4

A imagem Docker usa `node:22-alpine` (LTS), independente da versão local — a
versão de desenvolvimento não deve ditar a de produção.

---

## 3. Estrutura do monorepo

```
url-shortener/
├── package.json          # privado, apenas scripts orquestradores
├── pnpm-workspace.yaml   # packages: server, web
├── docker-compose.yml    # postgres (healthcheck) + server
├── .gitignore
├── README.md
├── docs/
│   ├── DESIGN.md         # este documento
│   └── assets/           # imagens do README, fora do build (§5.2.1)
├── server/               # desafio Back-end + DevOps
└── web/                  # desafio Front-end
```

---

## 4. Back-end

### 4.1 Stack

Obrigatória: TypeScript, Fastify, Drizzle ORM, PostgreSQL.

Complementar: Zod 4, `fastify-type-provider-zod`, `@fastify/cors`,
`@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `csv-stringify`, `postgres`,
`drizzle-kit`, `tsx`, ESLint, Prettier.

Testes: Vitest, `vite-tsconfig-paths` (aliases `@/` na suíte), `dotenv-cli`
(carrega `.env.test`), `@faker-js/faker` (factories).

### 4.2 Modelo de dados

Tabela `links`:

| Coluna | Tipo | Restrições |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()`. Interno — nunca exposto na API. |
| `original_url` | `text` | `NOT NULL` |
| `slug` | `text` | `NOT NULL`, `UNIQUE` |
| `access_count` | `integer` | `NOT NULL`, default `0` |
| `created_at` | `timestamptz` | `NOT NULL`, default `now()` |

Em Drizzle, `timestamp('created_at')` gera `timestamp without time zone`. Para
obter `timestamptz` é obrigatório o parâmetro explícito:

```ts
createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
```

Índices:
- `UNIQUE` em `slug` — resolve o redirect e a checagem de duplicidade.
- Índice composto `(created_at DESC, id DESC)` — sustenta a paginação keyset
  (§4.3). Precisa ser composto e na mesma ordem do `ORDER BY`; um índice só em
  `created_at` obrigaria o Postgres a ordenar o desempate por `id`.

### 4.3 Contrato da API

Respostas de erro:

```ts
type ApiError = {
  message: string
  issues?: { path: string; message: string }[] // apenas em 400
}
```

O campo `issues` existe porque `{ message }` sozinho não sustenta um formulário:
com dois campos inválidos, achatar tudo numa string obriga o front a exibir um
erro só, sem saber a qual campo pertence. Com `issues`, o React Hook Form mapeia
cada erro ao seu campo via `setError(path, ...)`.

**Mapa de status:**

| Status | Significado |
|---|---|
| `400` | Falha de validação (com `issues`) |
| `404` | Slug não existe |
| `409` | Slug já cadastrado, ou slug reservado (§4.3.1) |
| `422` | Requisição válida que não pode ser cumprida — hoje, exportar sem links (D13) |

O objeto `Link`, usado em todas as respostas de sucesso que devolvem um link:

```ts
type Link = {
  originalUrl: string
  slug: string
  accessCount: number
  createdAt: string // ISO 8601
}
```

O `id` da tabela nunca aparece neste objeto (decisão D6).

#### `POST /links`

Cria um link.

- **Body:** `{ originalUrl: string, slug: string }`
- **201:** `Link`
- **400:** `originalUrl` não é URL válida, ou `slug` fora do formato
- **409:** `slug` já cadastrado, ou `slug` reservado (§4.3.1)

Validação:
- `originalUrl`: URL válida (`z.url()`)
- `slug`: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 3 a 32 caracteres

O slug é **normalizado com `.toLowerCase().trim()` antes de validar**, no schema
Zod (`z.string().trim().toLowerCase().regex(...)`). Digitar `MeuLink` produz
`meulink`, não um erro de validação. Sem isso, `Foo` e `foo` seriam slugs
distintos — o caminho de uma URL é case-sensitive, e duas entradas que se leem
igual apontando para destinos diferentes é armadilha para o usuário.

#### 4.3.1 Slugs reservados

A rota `/:slug` reivindica a raiz do domínio para dados criados pelo usuário,
mas o front também precisa da raiz para suas próprias rotas. Os dois disputam o
mesmo espaço de nomes, e o roteador resolve o empate em favor da rota estática.

Sem defesa, o resultado é uma falha silenciosa: criar um link com slug
`not-found` **é aceito pela API**, o link aparece na lista, o botão de copiar
funciona — e abrir a URL mostra a página de "link não encontrado". Para sempre,
sem erro em lugar nenhum.

A blocklist é derivada da **topologia de publicação** (D16): a URL curta é
`${FRONTEND_URL}/${slug}`, então um slug colide com caminhos servidos pelo
**front**, não pela API. Com front e API em portas distintas, a lista contém um
único item:

```ts
export const RESERVED_SLUGS = ['assets'] as const
```

`assets` está na lista porque o Vite emite os arquivos compilados sob `/assets/`
— é caminho ocupado pelo servidor estático, não uma rota do React.

**Não** são reservados:

| Candidato | Por que fica de fora |
|---|---|
| `not-found` | A tela de link não encontrado é renderizada **dentro** da rota `/:slug` quando a API devolve 404. Não existe rota estática `/not-found` (§5.3). |
| `api`, `docs` | São rotas do servidor, em outra origem. Só colidiriam se front e API compartilhassem domínio atrás de um proxy reverso. |

**A lista precisa crescer junto com as rotas do front.** Adicionar uma página
`/sobre` sequestraria qualquer link `sobre` já criado; publicar a API sob
`/api/` no mesmo domínio exigiria reservar `api`. Um teste confronta a blocklist
com a tabela de rotas do front, para que as duas não divirjam em silêncio.

Serviços reais evitam o problema separando os domínios (`bit.ly/abc` encurta,
`app.bitly.com` administra). O enunciado exige `/:url-encurtada` na raiz, então
o conflito é herdado e a reserva explícita é a única defesa.

#### `GET /links`

Lista os links, mais recentes primeiro.

Paginação **keyset** (decisão A1).

- **Query:** `cursor` (opcional, opaco), `limit` (default `20`, min `1`, max `100`)
- **200:** `{ links: Link[], nextCursor: string | null }` — `null` indica fim da lista

#### Por que keyset e não offset

`OFFSET` expressa uma **posição**, e posição não é identidade: significa "pule as
N primeiras linhas *do resultado de agora*". Como a home exibe o formulário de
criação e a lista na mesma tela, criar um link enquanto o usuário rolou desloca
todas as linhas — a próxima página devolve um item já exibido. Remover produz o
inverso, pulando um item. Em profundidade, `OFFSET` ainda obriga o Postgres a
varrer e descartar todas as linhas anteriores.

Keyset ancora numa **linha real**: "me dê o que vem depois deste registro".
Inserções e remoções em qualquer ponto da lista não movem a âncora.

#### Formato da âncora

`created_at` sozinho não serve como âncora: dois links criados no mesmo instante
empatam, e a comparação descartaria ou repetiria ambos. A âncora é o par
`(created_at, id)`, que é único porque `id` é único:

```sql
WHERE created_at < :cursorCreatedAt
   OR (created_at = :cursorCreatedAt AND id < :cursorId)
ORDER BY created_at DESC, id DESC
LIMIT :limit
```

Índice de suporte: `(created_at DESC, id DESC)` — composto, na mesma ordem do
`ORDER BY`, para que o Postgres percorra sem ordenar.

O `cursor` trafega como string opaca (base64 de `{ createdAt, id }`). Opaca por
disciplina de contrato: o cliente não deve construir nem interpretar cursores, e
manter o formato interno invisível permite mudá-lo sem quebrar o front. O `id`
aparece dentro dele, mas codificado — não viola D6, que trata do `id` como
identificador de recurso na API.

**Trade-off aceito:** keyset não fornece contagem total nem salto direto para a
página N. Nenhum dos dois existe em scroll infinito, que é o que o Figma
especifica.

#### `GET /links/:slug`

Resolve o slug para a URL original. **Não** incrementa o contador.

- **200:** `Link`
- **404:** slug não existe

#### `PATCH /links/:slug/visits`

Incrementa o contador de acessos em 1.

- **204:** sem corpo
- **404:** slug não existe

O incremento é uma operação separada da resolução porque o enunciado lista
"obter a URL original" e "incrementar a quantidade de acessos" como duas
funcionalidades distintas, tanto no back quanto no front.

O incremento usa `UPDATE ... SET access_count = access_count + 1 ... RETURNING`,
numa única instrução. Duas razões: a soma acontece no banco, nunca
ler-modificar-escrever na aplicação (que perderia contagens sob acessos
concorrentes); e o `RETURNING` vazio já sinaliza "slug inexistente", dispensando
um `SELECT` prévio.

O use-case retorna `makeRight({ accessCount })` — **não** `makeRight(undefined)`
(D7). A rota descarta o valor e responde 204.

#### `DELETE /links/:slug`

Remove um link.

- **204:** sem corpo
- **404:** slug não existe

Implementado como `DELETE ... WHERE slug = $1 RETURNING id`, numa única
instrução. Um `SELECT` seguido de `DELETE` abriria janela para corrida entre as
duas queries e custaria uma ida a mais ao banco.

O use-case retorna `makeRight(true)`, pelo mesmo motivo de D7.

#### `POST /links/exports`

Gera o CSV, envia ao R2 e devolve a URL pública.

- **200:** `{ reportUrl: string }`
- **422:** não há links a exportar (D13)

O arquivo é enviado ao R2 com o cabeçalho `Content-Disposition: attachment`.
Isso não é cosmético — é o que permite ao front iniciar o download com
`window.location.assign(reportUrl)` sem sair da página, evitando o bloqueio de
popup descrito em §5.4.

### 4.4 Arquitetura de camadas

```
server/
├── drizzle.config.ts                   # schema + out: src/infra/db/migrations
├── Dockerfile
├── .dockerignore
├── .env.example
├── .env.test.example                   # DATABASE_URL do banco brevly_test
├── vitest.config.ts                    # tsconfig-paths, globalSetup, sem paralelismo
└── src/
    ├── env.ts                          # Zod valida process.env no boot
    ├── test/
    │   ├── global-setup.ts             # roda migrations no banco de teste
    │   ├── setup.ts                    # beforeEach: TRUNCATE links
    │   └── factories/
    ├── app/
    │   ├── use-cases/
    │   │   ├── create-link.ts
    │   │   ├── list-links.ts
    │   │   ├── get-link-by-slug.ts
    │   │   ├── increment-link-visits.ts
    │   │   ├── delete-link.ts
    │   │   └── export-links.ts
    │   └── errors/
    │       ├── slug-already-exists.ts
    │       ├── link-not-found.ts
    │       └── no-links-to-export.ts
    ├── infra/
    │   ├── db/
    │   │   ├── index.ts                # exporta db (drizzle) E pg (driver, p/ cursor)
    │   │   ├── schema.ts               # tabela links
    │   │   └── migrations/
    │   ├── http/
    │   │   ├── server.ts               # bootstrap Fastify
    │   │   └── routes/                 # uma rota por arquivo
    │   └── storage/
    │       ├── client.ts               # S3Client apontando para o R2
    │       └── upload-file-to-storage.ts
    ├── shared/
    │   └── either.ts                   # makeLeft, makeRight, isLeft, unwrapEither
    └── scripts/
        └── seed.ts
```

**Regra de dependência:** `app/` não importa nada de `infra/http/`. Use-cases
recebem o que precisam por parâmetro e retornam `Either`. Rotas traduzem
`Either` → status HTTP. Isso é o que torna os use-cases testáveis sem servidor.

#### 4.4.1 Contrato do `Either` — restrição obrigatória

A implementação canônica discrimina os dois lados por presença de campo:

```ts
export const isLeft  = <T, U>(e: Either<T, U>): e is Left<T>  => e.left  !== undefined
export const isRight = <T, U>(e: Either<T, U>): e is Right<U> => e.right !== undefined
```

Consequência: **`undefined` deixa de ser um valor representável dentro do
`Either`**. Um `makeRight(undefined)` produz um valor em que `isLeft()` e
`isRight()` retornam ambos `false`, e o `unwrapEither` lança
`"Received no left or right values at runtime"`.

O TypeScript não protege contra isso — `Either<Error, void>` compila
normalmente, porque o tipo não expressa a dependência da implementação em
`!== undefined`. É um erro que só aparece em runtime.

**Regra:** todo use-case devolve valor não-`undefined` no caminho de sucesso.
Quando não há nada a retornar, o tipo é `Either<Error, true>` e o valor é
`makeRight(true)`.

| Use-case | Tipo de sucesso |
|---|---|
| `create-link` | `Link` |
| `list-links` | `{ links, nextCursor }` |
| `get-link-by-slug` | `Link` |
| `increment-link-visits` | `{ accessCount: number }` |
| `delete-link` | `true` |
| `export-links` | `{ reportUrl: string }` |

**Mapa de erro → status:**

| Erro do domínio | Status HTTP |
|---|---|
| `SlugAlreadyExists` | 409 |
| `SlugIsReserved` | 409 |
| `LinkNotFound` | 404 |
| `NoLinksToExport` | 422 |
| Falha de validação Zod | 400 |

### 4.5 Exportação de CSV

Pipeline em streaming, com uso de memória constante independente do volume:

```
Postgres (cursor) → Transform → csv-stringify → PassThrough → lib-storage.Upload → R2
```

#### Cursor real, não paginação em lote

O cursor precisa ser um cursor de verdade do Postgres. A alternativa aparente —
um gerador que percorre a tabela com `LIMIT n OFFSET k` crescente — tem dois
defeitos: é O(n²), porque o Postgres varre e descarta todas as linhas anteriores
a cada lote; e não garante snapshot consistente, de forma que inserções durante
a exportação fazem linhas serem duplicadas ou puladas.

O driver `postgres-js` expõe cursor, mas o Drizzle não. A saída é gerar o SQL
pelo Drizzle e executá-lo pelo driver:

```ts
// infra/db/index.ts precisa exportar o driver, além do db
export const pg = postgres(env.DATABASE_URL)
export const db = drizzle(pg, { schema })

// no use-case
const { sql, params } = db
  .select({ ... })
  .from(schema.links)
  .orderBy(desc(schema.links.createdAt))
  .toSQL()

const cursor = pg.unsafe(sql, params as string[]).cursor(50)
```

**Consequência que precisa estar clara antes de implementar:** `pg.unsafe`
passa por baixo do mapeamento do Drizzle, então as linhas voltam com os nomes
de coluna **do banco** (`snake_case`), não com os nomes do schema TypeScript. O
cursor entrega `original_url`, `access_count`, `created_at` — não `originalUrl`,
`accessCount`, `createdAt`. As chaves declaradas no `csv-stringify` e o código
do `Transform` seguem essa convenção.

#### Composição do arquivo

- **Nome (`key` no bucket):** `exports/${randomUUID()}-links.csv`. O componente
  aleatório é exigido pelo enunciado e não é decorativo: um nome derivado só de
  data e hora faz duas exportações próximas colidirem e sobrescreverem uma à
  outra no bucket. O prefixo `exports/` é o alvo da regra de ciclo de vida
  (§4.5.1).
- **Colunas:** URL original, URL encurtada, contagem de acessos, data de criação.
- **Coluna "URL encurtada":** o banco guarda apenas o `slug`. A URL completa é
  montada **dentro do `Transform`**, antes do `csv-stringify`, como
  `${FRONTEND_URL}/${slug}` — é o endereço que o usuário efetivamente acessa.
  Exportar o slug puro não cumpre o requisito.
- **`CLOUDFLARE_PUBLIC_URL` não entra no conteúdo do CSV.** Ela é a base do
  bucket e serve apenas para montar o link do próprio arquivo.
- **Retorno da rota:** `{ reportUrl: "${CLOUDFLARE_PUBLIC_URL}/${key}" }`.

#### Upload

O `@aws-sdk/lib-storage` (`Upload`) é obrigatório em vez de `PutObjectCommand`,
porque este último exige `Content-Length` conhecido antecipadamente — impossível
com stream de tamanho desconhecido. O `Upload` faz multipart automaticamente.

Parâmetros obrigatórios do objeto:

```ts
{
  Bucket: env.CLOUDFLARE_BUCKET,
  Key: `exports/${randomUUID()}-links.csv`,  // prefixo — ver §4.5.1
  Body: passThrough,
  ContentType: 'text/csv',
  ContentDisposition: 'attachment',  // habilita o download em §5.4
}
```

O `Upload` é iniciado **antes** de o pipeline começar a bombear dados, e ambos
são aguardados juntos:

```ts
const [uploadResult] = await Promise.all([uploadPromise, csvPipeline])
```

Iniciar o upload depois travaria: o `PassThrough` encheria o buffer sem
consumidor e o pipeline pararia por contrapressão.

#### O piso de memória é `partSize × queueSize`

O objetivo declarado do pipeline é uso de memória constante, mas o `Upload` não
repassa bytes um a um: ele **acumula `partSize` em memória** antes de enviar cada
parte, e mantém até `queueSize` partes em voo. Com os padrões (`partSize` de
5 MB, `queueSize` 4), o consumo pode chegar a **20 MB** — esse é o piso real, não
zero.

Para os volumes deste projeto (§4.5.1), o arquivo inteiro cabe abaixo de uma
parte e o `Upload` resolve com um único `PutObject`. Os padrões ficam como estão;
o que não pode acontecer é aumentar `partSize` achando que se ganha desempenho —
o efeito imediato é multiplicar o piso de memória.

### 4.5.1 Custo e crescimento no R2

#### Onde o custo realmente está

O R2 **não cobra egress**. É a diferença central em relação ao S3, e inverte a
intuição herdada de lá: servir o CSV, quantas vezes for baixado, não gera custo
de transferência.

O que é cobrado:

| Componente | Conta | No nosso uso |
|---|---|---|
| Armazenamento | GB × mês | **cresce indefinidamente** ⚠️ |
| Operações Classe A (escrita) | `PutObject`, `UploadPart`, `List*` | 1 a 3 por exportação |
| Operações Classe B (leitura) | `GetObject`, `HeadObject` | 1 por download |
| Egress | — | **gratuito** |

O R2 oferece cota mensal gratuita que cobre folgadamente o uso de um projeto
deste porte. Conferir os valores vigentes na tabela da Cloudflare; o que importa
para o design é a **estrutura**: leitura é barata, escrita é ~10× mais cara que
leitura, e armazenamento é a única linha que **acumula mês a mês**.

#### O problema: cada exportação cria um objeto e nada apaga

Cada clique em "Baixar CSV" gera um objeto novo, com nome aleatório, contendo um
dump completo da tabela. Ninguém baixa o mesmo arquivo duas vezes — depois do
download, ele é lixo que continua sendo cobrado.

Ordem de grandeza, com os 20.000 links do seed:

```
~120 bytes por linha × 20.000 linhas  ≈  2,4 MB por exportação
100 exportações durante o desenvolvimento  ≈  240 MB permanentes
```

O crescimento é monotônico: nada no fluxo remove objetos, então o armazenamento
só sobe, para sempre, mesmo com a aplicação parada.

#### Solução: regra de ciclo de vida no bucket

**Configurar uma lifecycle rule no bucket R2 que expire objetos sob o prefixo
`exports/` após 7 dias.**

Essa é a medida principal, e é deliberadamente **configuração de bucket, não
código**. Limpeza implementada na aplicação exigiria um job agendado, tratamento
de falha e um caminho a mais para testar — e falharia em silêncio no dia em que o
processo não subisse. A regra de ciclo de vida roda na infraestrutura, sem
código para manter, e mantém o armazenamento num teto estável em vez de numa
rampa.

Sete dias é folgado para o propósito: o relatório é baixado segundos após ser
gerado. A janela existe apenas para que um link já copiado não morra na mão do
usuário.

#### Prefixo dedicado

Todos os relatórios ficam sob `exports/`. Duas razões: a regra de ciclo de vida
precisa de um prefixo para mirar, e sem ele expiraria qualquer objeto que venha a
existir no bucket. Subir na raiz — como uma das referências faz — significa que
a única regra possível é "apague tudo".

#### Controles de fluxo já cobertos

- O botão de exportar fica **desabilitado durante a geração** (§5.4). Além de
  UX, é controle de custo: impede que um duplo clique vire dois dumps completos.
- A exportação é uma **mutation com `retry` desligado** no cliente (§5.4) — o
  controle de custo mais importante do lado do front.
- O `IntersectionObserver` da lista não dispara exportação; paginar não custa
  operações no R2.

#### Cache de relatório: deliberadamente descartado

A otimização óbvia — reaproveitar o último CSV quando nada mudou — **não se
aplica aqui**. `access_count` é incrementado a cada redirecionamento, então a
tabela muda continuamente enquanto os links são usados. Um cache invalidado por
conteúdo praticamente nunca acertaria, e o custo seria carregar a lógica de
invalidação sem retorno.

Registrado explicitamente para que não seja reintroduzido depois como
"melhoria".

#### Exposição dos arquivos

O `CLOUDFLARE_PUBLIC_URL` do enunciado implica **bucket com acesso público**:
qualquer pessoa com a URL lê o arquivo, sem autenticação. O nome aleatório
(UUID v4) o torna impraticável de adivinhar, mas ele permanece público enquanto
existir.

A alternativa — bucket privado e URL pré-assinada com validade curta — tem
postura de segurança melhor, mas contraria o contrato de variáveis exigido pelo
enunciado e descaracteriza o "acesso via CDN" que ele pede. Mantemos o bucket
público, e a regra de ciclo de vida passa a ter um segundo papel: **limitar a
janela de exposição a 7 dias**, não só o custo.

Os CSVs contêm apenas dados já públicos (URLs encurtadas e suas contagens), sem
informação pessoal — o que torna o risco aceitável neste projeto. Num sistema com
dados de usuário, a URL pré-assinada seria obrigatória.

#### Fora de escopo

A exportação é **síncrona**: a requisição HTTP fica aberta durante a varredura e
o upload. Com dezenas de milhares de linhas isso leva menos de um segundo. Numa
ordem de grandeza muito maior, o caminho correto seria enfileirar um job e
notificar o usuário quando o arquivo ficasse pronto — desnecessário aqui, e
registrado apenas para deixar claro que a escolha foi consciente.

### 4.6 Variáveis de ambiente

`server/.env.example` — as 7 chaves exigidas pelo enunciado, literalmente:

```env
PORT=3333
DATABASE_URL=

CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_ACCESS_KEY_ID=""
CLOUDFLARE_SECRET_ACCESS_KEY=""
CLOUDFLARE_BUCKET=""
CLOUDFLARE_PUBLIC_URL=""
```

Uma chave adicional, necessária para funcionamento correto e ausente do
enunciado:

```env
FRONTEND_URL=http://localhost:5173   # origem permitida no CORS e base da URL encurtada no CSV
```

Todas validadas com Zod em `src/env.ts`, que falha no boot se algo faltar.

### 4.7 Scripts (`server/package.json`)

| Script | Comando |
|---|---|
| `dev` | `tsx watch src/infra/http/server.ts` |
| `build` | `tsc` |
| `start` | `node dist/infra/http/server.js` |
| `db:generate` | `drizzle-kit generate` |
| **`db:migrate`** | `drizzle-kit migrate` ← **chave exata exigida** |
| `db:studio` | `drizzle-kit studio` |
| `db:seed` | `tsx src/scripts/seed.ts` |
| `db:migrate:test` | `dotenv -e .env.test -- drizzle-kit migrate` |
| `test` | `dotenv -e .env.test -- vitest run` |
| `test:watch` | `dotenv -e .env.test -- vitest` |
| `lint` | `eslint src` |
| `format` | `prettier --write src` |

O `db:migrate` sem sufixo aponta para o banco de desenvolvimento. A suíte de
testes nunca deve migrar ou truncar o banco de dev — daí o par separado
`db:migrate:test` / `test`, ambos carregando `.env.test`.

O `db:seed` insere **20.000 links** em lotes de 5.000, com `created_at`
escalonado. O volume é deliberado: o requisito de "listagem performática" só é
demonstrável com dados suficientes para que paginação e índice façam diferença
observável. Com 20 registros, qualquer implementação parece rápida.

### 4.8 DevOps

**`server/Dockerfile`** — multi-stage:
- Estágio `builder`: base `node:22-alpine`, instala todas as dependências,
  compila TypeScript.
- Estágio `runtime`: mesma base, copia apenas `dist/` e dependências de
  produção, **roda como usuário non-root**, expõe `PORT`.
- `.dockerignore` excluindo `node_modules`, `dist`, `.env`.

A tag é `node:22-alpine` (LTS), não a versão local (Node 25). A versão usada em
desenvolvimento não deve determinar a de produção, e a imagem precisa ser
reprodutível independente da máquina de quem builda.

O usuário non-root é o item mais fácil de esquecer aqui — a imagem funciona
perfeitamente sem ele, e o enunciado pede explicitamente "seguindo as boas
práticas".

**`docker-compose.yml`** (raiz):
- Serviço `postgres` com `healthcheck` (`pg_isready`) e volume nomeado.
- Serviço `server`, com `depends_on: postgres: condition: service_healthy`.
- Serviço `migrate` sob o profile `tools`: container de execução única que roda
  `pnpm db:migrate` e encerra, também condicionado ao healthcheck do Postgres.

As migrations rodam **num serviço separado**, não no entrypoint do `server`.
Isso mantém a imagem da aplicação com uma única responsabilidade e torna o
momento de migrar uma decisão explícita (`pnpm docker:db:migrate`) em vez de um
efeito colateral de subir o container.

**Volume do Postgres:** montar em `/var/lib/postgresql/data`, que é o `PGDATA`
padrão da imagem oficial. Montar o diretório pai (`/var/lib/postgresql`) é um
erro silencioso — o container sobe normalmente, mas os dados podem não persistir
entre `docker compose down` e `up`. **Verificar na primeira subida:** criar um
link, derrubar, subir, conferir se o link continua lá.

**CORS:** `@fastify/cors` habilitado, com `origin` derivado de `FRONTEND_URL`,
aceitando lista separada por vírgula (dev e produção convivem).

Usar `origin: '*'` seria mais simples e não há credenciais em jogo aqui, mas
restringir é a prática correta. O custo é um modo de falha novo: `FRONTEND_URL`
mal configurada bloqueia o front com um erro de CORS no navegador e nenhum sinal
no servidor. Para mitigar, a aplicação **loga as origens permitidas no boot**.

**Logs:** usar o logger do Fastify (`app.log.error`), não `console.error`. O
logger sai estruturado e correlacionado com a requisição; `console` perde os
dois.

**Documentação da API:** `@fastify/swagger` com `jsonSchemaTransform` do
`fastify-type-provider-zod`, servido por `@scalar/fastify-api-reference` em
`/docs`. Não é exigido pelo enunciado, mas os schemas Zod já estão declarados
nas rotas — a documentação sai praticamente de graça e dá ao avaliador uma
forma de exercitar a API sem ler o código.

### 4.9 Testes

Vitest cobrindo os 6 use-cases contra um banco de teste isolado, com factories
para gerar links.

#### Isolamento — pré-requisito, não refinamento

Os use-cases conversam com um Postgres real, então o estado é compartilhado
entre testes por padrão. Sem limpeza explícita, testes que verificam **estado
vazio** — lista sem links, exportação sem links — passam na primeira execução e
falham em todas as seguintes, contra um banco que nunca esvazia. É o pior modo
de falha possível, porque se parece com instabilidade aleatória.

Setup obrigatório:

- **`.env.test`** com `DATABASE_URL` apontando para um banco separado
  (`brevly_test`), carregado via `dotenv-cli` no script `test`.
- **`vitest.config.ts`** com `vite-tsconfig-paths` (para os aliases `@/`) e
  `globalSetup` rodando as migrations no banco de teste antes da suíte.
- **`beforeEach`** executando `TRUNCATE links RESTART IDENTITY CASCADE`.
- **`fileParallelism: false`.** Todos os arquivos de teste compartilham o mesmo
  banco; em paralelo, o `TRUNCATE` de um arquivo apaga as linhas que outro
  acabou de inserir.

Com `TRUNCATE` por teste, factories podem gerar slugs determinísticos. Gerar
slugs aleatórios para evitar colisão é um contorno da ausência de isolamento,
não uma solução — ele torna impossível qualquer asserção sobre o conjunto
completo de dados.

Casos mínimos:

- `create-link`: sucesso · slug malformado · slug duplicado · URL inválida
- `list-links`: ordenação por `created_at` desc · lista vazia · `nextCursor` é
  `null` na última página · **um item criado entre duas páginas não duplica nem
  esconde outro** (a regressão que motivou o keyset) · empate de `created_at`
  desempatado por `id`, sem item perdido
- `get-link-by-slug`: sucesso · não encontrado
- `increment-link-visits`: incrementa em 1 · não encontrado
- `delete-link`: sucesso · não encontrado
- `export-links`: gera CSV com as 4 colunas · nome único entre chamadas
  consecutivas · coluna "URL encurtada" contém a URL completa, não o slug ·
  lista vazia retorna `NoLinksToExport`
- `reserved-slugs`: toda rota estática do front está na blocklist (§4.3.1) — é o
  teste que impede as duas listas de divergirem com o tempo

O use-case de export recebe o uploader por parâmetro, de forma que os testes
usam um duplo em memória e não dependem de credenciais do R2.

---

## 5. Front-end

### 5.1 Stack

Obrigatória: TypeScript, React, Vite (SPA, sem framework).

Complementar: TailwindCSS v4, React Router v7, TanStack Query, React Hook Form,
Zod, `@phosphor-icons/react`, `sonner`, `tailwind-variants`, ESLint, Prettier.

`tailwind-variants` reexporta `cn`, então `clsx` e `tailwind-merge` não entram
como dependências diretas.

Ícones sempre de `@phosphor-icons/react`. O subcaminho
`@phosphor-icons/react/dist/ssr` existe para renderização no servidor; misturar
os dois numa SPA duplica ícones no bundle.

**Lint:** regra `no-console` habilitada — `console.log` de depuração esquecido em
componente é o resíduo mais comum numa entrega.

O alias `@/` exige **duas** declarações que precisam concordar:
`resolve.alias` no `vite.config.ts` (resolve em build e dev) e `paths` no
`tsconfig.json` (resolve no compilador e no editor). Declarar só um produz ou
build quebrado ou erro vermelho no editor com build funcionando.

### 5.1.1 Design tokens

O Style Guide do Figma define a paleta e a escala tipográfica. Tokens declarados
via `@theme` do Tailwind v4 em `styles/globals.css`, consumidos como utilitários
comuns (`text-md`, `bg-blue-base`) — **sem componente `Typography` wrapper**.

#### Paleta

Cinzas de `#ffffff` a `#1f2025` (100 a 600), `--color-blue-base: #2c46b1`,
`--color-blue-dark: #2c4091`, `--color-danger: #b12c4d`.

O bloco `@theme` **zera as cores padrão do Tailwind antes de declarar as nossas**:

```css
@theme {
  --color-*: initial;   /* remove a paleta default inteira */

  --color-white: #ffffff;
  --color-gray-100: #f9f9fb;
  /* ... 200 a 600 ... */
  --color-blue-base: #2c46b1;
  --color-blue-dark: #2c4091;
  --color-danger: #b12c4d;
}
```

Sem o `--color-*: initial`, declarar apenas `gray-100` a `gray-600` deixa
`gray-700`, `gray-800` e `gray-900` do Tailwind vivos — **duas rampas de cinza
diferentes convivendo no mesmo projeto**, e nada avisa quando uma delas é usada
por engano. Zerando primeiro, qualquer cor fora do Style Guide simplesmente não
existe e a classe falha de forma visível.

#### Escala tipográfica

Cada degrau declara tamanho, entrelinha e peso **no mesmo token**, usando os
modificadores do namespace `--text-*` do Tailwind v4:

```css
@theme {
  --text-xs: 10px;
  --text-xs--line-height: 14px;
  --text-xs--font-weight: 400;

  --text-sm: 12px;
  --text-sm--line-height: 16px;
  --text-sm--font-weight: 400;

  --text-md: 14px;
  --text-md--line-height: 18px;
  --text-md--font-weight: 600;

  --text-lg: 18px;
  --text-lg--line-height: 24px;
  --text-lg--font-weight: 700;

  --text-xl: 24px;
  --text-xl--line-height: 32px;
  --text-xl--font-weight: 700;
}
```

Escrever `text-md` já aplica os três valores juntos. **O pareamento no token é
o que impede o erro de escala**: não existe caminho para aplicar um tamanho com
a entrelinha de outro degrau, porque a entrelinha não é uma classe separada.

Se a escala for transcrita do Figma manualmente, conferir que `font-size` e
`line-height` crescem **na mesma direção**. Uma escala em que a entrelinha
decresce enquanto o tamanho cresce está com os valores invertidos — no extremo,
texto de 24px com entrelinha de 14px sobrepõe as próprias linhas.

#### Fontes

**Open Sans** (corpo) e **Quicksand** (logo e títulos). As duas precisam ser
efetivamente carregadas, via `@fontsource` ou link do Google Fonts no
`index.html`. Declarar a família no CSS sem carregar o arquivo falha em
silêncio: o navegador cai no sans-serif do sistema e o layout diverge do Figma
sem nenhum erro no console.

Verificação: comparar visualmente um texto em Quicksand ao lado de um em Open
Sans. Se forem idênticos, nenhuma das duas carregou.

### 5.2 Estrutura

```
web/
├── index.html              # referencia /favicon.ico por caminho absoluto
├── public/                 # servido verbatim, sem hash (§5.2.1)
│   └── favicon.ico
└── src/
├── app/
│   ├── router.tsx
│   ├── providers.tsx
│   └── query-client.ts
├── assets/                 # importado pelos componentes, com hash (§5.2.1)
│   ├── logo.svg            # marca completa — cabeçalho da home
│   ├── logo-icon.svg       # símbolo — tela de redirect
│   └── 404.svg             # ilustração das telas de erro
├── components/ui/          # button, icon-button, text-field, spinner
├── features/
│   ├── create-link/        # form, schema, hook de mutation
│   ├── links-list/         # lista, item, empty state, skeleton, delete, CSV
│   └── redirect/           # resolução do slug + incremento
├── pages/
│   ├── home.tsx
│   ├── redirect.tsx
│   ├── link-not-found.tsx
│   └── not-found.tsx
├── lib/
│   ├── api.ts              # cliente HTTP, base em VITE_BACKEND_URL
│   ├── build-short-url.ts  # única fonte da URL curta
│   └── utils.ts
├── styles/                 # tokens do Style Guide do Figma
├── env.ts
└── main.tsx
```

### 5.2.1 Assets de imagem

#### A regra: `src/assets/` por padrão, `public/` por exceção

| | `src/assets/` | `public/` |
|---|---|---|
| Como é referenciado | `import logo from '@/assets/logo.svg'` | caminho absoluto `/favicon.ico` |
| Nome no build | com hash de conteúdo (`logo-a3f2b1.svg`) | preservado, sem hash |
| Cache | invalidação automática ao mudar o arquivo | manual — o navegador pode servir a versão antiga |
| Arquivo pequeno | inline como data URI abaixo de 4 KB, economizando uma requisição | sempre uma requisição |
| Não usado | removido do build | copiado mesmo assim |

**Padrão: `src/assets/`.** Só vai para `public/` o que precisa de URL estável e
previsível, que o bundler não pode reescrever — na prática, apenas o
`favicon.ico`, porque o `index.html` o referencia por caminho fixo.

`★` O hash de conteúdo não é detalhe de otimização: é o que permite servir o
asset com cache longo. Sem ele, trocar o logo mantém o nome do arquivo e
navegadores continuam exibindo o antigo até o cache expirar.

#### Inventário

| Arquivo | Local | Uso |
|---|---|---|
| `logo.svg` | `src/assets/` | marca completa, cabeçalho da home |
| `logo-icon.svg` | `src/assets/` | símbolo isolado, tela de redirect |
| `404.svg` | `src/assets/` | ilustração de `link-not-found` e `not-found` |
| `favicon.ico` | `public/` | ícone da aba (ICO multi-resolução: 16×16 e 32×32) |

`404.svg` é importado pelas duas páginas de erro. Como é o mesmo módulo, o build
gera **um único arquivo** — não há duplicação a evitar aqui.

#### Nenhum arquivo em dois lugares

Um asset existe em `src/assets/` **ou** em `public/`, nunca nos dois. A cópia
duplicada não gera erro e é fácil de criar: adiciona-se em `public/` para usar no
`index.html` sem perceber que o componente já importa de `src/assets/`. A partir
daí são dois arquivos que precisam ser atualizados juntos, e o dia em que só um
for trocado, a interface e a aba do navegador exibem logos diferentes.

Se o mesmo desenho é necessário nos dois contextos — como o símbolo, que serve de
favicon e aparece na tela de redirect — o arquivo em `public/` é a cópia
autoritativa para o `index.html`, e o componente importa de `src/assets/`. São
propósitos distintos: o favicon é recortado para legibilidade em 16px, o do
componente não.

#### O favicon é o símbolo, não a marca completa

`favicon.ico` usa `logo-icon.svg` como base, nunca o logotipo com texto. Um
logotipo horizontal renderizado em 16×16px vira um borrão ilegível.

#### `index.html` referencia com caminho absoluto

```html
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
```

Absoluto (`/favicon.ico`), não relativo (`./favicon.ico`). Como o mesmo
`index.html` é servido em qualquer rota pelo rewrite da SPA (§5.6), um caminho
relativo se resolve contra a rota atual — em `/meu-link` ainda funciona por
acaso, mas qualquer rota de mais de um segmento passaria a procurar o arquivo no
lugar errado.

#### Texto alternativo

| Imagem | `alt` | Razão |
|---|---|---|
| `logo.svg`, `logo-icon.svg` | `"Brev.ly"` | transmite informação: identifica o produto |
| `404.svg` | `""` (vazio) | decorativa — a página já tem um título dizendo que o link não foi encontrado |

`alt=""` não é omissão: é a marcação correta para imagem decorativa, e faz o
leitor de tela pular o elemento. Já **omitir** o atributo faz o leitor anunciar o
nome do arquivo. Descrever a ilustração de erro só repetiria, em voz, o que o
título ao lado já diz.

#### SVG como `<img>`, não como componente React

Os assets entram via `<img src={logo} />`. Não adotamos `vite-plugin-svgr`
(SVG transformado em componente), que só compensa quando o SVG precisa herdar cor
do contexto via `currentColor` — o caso dos ícones de interface, já cobertos pelo
Phosphor. Logo e ilustração têm cores fixas do Style Guide.

#### Assets de documentação ficam fora de `web/`

Capturas de tela e diagramas do README pertencem ao repositório, não à
aplicação — nunca são servidos ao navegador. Ficam em `docs/assets/`, fora de
`web/`, para não entrarem no build nem no bundle.

Convém manter esses arquivos enxutos: um GIF de demonstração de centenas de
kilobytes pesa em todo `git clone`, para sempre, mesmo que depois seja removido.

### 5.2.2 Componentes de UI

#### Variantes tipadas com `tailwind-variants`

`Button` e `IconButton` declaram variantes com `tv()`, que devolve props
tipadas via `VariantProps` e já resolve o merge de classes (reexporta `cn`,
dispensando `clsx` + `tailwind-merge` diretamente).

`Button`: `variant` (`primary` | `secondary` | `destructive`) × `density`
(`default` | `compact`). Montar as variantes como objeto solto dentro de um `cn()`
funciona, mas não impede passar um nome de variante que não existe.

#### Estado visual vem do CSS, não do React

Foco, preenchimento e desabilitado **não** são espelhados em `useState`. O
navegador já mantém esses estados e os expõe como pseudo-classes:

| Estado | Origem |
|---|---|
| foco dentro do campo | `:focus-within` (via `group-focus-within:`) |
| campo vazio | `:placeholder-shown` |
| desabilitado | `:disabled` |
| erro de validação | `data-error` — único que não existe no DOM, vem do Zod |

Duplicar isso em React cria uma cópia que pode dessincronizar. O caso concreto:
um `useState` de "tem valor" atualizado apenas em `onChange` fica errado quando o
valor chega por **autofill do navegador**, por `setValue` do React Hook Form, por
`defaultValue` ou pelo reset após o submit — o campo tem conteúdo e o estilo diz
que não tem. Ler do CSS elimina a categoria inteira, e de quebra evita
re-render a cada tecla e a cada foco.

#### Acessibilidade — mínimos obrigatórios

- **`focus-visible`** com anel visível em todo elemento interativo. Sem isso, quem
  navega por teclado não sabe onde está. `hover:` sozinho não cobre.
- **`aria-label`** nos botões de ícone (copiar, deletar). `title` produz tooltip
  no mouse mas não é anunciado de forma confiável por leitor de tela.
- **`disabled:pointer-events-none`** em vez de `disabled:cursor-not-allowed`:
  desliga o `hover` sozinho, dispensando prefixar `enabled:` em cada regra.
- **`prefers-reduced-motion`** desativa spinner e o gradiente da barra de
  carregamento.

#### Carregamento no botão sem layout shift

O spinner é sobreposto ao conteúdo em `absolute inset-0` com `bg-inherit`, não
colocado no lugar do texto. Assim o botão mantém a largura ao entrar em
carregamento — trocar "Salvar" por um spinner encolhe o botão e desloca o que
está ao lado.

#### `buildShortUrl(slug)` — fonte única

A URL curta é montada **num só lugar**, a partir de `VITE_FRONTEND_URL`:

```ts
export const buildShortUrl = (slug: string) => `${env.VITE_FRONTEND_URL}/${slug}`
```

Usada para exibir na lista e para copiar. Sem essa centralização, o texto
exibido tende a virar uma string fixa (`brev.ly/`), o valor copiado tende a usar
`window.location.origin`, e o CSV usa o `FRONTEND_URL` do servidor — três
derivações da mesma URL, que divergem assim que o domínio publicado não é o
esperado.

### 5.3 Rotas

| Rota | Comportamento |
|---|---|
| `/` | Card de cadastro + card "Meus links": lista paginada com scroll infinito, empty state, skeleton na carga, botão de download do CSV. |
| `/:slug` | `GET /links/:slug` → `PATCH /links/:slug/visits` com `keepalive` → redireciona via `window.location.replace`. Em `404`, renderiza a tela de link não encontrado **sem navegar**. |
| `*` | Página "Página não encontrada". |

São **três rotas**, e nenhuma delas é estática além da raiz. Isso é o que mantém
a blocklist de slugs reservados reduzida a `assets` (§4.3.1).

#### A tela de erro é renderizada no lugar, não é uma rota

O padrão usual — e o das duas implementações de referência — é ter uma rota
estática `/not-found` e navegar até ela quando a API devolve 404. Não fazemos
isso, por duas razões:

1. **A rota estática cria a colisão de namespace.** `/not-found` venceria
   `/:slug` na resolução do roteador, tornando o apelido `not-found`
   permanentemente inalcançável — e exigindo reservá-lo no servidor.
2. **Navegar descarta a informação do erro.** Indo para `/not-found`, a URL
   deixa de mostrar qual apelido falhou; recarregar a página não tenta de novo.
   Renderizando no lugar, a URL continua sendo `/meu-link` e um F5 refaz a
   consulta — o que importa quando a falha foi transitória.

A tela exibida é a mesma do Figma; o que muda é não haver navegação.

#### Discriminar 404 de falha de transporte

Nem toda falha da consulta significa "link inexistente":

| Situação | Tela |
|---|---|
| `404` da API | "Link não encontrado" — o apelido não existe, foi removido ou é inválido |
| Erro de rede, `5xx`, timeout | "Não foi possível carregar o link", com botão **Tentar novamente** |

Tratar as duas como 404 — como as duas referências fazem — informa ao usuário
que um link **válido** não existe, e o leva a desistir dele. A distinção sai do
status da resposta:

```ts
const isNotFound = error instanceof ApiError && error.status === 404
```

`retry: false` na query de resolução: repetir automaticamente um 404 é inútil, e
atrasa a exibição da mensagem correta.

#### Duas telas de erro distintas, não uma

| Rota | Título | Quando |
|---|---|---|
| `/:slug` (404 da API) | **Link não encontrado** | o apelido não existe |
| `*` | **Página não encontrada** | o caminho não corresponde a rota nenhuma |

Reaproveitar um componente só para os dois casos faz `/caminho/errado` exibir
uma mensagem sobre links — texto errado para a situação. Os dois estados são
semanticamente diferentes e têm telas próprias no Figma.

#### Tabela de rotas como fonte única

As rotas são declaradas num objeto exportado, não espalhadas em strings:

```ts
export const ROUTES = {
  home: '/',
  redirect: '/:slug',
  notFound: '*',
} as const
```

É daqui que sai a lista de caminhos estáticos usada para conferir a blocklist do
servidor (§4.3.1). Sem uma fonte única, as duas listas divergem em silêncio — foi
exatamente o que aconteceu na primeira redação deste documento, em que a
blocklist foi copiada de uma referência com tabela de rotas diferente.

#### Lista com scroll infinito

A lista consome a paginação keyset (§4.3) via `useInfiniteQuery` do TanStack
Query:

```ts
useInfiniteQuery({
  queryKey: ['links'],
  queryFn: ({ pageParam }) => fetchLinks({ cursor: pageParam, limit: 20 }),
  initialPageParam: undefined,
  getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
})
```

Criar ou deletar um link invalida `['links']`, o que refaz a busca a partir da
primeira página.

**O container de scroll é o `<ul>`, não a janela.** O Figma mostra a lista com
rolagem própria dentro do card (`max-h-*` + `overflow-auto`), então o
`IntersectionObserver` que dispara a próxima página precisa receber
`root: <o elemento da lista>`. Com o `root` padrão (viewport), o sentinela nunca
entra em interseção — a lista simplesmente para de carregar ao chegar no fim, sem
erro.

#### Dois indicadores de carregamento, não um

| Estado do TanStack Query | Situação | Indicador |
|---|---|---|
| `isPending` | primeira carga, nada em cache | skeleton de 5 linhas |
| `isFetching && !isPending` | revalidando com dado já em tela | barra fina no topo do card |
| `isFetchingNextPage` | carregando página seguinte | spinner no rodapé da lista |

A distinção importa: disparar o skeleton por `isFetching` faz a lista inteira
desaparecer e reaparecer **a cada criação ou remoção de link**, porque a
invalidação da query conta como fetch. O usuário perde a posição de rolagem e o
contexto visual numa ação que deveria ser incremental.

#### O incremento precisa de `keepalive`

Disparar o `PATCH` sem `await` e navegar em seguida **não funciona**: ao iniciar
a navegação, o navegador aborta as requisições em voo da página que está sendo
descartada. O incremento passa a depender de o socket ter esvaziado a tempo, ou
seja, a contagem sobe de forma intermitente — pior que não subir, porque passa
nos testes manuais e falha em produção sem deixar rastro.

A flag `keepalive` existe exatamente para este caso: instrui o navegador a
concluir a requisição mesmo após o descarregamento da página.

```ts
await fetch(`${env.VITE_BACKEND_URL}/links/${slug}/visits`, {
  method: 'PATCH',
  keepalive: true,
})

window.location.replace(originalUrl)
```

`navigator.sendBeacon` resolveria o mesmo problema, mas só emite `POST` — usá-lo
exigiria distorcer o contrato da API para acomodar uma limitação do cliente.

#### `replace`, não `href` (D14)

```
href     histórico: [origem, /meu-link, destino]
         Voltar → /meu-link → redireciona de novo → preso

replace  histórico: [origem, destino]
         Voltar → origem ✓
```

`href` empilha a página de redirect no histórico. Como essa página redireciona
assim que monta, cada clique em Voltar a reexecuta — o usuário não consegue sair
pelo botão do navegador.

A tela de redirect também oferece um link manual (`Não foi redirecionado?
Acesse aqui`) apontando para a URL original, como saída caso o redirecionamento
automático seja bloqueado.

### 5.4 Requisitos de UX

- **Empty state** na lista quando não há links cadastrados.
- **Skeleton** durante a carga inicial da lista.
- **Botões desabilitados** enquanto a mutation correspondente está em voo
  (criar, deletar, exportar).
- **Toasts** (`sonner`) para erros de API e confirmação de cópia.
- **Copiar para a área de transferência** no item da lista.
- **Diálogo de confirmação** antes de deletar.
- **Mobile first**, responsivo de 360px a desktop.
- Layout fiel ao Figma.
- **URLs longas quebram** (`break-all`) — sem isso, uma URL original extensa
  estoura o card no mobile.
- **Contagem pluralizada:** `0 acessos`, `1 acesso`, `2 acessos`.

#### A exportação é uma mutation, nunca uma query

```ts
useMutation({ mutationFn: exportLinks, retry: 0 })
```

Modelar a exportação com `useQuery` — mesmo com `enabled: false` e disparo
manual por `refetch()` — é um erro de categoria com custo real.

O TanStack Query trata queries como **seguras de repetir**, e por isso o padrão
delas é `retry: 3` com backoff; mutations, que assumem efeito colateral, têm
padrão `retry: 0`. Mas `POST /links/exports` não é idempotente: cada chamada
varre a tabela inteira e cria um objeto novo no R2. Se a resposta falhar por
timeout depois de o upload ter concluído, o retry automático refaz tudo — **um
clique do usuário vira até quatro CSVs no bucket**, três deles órfãos.

`retry: 0` é explicitado mesmo sendo o padrão de mutations, para deixar a
intenção legível: aqui, repetir custa dinheiro.

#### Download do CSV sem bloqueio de popup

A sequência natural — `POST /links/exports`, esperar a resposta, criar um `<a>`
e clicar nele por script — é bloqueada por navegadores. O clique sintético
acontece dentro de um callback assíncrono, muito depois do clique real do
usuário, e deixa de ser considerado gesto confiável.

Como o objeto sobe ao R2 com `Content-Disposition: attachment` (§4.3), basta:

```ts
window.location.assign(reportUrl)
```

O cabeçalho faz o navegador **baixar** em vez de navegar, então a aplicação
permanece aberta e nenhum popup é aberto para ser bloqueado.

### 5.5 Variáveis de ambiente

`web/.env.example`:

```env
VITE_FRONTEND_URL=http://localhost:5173
VITE_BACKEND_URL=http://localhost:3333

# Opcional, apenas em desenvolvimento: atraso artificial no interceptor da API,
# para tornar visíveis os skeletons e estados de carregamento.
VITE_API_DELAY_MS=0
```

Validadas com Zod em `src/env.ts`.

**`VITE_FRONTEND_URL` tem uso obrigatório**, não é declaração decorativa: é a
base da URL curta exibida na lista e copiada para a área de transferência
(`${VITE_FRONTEND_URL}/${slug}`). Usar `window.location.origin` no lugar dela
funcionaria, mas deixaria no `.env.example` uma chave exigida pelo enunciado e
nunca lida pelo código.

**Ela precisa coincidir com `FRONTEND_URL` do back-end.** A mesma URL curta é
derivada em dois lugares — o front a exibe, o back a escreve na coluna "URL
encurtada" do CSV. Se as duas divergirem, a interface e o relatório mostram
endereços diferentes para o mesmo link. O README documenta as duas juntas.

### 5.6 Deploy do front — rewrite obrigatório

A aplicação é uma SPA cuja funcionalidade central é o acesso direto a
`/:slug`. Num servidor estático, abrir `https://app.com/meu-link` faz o servidor
procurar um arquivo nesse caminho, não encontrar e devolver 404 — **o React
nunca carrega, então o React Router nunca vê a rota**.

O sintoma é traiçoeiro porque não aparece em desenvolvimento: o dev server do
Vite já faz esse fallback. A falha só surge no ambiente publicado.

O host precisa reescrever todas as rotas desconhecidas para `index.html`:

| Host | Configuração |
|---|---|
| nginx | `try_files $uri $uri/ /index.html;` |
| Vercel | `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` em `vercel.json` |
| Netlify | `/* /index.html 200` em `public/_redirects` |

Verificação obrigatória após o deploy: abrir uma URL encurtada **numa aba nova**,
não por navegação interna a partir da home. Só o acesso direto exercita o
rewrite.

---

## 6. Fora de escopo

Nada disso é requisito nem pontua na correção:

- Autenticação e contas de usuário
- Rate limiting
- Sentry ou observabilidade
- CI/CD
- SSR (o enunciado pede SPA; SSR seria funcionalidade extra em branch separada)
- Dockerfile do front-end (o enunciado pede apenas o do back-end)

---

## 7. Dependências externas e riscos

| Item | Risco | Mitigação |
|---|---|---|
| Acesso ao Figma | O arquivo é da Community; a extração via MCP pode falhar por permissão | **Deixou de ser bloqueante.** A paleta e a escala tipográfica estão documentadas em §5.1.1 e bastam para começar. O Figma segue como autoridade para espaçamentos e composição das telas. |
| Carregamento das fontes | Open Sans e Quicksand declaradas mas não carregadas falham em silêncio, com fallback para o sans-serif do sistema | Conferir visualmente no navegador, não apenas no CSS. Um texto em Quicksand ao lado de um em Open Sans torna a diferença óbvia. |
| Rewrite da SPA no host | Sem ele, toda URL encurtada devolve 404 em produção — e o dev server esconde o problema | Testar acesso direto em aba nova logo no primeiro deploy (§5.6). |
| Credenciais do Cloudflare R2 | Bucket ainda não criado | A camada de storage recebe o uploader por parâmetro; testes usam duplo em memória. As credenciais entram só na validação manual do fluxo de export. |
| Lifecycle rule esquecida na criação do bucket | É configuração manual no painel, invisível no código — nada no repositório denuncia a ausência, e o armazenamento cresce em silêncio | Passo explícito no roteiro de criação do bucket (§4.5.1) e no README. Verificar no painel do R2 após a primeira exportação. |
| `FRONTEND_URL` no back-end | Chave não prevista no `.env.example` do enunciado | Documentada no README como adição necessária. As 7 chaves exigidas permanecem intactas. |
| Volume do Postgres no compose | Montar no diretório errado não gera erro visível, mas perde os dados entre `down`/`up` | Montar em `/var/lib/postgresql/data`. Verificar na primeira subida: criar link → `down` → `up` → conferir persistência. |
| `pg.unsafe` na exportação | Sai do mapeamento do Drizzle; nomes de coluna voltam em `snake_case` e mudanças no schema não são pegas pelo compilador | Um teste de `export-links` assertando o cabeçalho e uma linha do CSV cobre a regressão. |

---

## 8. Decisões em aberto

Nenhuma. A1 (estratégia de paginação) foi resolvida em favor de **keyset** e
está registrada como D11 na §2, com o contrato em §4.3.

---

## 9. Entrega

- Repositório público no GitHub.
- Subpastas `web/` e `server/` na raiz.
- Funcionalidades obrigatórias na branch principal.
- Eventuais extras em branch separada.
- README na raiz com instruções de setup, variáveis de ambiente e execução via
  Docker.
