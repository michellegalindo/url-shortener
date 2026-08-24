# Brev.ly — Decisões de execução: Servidor

**Data:** 2026-08-24
**Status:** Implementado
**Escopo:** Divergências encontradas entre [`PLAN-SERVER.md`](./PLAN-SERVER.md) e
a realidade durante a implementação, e o que foi decidido em cada uma

---

## Para que serve este documento

O [`DESIGN.md`](./DESIGN.md) diz **o que** construir e por quê. O
[`PLAN-SERVER.md`](./PLAN-SERVER.md) diz **como**, passo a passo. Este documento
registra o que aconteceu quando o plano encontrou o compilador, o banco e o
navegador — os pontos em que ele estava errado, se contradizia, ou prometia algo
que o código não entregava.

Vale por dois motivos. Primeiro, para que nenhuma dessas decisões precise ser
redescoberta: várias custaram uma investigação que não se repete de graça.
Segundo, porque o plano continua sendo lido — e um leitor que confie nele sem
saber destas divergências vai reintroduzir os mesmos defeitos.

**Regra de precedência usada em toda decisão:** o `DESIGN.md` é a autoridade
vinculante; o plano argumenta a partir dele. Onde os dois divergiram, o spec
venceu — inclusive contra o código literal que o plano escreveu.

---

## 1. Defeitos internos do plano

Casos em que o plano se contradizia: dois trechos seus mandavam coisas
incompatíveis, ou a prosa prometia algo que o código de exemplo não fazia.

### 1.1 O alias `@/` não compilava, e o `dist/` não rodaria

**Decisão:** `server/tsconfig.json` usa `"module": "ESNext"` e
`"moduleResolution": "Bundler"` (não `NodeNext`), com
`"tsc-alias": { "resolveFullPaths": true }`, e o script de build é
`tsc && tsc-alias`.

**O que estava errado:** o plano pedia `NodeNext`, mas todo bloco de código dele
usa import relativo sem extensão (`from './either'`) — que o `NodeNext` rejeita
em compilação — e o alias `@/`, que o `tsc` nunca reescreve no emit. As Tasks 15
e 16 exigem que `pnpm build` produza um `dist/` que o `node` execute. Com a
configuração original, o build falharia; se compilasse, o `CMD` do container
morreria num `@/env` irresolúvel.

**Por que `tsc-alias`:** resolve os dois problemas numa ferramenta — reescreve o
alias e acrescenta a extensão `.js`. Nada muda para o Vitest nem para o `tsx`,
que já resolvem alias por conta própria.

### 1.2 Nenhum arquivo `.spec.ts` resolvia `@/` — em silêncio

**Decisão:** existe um `server/tsconfig.vitest.json` de quatro linhas que estende
o `tsconfig.json` e descarta apenas o `exclude` dos specs. O `vitest.config.ts`
aponta o plugin de paths para ele.

**O que estava errado:** o `tsconfig.json` exclui `**/*.spec.ts` para que o `tsc`
não emita testes em `dist/` — correto. Mas o `vite-tsconfig-paths` usa
`include`/`exclude` do tsconfig para decidir **quais arquivos importadores**
ganham resolução de alias. Um arquivo excluído do projeto não é um arquivo cujos
imports ele reescreve. Resultado: nenhum spec resolvia `@/`, sem erro de
configuração. Dez tasks à frente escrevem `import { db } from '@/infra/db'` dentro
de specs.

**Por que um arquivo separado e não `loose: true`:** o `loose` só contorna o
filtro de extensão de arquivo, sem nenhum efeito sobre a checagem de
`include`/`exclude`. E a API do plugin não aceita include/exclude inline — o
campo `projects` exige caminho de arquivo `.json`. O arquivo separado é a única
saída pela superfície da ferramenta.

### 1.3 `linkToJson` foi prometido e nunca construído

**Decisão:** `linkToJson(link: LinkOutput)` vive em
`server/src/infra/http/schemas.ts`, ao lado do `linkSchema` que tipa exatamente
essa saída, e é usado nas três rotas que devolvem link.

**O que estava errado:** a seção *Interfaces* da Task 12 do plano diz que ela
produz `linkToJson`. O código dela inlinou a serialização, e a Task 13 repetiu o
mesmo literal de quatro campos em mais dois arquivos. Construir o helper cumpre o
contrato que o plano declarou, em vez de desviar dele.

### 1.4 O código do error handler não compilava contra o Fastify 5

**Decisão:** `app.setErrorHandler<Error>((error, request, reply) => ...)`.

**O que estava errado:** a assinatura é `setErrorHandler<TError = unknown, ...>`.
Sem o argumento de tipo, `error` chega como `unknown` e todo acesso a
`.name`/`.message` é erro de compilação. O código literal do plano não compila.

### 1.5 Um fixture de teste violava a validação do próprio plano

**Decisão:** o fixture de paginação usa `create('uno')`, não `create('um')`.

**O que estava errado:** `'um'` tem dois caracteres e o `slugSchema` exige no
mínimo três. A rota devolveria 400 e o teste de paginação falharia por motivo de
fixture — o diagnóstico natural seria caçar bug no cursor keyset ou no registro
de rota, a duas camadas da causa real.

---

## 2. Divergências entre plano e spec, resolvidas a favor do spec

### 2.1 O índice keyset existia e nunca era usado

**Decisão:** migration `0001` recria `links_created_at_id_idx` com ordenação de
nulos compatível com o `ORDER BY` das queries. As queries **não** foram alteradas.

**O que estava errado:** no Postgres, `DESC` implica `NULLS FIRST`. O `.desc()` do
Drizzle numa coluna de **índice** emite `DESC NULLS LAST`; o `desc()` num
**orderBy** emite `DESC` puro. Pathkeys incompatíveis — o índice não servia à
ordenação que existia para servir.

Medido com 20.000 linhas:

| `ORDER BY` | plano de execução | custo |
|---|---|---|
| `created_at DESC, id DESC` (o que o código emite) | `Seq Scan` + heapsort | 1246 |
| `created_at DESC NULLS LAST, ...` | `Index Scan` | 2.97 |

A API só parecia rápida porque 20.000 linhas cabem em memória. O requisito §4.7
("listagem performática") não estava cumprido, e a paginação varria a tabela
inteira a cada página — exatamente o custo O(n) que a decisão D11 escolheu keyset
para evitar.

**Por que corrigir o índice e não as queries:** o spec §4.2 especifica
`(created_at DESC, id DESC)` — `DESC` puro. Quem divergiu do spec foi o índice.
Corrigi-lo trata a causa uma vez; acrescentar `NULLS LAST` a cada `orderBy`
trataria o sintoma em cada call site e deixaria uma armadilha permanente: toda
query futura nessa tabela perderia o índice em silêncio a menos que alguém
lembrasse da incantação. Como `created_at` e `id` são ambos `NOT NULL`, a
ordenação de nulos é contabilidade do planner, não semântica de dados.

Depois da correção, o `pg_indexes` exibe `(created_at DESC, id DESC)` — o
Postgres normaliza `DESC NULLS FIRST` para `DESC` porque é o default. O índice
ficou idêntico ao texto do spec.

### 2.2 O seek do keyset ainda descartava todas as linhas anteriores

**Decisão:** a condição de paginação é comparação de tupla,
`(created_at, id) < (âncora)`, e não `or(lt, and(eq, lt))`.

**O que estava errado:** a forma booleana não vira condição de início de índice no
Postgres — é aplicada como `Filter` pós-scan. Com âncora na profundidade 10.000:

| forma | uso do índice | buffers | linhas descartadas |
|---|---|---|---|
| `or(lt, and(eq, lt))` | `Filter` sobre Index Scan | 177 | **10.001** |
| `(created_at, id) < (X, Y)` | `Index Cond` | 3 | 0 |

O spec §4.3 justifica escolher keyset com a frase *"em profundidade, `OFFSET`
ainda obriga o Postgres a varrer e descartar todas as linhas anteriores"* — e a
implementação fazia precisamente isso. O esboço de SQL do spec escreve a forma
booleana, mas a intenção declarada é o comportamento de row-value. Decidido pela
intenção, como em 2.1.

Equivalência semântica garantida porque `created_at` e `id` são `NOT NULL`: as
duas formas só divergem se alguma coluna aceitar nulo.

### 2.3 A corrida no `create-link` devolvia 500 onde o spec promete 409

**Decisão:** o `INSERT` tem um catch estreito que mapeia a violação de unicidade
do Postgres (SQLSTATE `23505`) para `Left(SlugAlreadyExists)`. O `SELECT` prévio
continua sendo o caminho comum.

**O que estava errado:** entre o `SELECT` e o `INSERT` existe uma janela. Duas
criações simultâneas do mesmo slug passam ambas pelo `SELECT` vazio, e a
perdedora recebia um erro cru do driver — que não é `Either` nem `ZodError`, e
portanto caía no fallback genérico do error handler. O spec §4.4 exige que
use-cases devolvam `Either` e §4.3 fixa 409 para slug duplicado.

A integridade dos dados nunca esteve em risco — a coluna tem `UNIQUE`. O que
variava era o status que a perdedora recebia.

**Detalhe de implementação que não é óbvio:** o Drizzle não entrega o erro do
driver diretamente; ele embrulha o `PostgresError` num `DrizzleQueryError` e move
o original para `.cause`. Um catch checando só `instanceof postgres.PostgresError`
ficaria morto. O código desembrulha as duas formas.

### 2.4 `GET /links/:slug` devolvia 400 para slug malformado

**Decisão:** essa rota usa `safeParse` e devolve `Left(LinkNotFound)` — 404 —
quando o slug não passa na validação. As rotas de `DELETE` e `PATCH` continuam
lançando `ZodError` → 400.

**O que estava errado:** o spec §4.3 documenta essa rota como 200/404 apenas, e o
§5.3 especifica que o front discrimina em `status === 404` para escolher entre
"Link não encontrado" e a tela de falha de rede com botão "Tentar novamente".
Quem acessasse `brev.ly/ab` recebia a tela de **falha de rede**, com botão de
tentar de novo, para um apelido que jamais poderia existir — exatamente o que a
decisão D18 existe para evitar.

**Por que só nessa rota:** ali o slug vem da URL que a pessoa digitou ou colou.
Nas rotas de remoção e incremento, ele vem de um link que a aplicação já listou —
um slug malformado ali é erro de quem chamou, e 400 está certo.

---

## 3. Segurança

### 3.1 URLs `javascript:` e `data:` eram aceitas

**Decisão:** `originalUrlSchema` restringe o protocolo a `http`/`https`.

**O que estava errado:** `z.url()` sem restrição aceita `javascript:`, `data:`,
`vbscript:` e `file:`. `POST /links` com
`{"originalUrl":"javascript:alert(1)"}` devolvia **201**.

Por que isso importa aqui especificamente: o endpoint é público e sem
autenticação, e o spec §5.3 manda a página de redirect renderizar esse valor como
âncora clicável ("Não foi redirecionado? Acesse aqui"). Um
`<a href="javascript:...">` clicado executa na origem da página — XSS armazenado,
entregue por uma feature que o próprio spec exige.

O servidor é a fronteira de confiança correta: nenhum encurtador sério aceita
esquemas fora de HTTP, e o front ainda não existe para se defender sozinho.

### 3.2 CORS bloqueava `DELETE` e `PATCH`

**Decisão:** o registro do CORS passa
`methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE']` explicitamente.

**O que estava errado:** o `@fastify/cors` na versão 11 estreitou o default de
`methods` para os métodos safelisted do CORS — `GET,HEAD,POST`. Como a aplicação
não passava `methods`, o preflight anunciava só esses três. `DELETE` e `PATCH`
são não-safelisted e exigem preflight, então ambos eram bloqueados:

```
OPTIONS /links/abc        (DELETE) → access-control-allow-methods: GET,HEAD,POST
OPTIONS /links/abc/visits (PATCH)  → access-control-allow-methods: GET,HEAD,POST
```

Duas das seis features exigidas — **remover link** (§5.4) e **incrementar
acessos** (§5.3, D8) — eram inutilizáveis a partir do front que o spec descreve.

**Por que passou despercebido:** os testes de rota usam `app.inject()`, que injeta
a requisição direto no roteador e **não percorre o caminho de preflight**. E as
verificações manuais usaram `curl` sem cabeçalho `Origin`. As duas formas de
verificação empregadas eram cegas para essa classe de defeito, e nem o plano nem o
spec previam um teste de CORS. Existe um agora.

### 3.3 Erros de framework do Fastify viravam 500

**Decisão:** o error handler honra `error.statusCode` quando ele está na faixa
4xx, antes do fallback 500. Os branches de `ZodError` continuam à frente dele.

**O que estava errado:** JSON malformado e `Content-Type` não suportado devolviam
**500**. O Fastify já os havia classificado como 400/415, mas o handler ignorava
`statusCode`. Três consequências: viola o mapa de status do §4.3; impede o cliente
de distinguir "mandei bytes ruins" de "o servidor quebrou"; e faz
`request.log.error` disparar em toda requisição malformada, o que permite a
qualquer cliente inundar o log.

---

## 4. Empacotamento e operação

### 4.1 O `.dockerignore` estava no lugar errado

**Decisão:** ele vive na **raiz do repositório**, não em `server/`.

**Motivo:** o Docker lê o `.dockerignore` da raiz do *contexto de build*, e o
contexto é a raiz (`docker build -f server/Dockerfile .`). Em `server/` o arquivo
seria simplesmente ignorado.

### 4.2 O serviço `migrate` não teria o `drizzle-kit`

**Decisão:** o serviço `migrate` do compose usa `target: builder` e
`command: ['pnpm','--filter','server','db:migrate']`.

**O que estava errado:** o plano mandava construir o estágio de runtime e rodar
`npx drizzle-kit migrate`. O runtime instala com `--prod` e o `drizzle-kit` é
devDependency — o `npx` não o encontraria localmente e tentaria baixá-lo da rede
em tempo de execução do container. O estágio `builder` já tem as dependências de
desenvolvimento, o `drizzle.config.ts` e as migrations.

A intenção do plano é preservada: migration continua sendo um serviço separado,
sob o profile `tools`, como decisão explícita fora do entrypoint da aplicação
(§4.8).

### 4.3 Seguir o README ao pé da letra produzia um container em loop

**Decisão:** o README declara que as cinco chaves `CLOUDFLARE_*` precisam de valor
antes de subir o servidor. O `.env.example` permanece com elas vazias.

**O que estava errado:** o `.env.example` traz as chaves vazias — correto, são as
sete chaves do enunciado e não podem ser alteradas. Mas o `env.ts` as valida com
`.min(1)`/`z.url()`, então o container lança no import, e o
`restart: unless-stopped` transforma isso em loop de reinício.

> **Pendência conhecida:** o parágrafo atual do README diz "algum valor não
> vazio", o que é insuficiente para `CLOUDFLARE_PUBLIC_URL` — essa é validada com
> `z.url()`, não `.min(1)`. Quatro chaves aceitam qualquer valor não vazio; essa
> precisa de URL válida, por exemplo `http://localhost:9999`.

### 4.4 A lacuna de verificação do R2 estava documentada onde ninguém a veria

**Decisão:** o README declara, sob "Exportação e CDN", que o caminho de upload é
verificado contra um duplo em memória — que consome o stream e afirma os bytes
reais do CSV — e que o round trip com o R2 de verdade exige credenciais que o
repositório deliberadamente não carrega.

**Motivo:** o conteúdo do CSV está provado. O que nunca foi exercitado é a
publicação real e o download pela CDN, porque exige um bucket configurado. Essa
distinção precisa estar no repositório entregue, não numa anotação de trabalho.
Documentar uma lacuna num arquivo que não se entrega não é documentar.

---

## 5. Configuração de ferramentas

### 5.1 `drizzle.config.ts` deve apontar para `links.ts`, não para o barril

**Decisão:** `schema: './src/infra/db/schemas/links.ts'`. **Não** alterar para o
barril `schemas/index.ts`.

**Motivo — e este custou uma descoberta:** apontar para o barril faz o
`drizzle-kit` enxergar **zero tabelas** e gerar `DROP TABLE "links" CASCADE`. O
barril exporta `const schema = { links }`, um objeto comum, e o loader do
`drizzle-kit` procura símbolos de tabela exportados — ele não enxerga tabela
dentro de um objeto.

**Consequência para o futuro:** ao acrescentar uma segunda tabela, liste os dois
arquivos (o campo aceita array ou glob). Não aponte para o barril. Isso é
independente do fato de o *código da aplicação* importar o barril, que continua
correto.

### 5.2 Os SVGs do front não devem ser lintados

**Decisão:** `web/src/assets/**` e `web/public/**` estão fora do linter no
`biome.json`.

**Motivo:** a regra `noSvgWithoutTitle` existe para SVG inline em JSX, que entra
na árvore de acessibilidade. O spec §5.2.1 decide que estes assets entram por
`<img src={logo} />`, nunca como componente, e já especifica o nome acessível de
cada um na tabela de `alt` — que vive na tag `<img>`, no código do front, não
dentro do arquivo `.svg`. A correção é de configuração, não de conteúdo: os SVGs
são exports do Style Guide e pertencem ao plano do front.

### 5.3 Os helpers de teste não vão para a imagem de produção

**Decisão:** `src/test/**` está no `exclude` do `tsconfig.json`.

**Motivo:** sem isso, o `dist/test/setup.js` — que contém `TRUNCATE TABLE links`
— era copiado para a imagem de runtime. Inerte, porque nada o carrega, mas não é
coisa que se embarque.

> **Pendência conhecida:** essa exclusão também tirou `in-memory-uploader.ts` e
> `setup.ts` da única checagem de tipos que roda em algum lugar. Restauração é uma
> linha no CI:
> `pnpm --filter server exec tsc -p tsconfig.vitest.json --noEmit`.

---

## 6. Pendências e itens carregados

### 6.1 Para o plano do front — não corrigível aqui

O spec §4.3.1 e §4.9 exigem **um teste que confronte a blocklist de slugs
reservados com a tabela de rotas do front**, para que as duas não divirjam em
silêncio. Esse teste não existe. Não foi alocado a nenhuma tarefa do plano do
servidor, e não pode existir ainda: `web/` tem apenas `public/` e `src/assets/`,
sem tabela de rotas. O `reserved-slugs.spec.ts` atual espelha os valores à mão.

Isso importa mais do que parece. Um slug que colida com uma rota estática do front
é criado com sucesso e fica **inalcançável para sempre, sem erro em lugar
nenhum** — é o cenário que a decisão D12 existe para prevenir, e o teste é a única
defesa contra a blocklist e as rotas divergirem no futuro. Precisa entrar nos
requisitos do plano do front explicitamente.

### 6.2 Verificações que este ambiente não pôde fazer

- **Download do CSV pela CDN** (Task 15, passo 9): exige credenciais reais do
  Cloudflare R2. Foi tentado e falhou com erro de handshake TLS contra o endpoint
  de placeholder — comportamento esperado com credenciais fictícias. O conteúdo do
  CSV está coberto por testes; a publicação real, não.
- **Regra de ciclo de vida no bucket** (D15, expiração do prefixo `exports/` em 7
  dias): é configuração de painel da Cloudflare, invisível a partir do
  repositório. Sem ela o armazenamento cresce indefinidamente, já que cada
  exportação cria um objeto novo e nada os remove. O README documenta o passo
  como obrigatório.

### 6.3 Observações registradas sem correção

- `routes/get-link-by-slug.ts` ainda declara `400: errorSchema` no mapa de
  resposta, embora depois de 2.4 a rota seja 200/404. Inerte no comportamento,
  mas a documentação OpenAPI anuncia um 400 que não acontece mais.
- A paginação por cursor tem precisão de milissegundo ponta a ponta: o cursor
  serializa um `Date` do JavaScript, enquanto `created_at` é `timestamptz` com
  precisão de microssegundo. Uma linha criada no mesmo milissegundo da âncora,
  com fração menor, pode ser pulada na virada de página. Comportamento
  pré-existente e não alterado pela correção 2.2.
- As asserções de corpo vazio nas respostas 204 guardam o **status**, não corpo
  espúrio: o Fastify remove corpo de 204 incondicionalmente, independente do que
  o handler passe para `.send()`. Estão comentadas no arquivo de teste para que
  ninguém infira uma garantia que elas não dão.

---

## 7. Evidência de verificação

Estado ao final da implementação:

| Verificação | Resultado |
|---|---|
| Suíte de testes | 101 testes em 14 arquivos |
| `pnpm lint` | limpo |
| `tsc --noEmit` | sem erros |
| `pnpm build` | `dist/` sem alias `@/` remanescente, sem `test/` |
| `EXPLAIN` da listagem | `Index Scan using links_created_at_id_idx` |
| Seek em profundidade 10.000 | `Index Cond`, 3 buffers, zero linhas descartadas |
| Imagem Docker | roda como `node`, sem binários de desenvolvimento |
| Persistência do volume | link sobrevive a `down` + `up` |

Os testes de concorrência merecem menção porque são os que provam decisões de
design em vez de comportamento superficial:

- `create-link` dispara **50 criações simultâneas** do mesmo slug e afirma
  exatamente um sucesso, 49 `SlugAlreadyExists`, zero rejeições. Falharia contra
  a implementação original.
- `increment-link-visits` dispara **20 incrementos paralelos** e afirma total
  exatamente 21. O driver abre um pool de até 10 conexões, então uma
  implementação que lesse, somasse em JavaScript e gravasse perderia contagens e
  falharia aqui.
- `export-links` exporta **120 linhas** com o cursor buscando em lotes de 50 —
  três lotes. Uma regressão que processasse só o primeiro lote produziria um CSV
  truncado em silêncio, e agora é pega.
