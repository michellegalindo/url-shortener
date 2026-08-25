<p align="center">
  <img src="./web/src/assets/logo.svg" alt="Brev.ly" width="220">
</p>

<p align="center">
  Encurtador de URLs fullstack — API REST em Fastify, interface React e exportação de relatórios via CDN.
</p>

<p align="center">
  <img alt="Node 22" src="https://img.shields.io/badge/Node-22-339933?logo=node.js&logoColor=white">
  <img alt="pnpm" src="https://img.shields.io/badge/pnpm-11-F69220?logo=pnpm&logoColor=white">
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5.9-3178C6?logo=typescript&logoColor=white">
  <img alt="Fastify" src="https://img.shields.io/badge/Fastify-5-000000?logo=fastify&logoColor=white">
  <img alt="Drizzle" src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black">
  <img alt="PostgreSQL" src="https://img.shields.io/badge/PostgreSQL-17-4169E1?logo=postgresql&logoColor=white">
  <img alt="React" src="https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black">
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white">
  <img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-4-06B6D4?logo=tailwindcss&logoColor=white">
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-4-6E9F18?logo=vitest&logoColor=white">
  <img alt="Biome" src="https://img.shields.io/badge/Biome-2-60A5FA?logo=biome&logoColor=white">
</p>

---

## Sumário

- [Visão geral](#visão-geral)
- [⚡ Início rápido](#-início-rápido)
- [🐳 Alternativa: servidor em Docker](#-alternativa-servidor-em-docker)
- [✅ Como validar os requisitos](#-como-validar-os-requisitos)
- [🧪 Testes e qualidade](#-testes-e-qualidade)
- [🌱 Seed: 20 mil links para ver a performance](#-seed-20-mil-links-para-ver-a-performance)
- [🔧 Variáveis de ambiente](#-variáveis-de-ambiente)
- [📡 API](#-api)
- [🪣 Cloudflare R2 (exportação real)](#-cloudflare-r2-exportação-real)
- [🧭 Decisões de design](#-decisões-de-design)

---

## Visão geral

O Brev.ly permite cadastrar, listar e remover links encurtados, redirecionar
`/:slug` para a URL original contando cada acesso, e exportar todos os links
em um CSV servido por CDN.

```
url-shortener/
├── server/   ← API REST + Dockerfile (desafios Back-end e DevOps)
└── web/      ← SPA React + Vite (desafio Front-end)
```

| Pacote | Stack |
|---|---|
| `server/` | TypeScript · Fastify 5 · Drizzle ORM · PostgreSQL 17 · Zod · Vitest · Cloudflare R2 (S3 SDK) |
| `web/` | TypeScript · React 19 · Vite · React Router · TanStack Query · React Hook Form · Zod · Tailwind 4 |

Todas as operações identificam o link pelo **slug** (nunca pelo `id`
interno) — `DELETE /links/:slug`, `PATCH /links/:slug/visits`,
`GET /links/:slug`. É a mesma chave que aparece na URL do front, então a
página `/:slug` consulta a API sem nenhuma tradução intermediária.

---

## ⚡ Início rápido

Pré-requisitos: **Node 22+**, **pnpm 11+** (`corepack enable` já resolve) e
**Docker**.

**1. Instale as dependências**

```bash
pnpm install
```

**2. Crie os arquivos de ambiente**

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
```

Os valores padrão já apontam para o Postgres do `docker-compose.yml` e para
as portas locais (`3333` e `5173`). A descrição de cada chave está em
[🔧 Variáveis de ambiente](#-variáveis-de-ambiente).

> [!IMPORTANT]
> As cinco chaves `CLOUDFLARE_*` em `server/.env` vêm **vazias** de
> propósito (são as chaves do enunciado, e o repositório não carrega
> secrets). O servidor **se recusa a iniciar** enquanto alguma delas estiver
> vazia. Para rodar sem uma conta Cloudflare, preencha com placeholders —
> qualquer texto serve, exceto `CLOUDFLARE_PUBLIC_URL`, que precisa ser uma
> URL válida:
>
> ```env
> CLOUDFLARE_ACCOUNT_ID="placeholder"
> CLOUDFLARE_ACCESS_KEY_ID="placeholder"
> CLOUDFLARE_SECRET_ACCESS_KEY="placeholder"
> CLOUDFLARE_BUCKET="placeholder"
> CLOUDFLARE_PUBLIC_URL="http://localhost:9999"
> ```
>
> Com placeholders **tudo funciona, exceto a exportação de CSV**, que precisa
> de um bucket real (veja [Cloudflare R2](#-cloudflare-r2-exportação-real)).

**3. Suba o banco e aplique as migrations**

```bash
docker compose up -d postgres
pnpm --filter server db:migrate
```

**4. Suba a API e o front (dois terminais)**

```bash
pnpm dev:server   # API em http://localhost:3333
pnpm dev:web      # Interface em http://localhost:5173
```

| Endereço | O que é |
|---|---|
| http://localhost:5173 | Interface do Brev.ly |
| http://localhost:3333/docs | Documentação interativa da API (Scalar / OpenAPI) |
| http://localhost:3333/links | Listagem em JSON |

---

## 🐳 Alternativa: servidor em Docker

Para validar o `Dockerfile` do desafio DevOps, o `docker-compose.yml` sobe a
API a partir da imagem construída. **A ordem importa**: as migrations ficam
fora do entrypoint da aplicação de propósito — rodar migration no boot faz
várias réplicas disputarem o mesmo schema e mistura a responsabilidade de
"alterar o banco" com a de "servir requisições". Por isso existe o serviço
`migrate` separado; pular esse passo sobe um servidor que responde 500 em
toda requisição que toca o banco.

```bash
docker compose up -d postgres
docker compose --profile tools run --rm migrate
docker compose up -d server
```

A imagem (`server/Dockerfile`) é multi-stage sobre `node:22-alpine`, instala
com `--frozen-lockfile`, copia só `dist/` + migrations para o estágio final,
instala apenas dependências de produção e roda como usuário `node`
(non-root).

---

## ✅ Como validar os requisitos

Roteiro para conferir cada regra do enunciado, na interface ou via `curl`.
Com a API e o front no ar (passos acima):

### Back-end e Front-end

| # | Requisito | Como conferir |
|---|---|---|
| 1 | **Criar um link** | Na página inicial, informe uma URL e um link → o link aparece no topo da lista. `curl -s -X POST localhost:3333/links -H 'content-type: application/json' -d '{"originalUrl":"https://example.com","slug":"meu-link"}'` → `201` |
| 2 | **Rejeitar encurtamento mal formatado** | Tente o link `Meu Link!` → o formulário bloqueia com mensagem. Na API, `-d '{"originalUrl":"https://example.com","slug":"a b"}'` → `400` com `issues[]` |
| 3 | **Rejeitar encurtamento já existente** | Cadastre `meu-link` duas vezes → toast de erro na segunda. Na API, repita o `POST` do item 1 → `409` |
| 4 | **Deletar um link** | Ícone de lixeira no item → diálogo de confirmação → some da lista. `curl -s -X DELETE localhost:3333/links/meu-link -o /dev/null -w '%{http_code}'` → `204` |
| 5 | **Obter a URL original pela encurtada** | `curl -s localhost:3333/links/meu-link` → JSON com `originalUrl`. Esta rota **não** incrementa o contador |
| 6 | **Listar todas as URLs** | A lista da página inicial, com scroll infinito. `curl -s 'localhost:3333/links?limit=20'` → `{ links, nextCursor }` |
| 7 | **Incrementar acessos** | Abra `http://localhost:5173/meu-link` **em uma aba nova**: a página "Redirecionando…" fica visível por no mínimo 1,25 s (1 s + `VITE_API_DELAY_MS`, ver [Variáveis de ambiente](#-variáveis-de-ambiente)), incrementa e redireciona; volte à lista e a contagem subiu. Na API, `curl -s -X PATCH localhost:3333/links/meu-link/visits -o /dev/null -w '%{http_code}'` → `204` |
| 8 | **Exportar / baixar CSV** | Botão **Baixar CSV** no cabeçalho da lista → abre a URL pública do arquivo na CDN. Exige R2 configurado; com placeholders o botão responde erro. Na API, `curl -s -X POST localhost:3333/links/exports` → `{ reportUrl }` |
| 9 | **CSV via CDN, nome aleatório e único** | O `reportUrl` aponta para `exports/<uuid>-links.csv` no domínio público do bucket; duas exportações geram nomes diferentes |
| 10 | **Colunas do CSV** | `URL original`, `URL encurtada`, `Contagem de acessos`, `Data de criação` — nessa ordem, cabeçalho na primeira linha |
| 11 | **Listagem performática** | Paginação por cursor (keyset) sobre índice `(created_at, id)`; rode o [seed](#-seed-20-mil-links-para-ver-a-performance) e role a lista |

### Regras específicas do front

| Requisito | Como conferir |
|---|---|
| **SPA com Vite, 3 páginas** | `/` cadastro + lista · `/:slug` redirecionamento · qualquer outra rota → página 404 (ex.: `http://localhost:5173/nao/existe`) |
| **Slug inexistente** | `http://localhost:5173/nao-existe` → página "link não encontrado" |
| **Empty state** | Delete todos os links: a lista mostra o estado vazio e o botão **Baixar CSV** fica desabilitado |
| **Estados de carregamento** | Skeleton na primeira carga; spinner nos botões durante criação, exclusão e exportação. O `web/.env` já vem com `VITE_API_DELAY_MS=250`, simulando a latência de uma API remota; para vê-los com calma, suba para `1500` e reinicie o `pnpm dev:web` |
| **Bloqueio por estado** | Botão de exportar desabilitado sem links; botões de ação desabilitados enquanto a requisição está pendente |
| **Responsividade** | Redimensione até ~375px: layout empilha, formulário e lista ocupam a largura toda (mobile first, `md:`/`lg:` para desktop) |

### Requisitos de DevOps e entrega

| Requisito | Onde |
|---|---|
| `.env.example` com as chaves do enunciado | `server/.env.example` · `web/.env.example` |
| Script `db:migrate` | `server/package.json` |
| `Dockerfile` com boas práticas | `server/Dockerfile` (multi-stage, alpine, lockfile, prod-only, non-root) |
| CORS habilitado | `server/src/infra/http/app.ts` (`@fastify/cors`, origem = `FRONTEND_URL`); o servidor loga as origens permitidas ao subir |
| PostgreSQL · Fastify · Drizzle · TypeScript | `server/package.json`, `server/src/infra/db/` |
| Subpastas `web/` e `server/` | raiz do repositório |

---

## 🧪 Testes e qualidade

```bash
pnpm test:server   # suíte do servidor (integração com Postgres real)
pnpm test:web      # testes de lógica do front
pnpm lint          # Biome — lint + formatação dos dois pacotes
```

Os testes do servidor rodam contra um banco separado, `brevly_test`, criado
automaticamente por `docker/init.sql` na primeira subida do Postgres. O
`server/.env.test` é versionado (não contém secrets) e o script `pretest`
aplica as migrations nesse banco, então basta o container estar de pé.
Cada teste começa com a tabela vazia (`TRUNCATE` no `beforeEach`).

> Se o volume do Postgres já existia antes e `brevly_test` não foi criado:
> `docker compose down -v && docker compose up -d postgres`.

A suíte cobre validação de slug e URL, conflito `409` (inclusive corrida de
concorrência para o mesmo slug), incremento concorrente sem perda de
contagens, paginação sem repetir nem pular itens, e o caminho completo da
exportação contra um dublê de storage em memória (cabeçalho, colunas, linhas
em múltiplos lotes, nome único por chamada).

A mesma sequência roda na CI a cada push (`.github/workflows/tests.yml`):
lint → testes do servidor → type-check → build do servidor → testes do
front → type-check → build do front.

---

## 🌱 Seed: 20 mil links para ver a performance

```bash
pnpm --filter server db:seed
```

Popula o banco de desenvolvimento com 20.000 links. Depois, role a lista no
front (scroll infinito) ou pagine pela API — cada página é uma consulta
indexada, independente do tamanho da tabela.

---

## 🔧 Variáveis de ambiente

### `server/.env`

| Chave | Descrição |
|---|---|
| `PORT` | Porta da API (padrão `3333`) |
| `DATABASE_URL` | Conexão PostgreSQL (`postgresql://…`) |
| `FRONTEND_URL` | Base pública do front. Define as origens de CORS e monta a coluna "URL encurtada" do CSV. **Deve ser igual a `VITE_FRONTEND_URL` do web** |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| `CLOUDFLARE_ACCESS_KEY_ID` | Chave de acesso do token R2 |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | Secret do token R2 |
| `CLOUDFLARE_BUCKET` | Nome do bucket |
| `CLOUDFLARE_PUBLIC_URL` | Domínio público do bucket (precisa ser URL válida) |

### `web/.env`

| Chave | Descrição |
|---|---|
| `VITE_FRONTEND_URL` | Base pública do front que monta a URL exibida e copiada |
| `VITE_BACKEND_URL` | Endereço da API |
| `VITE_API_DELAY_MS` | Só para desenvolvimento local. Atraso artificial (em milissegundos) aplicado a toda requisição à API. **Padrão `250`** no `.env.example`: simula a latência de uma API fora do ambiente local, para que skeletons e estados de carregamento dos botões apareçam como apareceriam em produção — em `localhost` puro a resposta chega em poucos ms e eles passam rápido demais para serem vistos |

O valor padrão de `250` já deixa os estados de carregamento perceptíveis.
Para inspecioná-los com calma, aumente:

```env
# web/.env
VITE_API_DELAY_MS=1500
```

Reinicie o `pnpm dev:web` e recarregue a página: a lista mostra o skeleton
por 1,5 s e cada ação (criar, excluir, exportar) exibe o spinner e mantém o
botão bloqueado até a resposta chegar. Use `0` para desligar o atraso.

A tela de redirecionamento (`/:slug`) também usa essa variável: ela tem um
**tempo mínimo de exibição de 1 s + `VITE_API_DELAY_MS`** — com o padrão de
`250` são 1,25 s, e mesmo com `0` a tela dura 1 s (`MIN_DISPLAY_MS` em
`web/src/features/redirect/use-redirect.ts`). Sem isso, com a API local a
resposta chega em poucos milissegundos e a tela virava um flash ilegível
antes do redirect. O tempo mínimo vale só para a navegação — o incremento de
acessos é disparado imediatamente, sem esperar.

---

## 📡 API

Documentação interativa em `http://localhost:3333/docs` (Scalar).

| Método | Rota | Descrição | Respostas |
|---|---|---|---|
| `POST` | `/links` | Cria um link | `201` · `400` inválido · `409` slug em uso/reservado |
| `GET` | `/links?cursor&limit` | Lista todos os links, paginado | `200` `{ links, nextCursor }` |
| `GET` | `/links/:slug` | Resolve o slug (não incrementa acessos) | `200` · `404` |
| `PATCH` | `/links/:slug/visits` | Incrementa a contagem de acessos | `204` · `404` |
| `DELETE` | `/links/:slug` | Remove o link | `204` · `404` |
| `POST` | `/links/exports` | Gera o CSV e devolve a URL pública | `200` `{ reportUrl }` · `422` sem links |

- <strong>Listagem completa com cursor</strong>

`GET /links` devolve todos os links, percorridos por páginas. Chame sem
parâmetros para a primeira página e repita passando `nextCursor` enquanto
ele não for `null`:

```bash
curl -s 'http://localhost:3333/links?limit=20'
# { "links": [...], "nextCursor": "eyJjcmVhdGVkQXQ..." }

curl -s 'http://localhost:3333/links?limit=20&cursor=eyJjcmVhdGVkQXQ...'
# { "links": [...], "nextCursor": null }   ← fim da lista
```

- Exportação em streaming e CDN

`POST /links/exports` gera o CSV em streaming (cursor do Postgres, memória
constante), envia ao Cloudflare R2 por upload multipart e devolve 
`{ reportUrl }`. O arquivo é servido pela CDN:

```bash
REPORT_URL=$(curl -s -X POST http://localhost:3333/links/exports | jq -r .reportUrl)
curl -sO "$REPORT_URL"
```

---

## 🪣 Cloudflare R2 (exportação real)

Só é necessário para testar o botão **Baixar CSV** de ponta a ponta.

1. Crie um bucket no painel R2 da Cloudflare
2. Gere um API token com permissão de leitura e escrita
3. Habilite o domínio público do bucket e use-o em `CLOUDFLARE_PUBLIC_URL`
4. **Crie uma regra de ciclo de vida** que expire objetos com o prefixo
   `exports/` após 7 dias
5. Preencha as cinco chaves em `server/.env` e reinicie a API

---

## 🧭 Decisões de design

Resumo das escolhas que não são óbvias ao ler o código:

- **Slug como identificador em toda a API.** O projeto nunca expõe o `id`
- **Slug normalizado e com lista de reservados.** Slugs são convertidos para
  minúsculas e restritos a `[a-z0-9-]`; nomes que colidiriam com rotas do
  próprio front (por exemplo `assets`) respondem `409` como se já existissem.
- **Validação com Zod nas duas pontas.** O front valida antes de enviar
  (feedback imediato) e a API valida de novo (`400` com `issues[]`).