# Brev.ly — Plano de Implementação: Servidor

> **Para executores agênticos:** SUB-SKILL OBRIGATÓRIA: use
> `superpowers:subagent-driven-development` (recomendado) ou
> `superpowers:executing-plans` para implementar tarefa a tarefa. Os passos
> usam checkbox (`- [ ]`) para acompanhamento.

**Goal:** Construir a API REST do encurtador de URLs — criação, listagem
paginada, resolução, contagem de acessos, remoção e exportação de CSV para o
Cloudflare R2 — junto com o empacotamento Docker.

**Architecture:** Use-cases isolados que retornam `Either<Error, T>`, sem lançar
exceções; rotas Fastify apenas traduzem esse retorno em status HTTP. Acesso a
dados via Drizzle sobre `postgres-js`. A exportação usa cursor real do Postgres
em pipeline de streaming até o R2.

**Tech Stack:** TypeScript · Fastify 5 · Drizzle ORM · PostgreSQL 17 · Zod 4 ·
`@aws-sdk/client-s3` + `lib-storage` · Vitest · pnpm workspace · Docker

**Spec:** [`docs/DESIGN.md`](./DESIGN.md) — o plano argumenta a partir do spec;
leia os dois.

## Global Constraints

Valores copiados literalmente do spec. Valem para **todas** as tarefas.

- **Node na imagem Docker:** `node:22-alpine`. Não usar a versão local (Node 25).
- **Script obrigatório:** a chave `db:migrate` deve existir **exatamente** com
  esse nome e executar as migrations (§1 do spec).
- **`.env.example` do servidor:** contém as 7 chaves do enunciado
  (`PORT`, `DATABASE_URL`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_ACCESS_KEY_ID`,
  `CLOUDFLARE_SECRET_ACCESS_KEY`, `CLOUDFLARE_BUCKET`, `CLOUDFLARE_PUBLIC_URL`)
  mais `FRONTEND_URL`. Não remover nem renomear nenhuma das 7.
- **Identificador público:** `slug` em toda a API. O `id` (uuid) é interno e
  **nunca** aparece em resposta (D1, D6).
- **`Either` nunca carrega `undefined`** no lado de sucesso (D7). Quando não há
  o que retornar, o tipo é `Either<Error, true>` e o valor é `makeRight(true)`.
- **Status HTTP:** `400` validação (com `issues`) · `404` slug inexistente ·
  `409` slug duplicado ou reservado · `422` exportação sem links.
- **Timestamps:** `timestamp(..., { withTimezone: true })`. Sem o parâmetro,
  Drizzle gera `timestamp without time zone`.
- **Idioma:** mensagens de erro da API em português; código, identificadores e
  mensagens de commit em inglês.
- **Commits:** Conventional Commits, um por tarefa no mínimo.

---

## Estrutura de arquivos

```
url-shortener/
├── package.json                    # raiz, privado, scripts orquestradores
├── pnpm-workspace.yaml
├── biome.json                      # lint + format, cobre server e web
├── docker-compose.yml
└── server/
    ├── package.json
    ├── tsconfig.json
    ├── drizzle.config.ts
    ├── vitest.config.ts
    ├── .env.example
    ├── .env.test                       # versionado: sem segredos, aponta p/ brevly_test
    ├── .dockerignore
    ├── Dockerfile
    └── src/
        ├── env.ts                          # parseEnv + env validado
        ├── app/
        │   ├── errors/
        │   │   ├── slug-already-exists.ts
        │   │   ├── slug-is-reserved.ts
        │   │   ├── link-not-found.ts
        │   │   └── no-links-to-export.ts
        │   └── functions/
        │       ├── create-link.ts          + .spec.ts
        │       ├── list-links.ts           + .spec.ts
        │       ├── get-link-by-slug.ts     + .spec.ts
        │       ├── increment-link-visits.ts+ .spec.ts
        │       ├── delete-link.ts          + .spec.ts
        │       └── export-links.ts         + .spec.ts
        ├── infra/
        │   ├── db/
        │   │   ├── index.ts                # exporta db (drizzle) E pg (driver)
        │   │   ├── schemas/
        │   │   │   ├── index.ts            # barril: export const schema = { links }
        │   │   │   └── links.ts
        │   │   └── migrations/
        │   ├── shared/
        │   │   ├── either.ts               # makeLeft/makeRight/isLeft/isRight/unwrapEither
        │   │   ├── schemas.ts              # slugSchema, originalUrlSchema
        │   │   ├── reserved-slugs.ts       # blocklist derivada das rotas do front
        │   │   └── cursor.ts               # encode/decodeCursor (keyset)
        │   ├── storage/
        │   │   ├── uploader.ts             # interface Uploader
        │   │   ├── client.ts               # S3Client apontando para o R2
        │   │   └── r2-uploader.ts          # implementação de Uploader
        │   └── http/
        │       ├── app.ts                  # buildApp(): plugins, erro, rotas
        │       ├── server.ts               # bootstrap (listen)
        │       ├── error-handler.ts
        │       └── routes/
        │           ├── create-link.ts
        │           ├── list-links.ts
        │           ├── get-link-by-slug.ts
        │           ├── increment-link-visits.ts
        │           ├── delete-link.ts
        │           └── export-links.ts
        ├── test/
        │   ├── setup.ts                    # TRUNCATE por teste
        │   ├── in-memory-uploader.ts
        │   └── factories/
        │       └── make-link.ts
        └── scripts/
            └── seed.ts
```

**Responsabilidades:** `shared/` não importa de `app/` nem de `infra/`.
`app/` não importa de `infra/http/`. Rotas traduzem `Either` → HTTP e nada mais.

---

## Nota sobre cobertura de testes

O spec (§4.9) prevê testes nos 6 use-cases. Este plano acrescenta testes de rota
via `app.inject()` do Fastify, que sobem a aplicação em memória sem abrir socket.
São baratos e cobrem lógica real que os testes de use-case não alcançam: o
mapeamento de `Either` → status HTTP e a serialização das respostas.

---

## Task 1: Monorepo, pacote do servidor e validação de ambiente

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`
- Create: `server/package.json`, `server/tsconfig.json`, `biome.json`
- Create: `server/.env.example`, `server/.env.test`
- Create: `server/src/env.ts`
- Test: `server/src/env.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `parseEnv(source: unknown): Env` e `env: Env`, onde
  `type Env = { PORT: number; DATABASE_URL: string; FRONTEND_URL: string;
  CLOUDFLARE_ACCOUNT_ID: string; CLOUDFLARE_ACCESS_KEY_ID: string;
  CLOUDFLARE_SECRET_ACCESS_KEY: string; CLOUDFLARE_BUCKET: string;
  CLOUDFLARE_PUBLIC_URL: string }`.

- [ ] **Step 1: Criar o workspace pnpm na raiz**

`pnpm-workspace.yaml`:

```yaml
packages:
  - server
```

`web` **não** entra ainda. O `--frozen-lockfile` do Dockerfile (Task 15) compara
contra o lockfile: se `web` estivesse listado, o lockfile o incluiria e o build
da imagem falharia por não encontrar `web/package.json` no contexto copiado. O
plano do front adiciona a entrada junto com o ajuste correspondente no
Dockerfile.

`package.json` (raiz):

```json
{
  "name": "brev-ly",
  "private": true,
  "packageManager": "pnpm@11.0.5",
  "scripts": {
    "dev:server": "pnpm --filter server dev",
    "test:server": "pnpm --filter server test",
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:migrate": "docker compose --profile tools run --rm migrate"
  }
}
```

- [ ] **Step 2: Criar o pacote do servidor**

`server/package.json`:

```json
{
  "name": "server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch --env-file .env src/infra/http/server.ts",
    "build": "tsc",
    "start": "node dist/infra/http/server.js",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:studio": "drizzle-kit studio",
    "db:seed": "tsx --env-file .env src/scripts/seed.ts",
    "db:migrate:test": "dotenv -e .env.test -- drizzle-kit migrate",
    "pretest": "pnpm db:migrate:test",
    "test": "dotenv -e .env.test -- vitest run",
    "pretest:watch": "pnpm db:migrate:test",
    "test:watch": "dotenv -e .env.test -- vitest",
    "lint": "biome check src",
    "format": "biome check --write src"
  },
  "dependencies": {
    "@aws-sdk/client-s3": "^3.1096.0",
    "@aws-sdk/lib-storage": "^3.1096.0",
    "@fastify/cors": "^11.3.0",
    "@fastify/swagger": "^9.8.1",
    "@scalar/fastify-api-reference": "^1.63.0",
    "csv-stringify": "^6.8.1",
    "drizzle-orm": "^0.45.2",
    "fastify": "^5.10.0",
    "fastify-type-provider-zod": "^7.0.0",
    "postgres": "^3.4.9",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@faker-js/faker": "^10.5.0",
    "@types/node": "^24.13.3",
    "dotenv-cli": "^11.0.0",
    "drizzle-kit": "^0.31.10",
    "tsx": "^4.23.1",
    "typescript": "^5.9.0",
    "vite-tsconfig-paths": "^6.1.1",
    "vitest": "^4.1.10"
  }
}
```

Instalar: `pnpm install`

- [ ] **Step 3: Configurar TypeScript com o alias `@/`**

`server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "**/*.spec.ts"]
}
```

`biome.json` — **na raiz do monorepo**, cobrindo `server` e `web`:

```json
{
  "$schema": "https://biomejs.dev/schemas/2.5.8/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": { "ignoreUnknown": false },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 80
  },
  "assist": {
    "enabled": true,
    "actions": { "source": { "organizeImports": "on" } }
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noConsole": "error" }
    }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "arrowParentheses": "asNeeded",
      "jsxQuoteStyle": "double",
      "trailingCommas": "es5"
    }
  },
  "overrides": [
    {
      "includes": ["server/src/scripts/**", "server/src/test/**"],
      "linter": { "rules": { "suspicious": { "noConsole": "off" } } }
    }
  ]
}
```

Instalar na raiz: `pnpm add -Dw @biomejs/biome`

Um arquivo, um binário, os dois pacotes. Biome faz formatação **e** lint, o
que dispensa o par ESLint + Prettier e, com ele, o `eslint-config-prettier` —
pacote cuja única função é desligar as regras de estilo do ESLint para que não
briguem com o Prettier.

`useIgnoreFile: true` reaproveita o `.gitignore`, evitando manter uma segunda
lista de exclusões.

O `noConsole` fica desligado nos scripts e no harness de teste, onde imprimir no
terminal é o propósito — e ligado no resto, onde `console.log` esquecido é o
resíduo mais comum numa entrega.

- [ ] **Step 4: Criar os arquivos de exemplo de ambiente**

`server/.env.example` — as 7 chaves do enunciado, intactas, mais `FRONTEND_URL`:

```env
PORT=3333
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/brevly

# Base pública do front. Usada no CORS e para montar a coluna
# "URL encurtada" do CSV. Não faz parte das chaves do enunciado.
FRONTEND_URL=http://localhost:5173

CLOUDFLARE_ACCOUNT_ID=""
CLOUDFLARE_ACCESS_KEY_ID=""
CLOUDFLARE_SECRET_ACCESS_KEY=""
CLOUDFLARE_BUCKET=""
CLOUDFLARE_PUBLIC_URL=""
```

`server/.env.test` — **commitado no repositório**, não um `.example`:

```env
PORT=3334
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/brevly_test
FRONTEND_URL=http://localhost:5173
CLOUDFLARE_ACCOUNT_ID="test"
CLOUDFLARE_ACCESS_KEY_ID="test"
CLOUDFLARE_SECRET_ACCESS_KEY="test"
CLOUDFLARE_BUCKET="test"
CLOUDFLARE_PUBLIC_URL="http://localhost:9999"
```

Copiar o de desenvolvimento: `cp server/.env.example server/.env`

O `.env.test` é versionado de propósito: não contém segredo nenhum — aponta
para o banco local de teste e usa credenciais fictícias da Cloudflare, já que
os testes de exportação usam um duplo em memória. Versioná-lo faz `pnpm test`
funcionar logo após o clone, sem que ninguém precise descobrir que havia um
arquivo a copiar antes.

O `.gitignore` da raiz ignora `.env` e `.env.test`, então adicione a exceção:

```gitignore
!server/.env.test
```

- [ ] **Step 5: Escrever o teste que falha**

`server/src/env.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  PORT: '3333',
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  FRONTEND_URL: 'http://localhost:5173',
  CLOUDFLARE_ACCOUNT_ID: 'account',
  CLOUDFLARE_ACCESS_KEY_ID: 'key',
  CLOUDFLARE_SECRET_ACCESS_KEY: 'secret',
  CLOUDFLARE_BUCKET: 'bucket',
  CLOUDFLARE_PUBLIC_URL: 'https://cdn.example.com',
}

describe('parseEnv', () => {
  it('converte PORT para número', () => {
    expect(parseEnv(valid).PORT).toBe(3333)
  })

  it('usa 3333 como PORT padrão', () => {
    const { PORT, ...withoutPort } = valid
    expect(parseEnv(withoutPort).PORT).toBe(3333)
  })

  it('lança quando DATABASE_URL falta', () => {
    const { DATABASE_URL, ...incomplete } = valid
    expect(() => parseEnv(incomplete)).toThrow(/DATABASE_URL/)
  })

  it('lança quando FRONTEND_URL falta', () => {
    const { FRONTEND_URL, ...incomplete } = valid
    expect(() => parseEnv(incomplete)).toThrow(/FRONTEND_URL/)
  })

  it('rejeita DATABASE_URL com esquema postgres:// em vez de postgresql://', () => {
    expect(() =>
      parseEnv({ ...valid, DATABASE_URL: 'postgres://user:pass@localhost:5432/db' })
    ).toThrow(/DATABASE_URL/)
  })

  it('lança quando uma chave da Cloudflare está vazia', () => {
    expect(() => parseEnv({ ...valid, CLOUDFLARE_BUCKET: '' })).toThrow(
      /CLOUDFLARE_BUCKET/
    )
  })
})
```

- [ ] **Step 6: Rodar o teste e confirmar que falha**

Run: `pnpm --filter server exec vitest run src/env.spec.ts`
Expected: FAIL — `Failed to resolve import "./env"`

- [ ] **Step 7: Implementar `env.ts`**

`server/src/env.ts`:

```ts
import { z } from 'zod'

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  // startsWith pega o erro mais comum: `postgres://` em vez de `postgresql://`
  DATABASE_URL: z.url().startsWith('postgresql://'),
  FRONTEND_URL: z.string().min(1), // aceita lista separada por vírgula
  CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
  CLOUDFLARE_ACCESS_KEY_ID: z.string().min(1),
  CLOUDFLARE_SECRET_ACCESS_KEY: z.string().min(1),
  CLOUDFLARE_BUCKET: z.string().min(1),
  CLOUDFLARE_PUBLIC_URL: z.url(),
})

export type Env = z.infer<typeof envSchema>

export function parseEnv(source: unknown): Env {
  const result = envSchema.safeParse(source)

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')

    throw new Error(`Variáveis de ambiente inválidas:\n${details}`)
  }

  return result.data
}

export const env = parseEnv(process.env)
```

A mensagem de erro inclui o nome de cada chave problemática — é o que os testes
verificam com `toThrow(/DATABASE_URL/)`, e o que torna a falha de boot
diagnosticável sem ler o código.

- [ ] **Step 8: Rodar o teste e confirmar que passa**

Run: `pnpm --filter server exec vitest run src/env.spec.ts`
Expected: PASS — 5 testes

- [ ] **Step 9: Commit**

```bash
git add package.json pnpm-workspace.yaml server/
git commit -m "feat(server): scaffold workspace and validate environment"
```

---

## Task 2: Postgres no Docker Compose, schema e migration

**Files:**
- Create: `docker-compose.yml`, `docker/init.sql`
- Create: `server/drizzle.config.ts`
- Create: `server/src/infra/db/schemas/index.ts`, `server/src/infra/db/index.ts`
- Generate: `server/src/infra/db/migrations/*.sql`

**Interfaces:**
- Consumes: `env` da Task 1.
- Produces: `links` (tabela Drizzle) com colunas `id`, `originalUrl`, `slug`,
  `accessCount`, `createdAt`; `db` (instância Drizzle) e `pg` (driver
  `postgres-js`, necessário para o cursor da Task 11).

- [ ] **Step 1: Subir o Postgres**

`docker-compose.yml` na raiz:

```yaml
services:
  postgres:
    image: postgres:17-alpine
    container_name: brevly-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: brevly
    ports:
      - '5432:5432'
    volumes:
      - postgres_data:/var/lib/postgresql/data
      # cria brevly_test na primeira subida do volume (Step 2)
      - ./docker:/docker-entrypoint-initdb.d
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres -d brevly']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

O volume monta em `/var/lib/postgresql/data`, que é o `PGDATA` da imagem
oficial. Montar o diretório pai sobe sem erro mas pode não persistir os dados
(§7 do spec).

Note o volume extra `./docker:/docker-entrypoint-initdb.d`.

- [ ] **Step 2: Criar o banco de teste automaticamente**

`docker/init.sql`:

```sql
CREATE DATABASE brevly_test;
```

A imagem oficial do Postgres executa qualquer `.sql` ou `.sh` encontrado em
`/docker-entrypoint-initdb.d` na **primeira** inicialização do volume. O banco
de teste passa a nascer junto com o principal, em vez de depender de alguém
lembrar de rodar `createdb` — o tipo de passo manual que funciona na máquina de
quem escreveu e falha na de quem clonou.

Como roda só na primeira inicialização: se o volume já existir de uma tentativa
anterior, é preciso recriá-lo com `docker compose down -v` antes.

Run: `docker compose up -d postgres`

- [ ] **Step 3: Verificar que o Postgres aceita conexões**

Run: `docker compose exec postgres pg_isready -U postgres -d brevly`
Expected: `accepting connections`

- [ ] **Step 4: Definir o schema**

`server/src/infra/db/schemas/links.ts`:

```ts
import { index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

export const links = pgTable(
  'links',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    originalUrl: text('original_url').notNull(),
    slug: text('slug').notNull().unique(),
    accessCount: integer('access_count').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('links_created_at_id_idx').on(table.createdAt.desc(), table.id.desc()),
  ]
)

```

E o barril `server/src/infra/db/schemas/index.ts`:

```ts
import { links } from './links'

export const schema = { links }
```

O barril é o idioma do projeto da aula: o código lê `schema.links`, e novas
tabelas entram sem alterar nenhum import existente.
```

O índice é composto e na mesma ordem do `ORDER BY` da paginação keyset
(`created_at DESC, id DESC`), para o Postgres percorrer sem ordenar (§4.2).

- [ ] **Step 5: Criar a conexão**

`server/src/infra/db/index.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/env'
import { schema } from './schema'

export const pg = postgres(env.DATABASE_URL)
export const db = drizzle(pg, { schema })
```

`pg` é exportado além de `db` porque o Drizzle não expõe cursor — a exportação
de CSV (Task 11) precisa do driver diretamente.

- [ ] **Step 6: Configurar o drizzle-kit**

`server/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/infra/db/schemas/links.ts',
  out: './src/infra/db/migrations',
  dbCredentials: {
    url: process.env.DATABASE_URL as string,
  },
})
```

- [ ] **Step 7: Gerar e aplicar a migration**

```bash
cd server
pnpm db:generate
pnpm exec dotenv -e .env -- pnpm db:migrate
pnpm db:migrate:test
```

- [ ] **Step 8: Verificar a estrutura criada**

Run:
```bash
docker compose exec postgres psql -U postgres -d brevly -c '\d links'
```
Expected: colunas `id` (uuid), `original_url` (text), `slug` (text),
`access_count` (integer), `created_at` (**timestamp with time zone**);
índice único em `slug` e o índice `links_created_at_id_idx`.

Se `created_at` aparecer como `timestamp without time zone`, o
`{ withTimezone: true }` foi esquecido — corrigir e regerar a migration.

- [ ] **Step 9: Commit**

```bash
git add docker-compose.yml docker/ server/drizzle.config.ts server/src/infra/db/
git commit -m "feat(server): add links schema and postgres compose service"
```

---

## Task 3: Infraestrutura de testes com isolamento de banco

**Files:**
- Create: `server/vitest.config.ts`
- Create: `server/src/test/setup.ts`
- Create: `server/src/test/factories/make-link.ts`
- Test: `server/src/test/isolation.spec.ts`

**Interfaces:**
- Consumes: `db`, `links` da Task 2.
- Produces: `makeLink(overrides?: Partial<NewLink>): NewLink` — gera dados
  válidos de link; `beforeEach` global que trunca a tabela `links`.

- [ ] **Step 1: Configurar o Vitest**

`server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
    include: ['src/**/*.spec.ts'],
  },
})
```

`fileParallelism: false` é obrigatório: todos os arquivos de teste compartilham
o mesmo banco, e em paralelo o `TRUNCATE` de um apagaria as linhas que outro
acabou de inserir (§4.9).

Não há `globalSetup`: as migrations do banco de teste rodam pelo hook `pretest`
do npm (Task 1), fora do Vitest. Chamar `execSync('drizzle-kit migrate')` de
dentro da configuração funcionaria, mas coloca um processo filho no caminho de
toda execução da suíte — inclusive no modo watch, a cada rerun.

- [ ] **Step 2: Limpar a tabela antes de cada teste**

`server/src/test/setup.ts`:

```ts
import { sql } from 'drizzle-orm'
import { afterAll, beforeEach } from 'vitest'
import { db, pg } from '@/infra/db'

beforeEach(async () => {
  await db.execute(sql`TRUNCATE TABLE links RESTART IDENTITY CASCADE`)
})

afterAll(async () => {
  await pg.end()
})
```

- [ ] **Step 3: Criar a factory**

`server/src/test/factories/make-link.ts`:

```ts
import { faker } from '@faker-js/faker'

export type NewLink = {
  originalUrl: string
  slug: string
  accessCount?: number
  createdAt?: Date
}

export function makeLink(overrides: Partial<NewLink> = {}): NewLink {
  return {
    originalUrl: faker.internet.url(),
    slug: faker.string.alphanumeric({ length: 8, casing: 'lower' }),
    ...overrides,
  }
}
```

- [ ] **Step 4: Escrever o teste que prova o isolamento**

`server/src/test/isolation.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { makeLink } from './factories/make-link'

describe('isolamento do banco de teste', () => {
  it('começa com a tabela vazia e insere uma linha', async () => {
    expect(await db.select().from(schema.links)).toHaveLength(0)

    await db.insert(schema.links).values(makeLink())

    expect(await db.select().from(schema.links)).toHaveLength(1)
  })

  it('começa vazia de novo, apesar da inserção do teste anterior', async () => {
    expect(await db.select().from(schema.links)).toHaveLength(0)
  })
})
```

O segundo teste é o que importa: ele falha se o `TRUNCATE` não estiver rodando,
e é exatamente a condição que torna impossíveis os testes de "lista vazia" mais
adiante.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd server && pnpm test`
Expected: PASS — os testes de `env.spec.ts` e os 2 de isolamento.

- [ ] **Step 6: Rodar uma segunda vez**

Run: `cd server && pnpm test`
Expected: PASS de novo, com a mesma contagem. Se o segundo teste falhar agora,
o `TRUNCATE` não está sendo aplicado.

- [ ] **Step 7: Commit**

```bash
git add server/vitest.config.ts server/src/test/
git commit -m "test(server): add isolated database test harness"
```

---

## Task 4: `Either` e schemas compartilhados

**Files:**
- Create: `server/src/infra/shared/either.ts`, `server/src/infra/shared/schemas.ts`
- Test: `server/src/infra/shared/either.spec.ts`, `server/src/infra/shared/schemas.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `Either<L, R>`, `makeLeft<L>(v: L): Left<L>`, `makeRight<R>(v: R): Right<R>`,
    `isLeft(e): e is Left`, `isRight(e): e is Right`, `unwrapEither(e): L | R`
  - `slugSchema: ZodType<string>` — normaliza e valida o slug
  - `originalUrlSchema: ZodType<string>` — valida URL

- [ ] **Step 1: Escrever o teste do `Either`**

`server/src/infra/shared/either.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isLeft, isRight, makeLeft, makeRight, unwrapEither } from './either'

describe('Either', () => {
  it('identifica um Left', () => {
    const result = makeLeft(new Error('falhou'))
    expect(isLeft(result)).toBe(true)
    expect(isRight(result)).toBe(false)
  })

  it('identifica um Right', () => {
    const result = makeRight({ ok: true })
    expect(isRight(result)).toBe(true)
    expect(isLeft(result)).toBe(false)
  })

  it('desembrulha o valor de cada lado', () => {
    expect(unwrapEither(makeRight(42))).toBe(42)
    expect(unwrapEither(makeLeft('erro'))).toBe('erro')
  })

  it('aceita `true` como valor de sucesso vazio', () => {
    const result = makeRight(true)
    expect(isRight(result)).toBe(true)
    expect(unwrapEither(result)).toBe(true)
  })

  it('rejeita `undefined` em runtime — a armadilha da D7', () => {
    const broken = makeRight(undefined as unknown as string)

    expect(isRight(broken)).toBe(false)
    expect(isLeft(broken)).toBe(false)
    expect(() => unwrapEither(broken)).toThrow()
  })
})
```

O último teste documenta a limitação em vez de escondê-la: ele **prova** que
`makeRight(undefined)` quebra, e é a razão pela qual todo use-case devolve valor
não-`undefined` (D7).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/infra/shared/either.spec.ts`
Expected: FAIL — `Failed to resolve import "./either"`

- [ ] **Step 3: Implementar o `Either`**

`server/src/infra/shared/either.ts`:

```ts
export type Left<L> = { left: L; right?: never }
export type Right<R> = { left?: never; right: R }
export type Either<L, R> = NonNullable<Left<L> | Right<R>>

export const makeLeft = <L>(value: L): Left<L> => ({ left: value })
export const makeRight = <R>(value: R): Right<R> => ({ right: value })

export const isLeft = <L, R>(e: Either<L, R>): e is Left<L> =>
  e.left !== undefined

export const isRight = <L, R>(e: Either<L, R>): e is Right<R> =>
  e.right !== undefined

export function unwrapEither<L, R>(e: Either<L, R>): NonNullable<L | R> {
  if (e.left !== undefined && e.right !== undefined) {
    throw new Error('Either recebeu left e right ao mesmo tempo')
  }

  if (e.left !== undefined) return e.left as NonNullable<L>
  if (e.right !== undefined) return e.right as NonNullable<R>

  throw new Error('Either não recebeu nem left nem right')
}
```

- [ ] **Step 4: Escrever o teste dos schemas**

`server/src/infra/shared/schemas.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { originalUrlSchema, slugSchema } from './schemas'

describe('slugSchema', () => {
  it('aceita letras minúsculas, números e hífens', () => {
    expect(slugSchema.parse('meu-link-1')).toBe('meu-link-1')
  })

  it('normaliza maiúsculas para minúsculas', () => {
    expect(slugSchema.parse('MeuLink')).toBe('meulink')
  })

  it('remove espaços nas pontas', () => {
    expect(slugSchema.parse('  meu-link  ')).toBe('meu-link')
  })

  it.each(['ab', 'a'.repeat(33), 'meu_link', 'meu link', '-meu', 'meu-', 'meu--link'])(
    'rejeita %s',
    (invalid) => {
      expect(slugSchema.safeParse(invalid).success).toBe(false)
    }
  )
})

describe('originalUrlSchema', () => {
  it('aceita uma URL válida', () => {
    expect(originalUrlSchema.parse('https://example.com/a')).toBe(
      'https://example.com/a'
    )
  })

  it.each(['nao-e-url', 'example.com', ''])('rejeita %s', (invalid) => {
    expect(originalUrlSchema.safeParse(invalid).success).toBe(false)
  })
})
```

- [ ] **Step 5: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/infra/shared/schemas.spec.ts`
Expected: FAIL — `Failed to resolve import "./schemas"`

- [ ] **Step 6: Implementar os schemas**

`server/src/infra/shared/schemas.ts`:

```ts
import { z } from 'zod'

export const slugSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(3, 'O apelido deve ter ao menos 3 caracteres')
      .max(32, 'O apelido deve ter no máximo 32 caracteres')
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Use apenas letras minúsculas, números e hífens'
      )
  )

export const originalUrlSchema = z.url({ error: 'Informe uma URL válida' })
```

`z.url()` é a forma do Zod 4. O `z.string().url()` do Zod 3 ainda funciona, mas
está depreciado.

A normalização vem antes da validação via `.transform().pipe()`: digitar
`MeuLink` produz `meulink` em vez de erro (§4.3). Fosse `.toLowerCase()` depois
do `.regex()`, a maiúscula seria rejeitada antes de ser normalizada.

- [ ] **Step 7: Rodar os dois arquivos e confirmar que passam**

Run: `cd server && pnpm exec vitest run src/shared/`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/src/infra/shared/
git commit -m "feat(server): add Either type and shared validation schemas"
```

---

## Task 5: Erros de domínio e slugs reservados

**Files:**
- Create: `server/src/app/errors/slug-already-exists.ts`,
  `slug-is-reserved.ts`, `link-not-found.ts`, `no-links-to-export.ts`
- Create: `server/src/infra/shared/reserved-slugs.ts`
- Test: `server/src/infra/shared/reserved-slugs.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: classes `SlugAlreadyExists`, `SlugIsReserved`, `LinkNotFound`,
  `NoLinksToExport` — todas estendem `Error` e definem `name` igual ao nome da
  classe; `RESERVED_SLUGS: readonly string[]` e
  `isReservedSlug(slug: string): boolean`.

- [ ] **Step 1: Escrever o teste**

`server/src/infra/shared/reserved-slugs.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS, isReservedSlug } from './reserved-slugs'

describe('slugs reservados', () => {
  it('reserva o diretório de build do Vite', () => {
    expect(RESERVED_SLUGS).toContain('assets')
  })

  it('identifica um slug reservado', () => {
    expect(isReservedSlug('assets')).toBe(true)
  })

  it('compara ignorando maiúsculas e espaços', () => {
    expect(isReservedSlug('  ASSETS  ')).toBe(true)
  })

  it('libera um slug comum', () => {
    expect(isReservedSlug('meu-link')).toBe(false)
  })

  it('não reserva rotas da API — elas ficam em outra origem', () => {
    expect(isReservedSlug('api')).toBe(false)
    expect(isReservedSlug('docs')).toBe(false)
  })

  it('não reserva not-found — a tela é renderizada dentro de /:slug', () => {
    expect(isReservedSlug('not-found')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/infra/shared/reserved-slugs.spec.ts`
Expected: FAIL — `Failed to resolve import "./reserved-slugs"`

- [ ] **Step 3: Implementar a blocklist**

`server/src/infra/shared/reserved-slugs.ts`:

```ts
/**
 * Slugs que colidiriam com caminhos servidos pelo front.
 *
 * A URL curta é `${FRONTEND_URL}/${slug}`, então a colisão é com caminhos do
 * FRONT — não da API, que roda em outra origem (D16). Um slug colidente seria
 * criado com sucesso e ficaria inalcançável para sempre, sem erro nenhum.
 *
 * `assets`: o Vite emite os arquivos compilados sob `/assets/`.
 *
 * Fora da lista, e por quê:
 * - `not-found`: a tela de link não encontrado é renderizada DENTRO da rota
 *   `/:slug` quando a API devolve 404. Não existe rota estática para ela.
 * - `api`, `docs`: rotas do servidor, em outra origem. Só colidiriam se front
 *   e API compartilhassem domínio atrás de um proxy reverso.
 *
 * ⚠️ Ao adicionar uma rota estática no front, ou ao publicar a API sob o mesmo
 * domínio, acrescente o caminho aqui.
 */
export const RESERVED_SLUGS = ['assets'] as const

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.includes(
    slug.trim().toLowerCase() as (typeof RESERVED_SLUGS)[number]
  )
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/infra/shared/reserved-slugs.spec.ts`
Expected: PASS — 5 testes

- [ ] **Step 5: Criar as classes de erro**

`server/src/app/errors/slug-already-exists.ts`:

```ts
export class SlugAlreadyExists extends Error {
  readonly name = 'SlugAlreadyExists'

  constructor() {
    super('Esse apelido já está em uso.')
  }
}
```

`server/src/app/errors/slug-is-reserved.ts`:

```ts
export class SlugIsReserved extends Error {
  readonly name = 'SlugIsReserved'

  constructor() {
    super('Esse apelido é reservado pela aplicação.')
  }
}
```

`server/src/app/errors/link-not-found.ts`:

```ts
export class LinkNotFound extends Error {
  readonly name = 'LinkNotFound'

  constructor() {
    super('Link não encontrado.')
  }
}
```

`server/src/app/errors/no-links-to-export.ts`:

```ts
export class NoLinksToExport extends Error {
  readonly name = 'NoLinksToExport'

  constructor() {
    super('Não há links para exportar.')
  }
}
```

`name` é declarado explicitamente porque a minificação pode alterar
`constructor.name`. O tratador de erros (Task 12) discrimina por essa string.

- [ ] **Step 6: Commit**

```bash
git add server/src/app/errors/ server/src/infra/shared/reserved-slugs.ts
git commit -m "feat(server): add domain errors and reserved slug blocklist"
```

---

## Task 6: Use-case `create-link`

**Files:**
- Create: `server/src/app/functions/create-link.ts`
- Test: `server/src/app/functions/create-link.spec.ts`

**Interfaces:**
- Consumes: `db`, `links`, `Either`, `slugSchema`, `originalUrlSchema`,
  `isReservedSlug`, `SlugAlreadyExists`, `SlugIsReserved`.
- Produces:
  ```ts
  type LinkOutput = {
    originalUrl: string
    slug: string
    accessCount: number
    createdAt: Date
  }
  createLink(input: { originalUrl: string; slug: string }):
    Promise<Either<Error, LinkOutput>>
  ```
  `LinkOutput` é o formato usado por todos os use-cases que devolvem um link.
  **Não inclui `id`** (D6).

- [ ] **Step 1: Escrever o teste**

`server/src/app/functions/create-link.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { SlugAlreadyExists } from '@/app/errors/slug-already-exists'
import { SlugIsReserved } from '@/app/errors/slug-is-reserved'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'

describe('createLink', () => {
  it('cria um link e devolve os campos públicos', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com/pagina',
      slug: 'meu-link',
    })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    const link = unwrapEither(result)

    expect(link.originalUrl).toBe('https://example.com/pagina')
    expect(link.slug).toBe('meu-link')
    expect(link.accessCount).toBe(0)
    expect(link.createdAt).toBeInstanceOf(Date)
  })

  it('não expõe o id interno', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com',
      slug: 'sem-id',
    })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result)).not.toHaveProperty('id')
  })

  it('normaliza o slug para minúsculas', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com',
      slug: 'MeuLink',
    })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).slug).toBe('meulink')
  })

  it('rejeita slug já cadastrado', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'duplicado' })

    const result = await createLink({
      originalUrl: 'https://b.com',
      slug: 'duplicado',
    })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(SlugAlreadyExists)
  })

  it('detecta duplicidade mesmo com grafia diferente', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'unico' })

    const result = await createLink({
      originalUrl: 'https://b.com',
      slug: 'UNICO',
    })

    expect(isLeft(result)).toBe(true)
  })

  it('rejeita slug reservado', async () => {
    const result = await createLink({
      originalUrl: 'https://example.com',
      slug: 'assets',
    })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(SlugIsReserved)
  })

  it('rejeita URL inválida com ZodError', async () => {
    await expect(
      createLink({ originalUrl: 'nao-e-url', slug: 'valido' })
    ).rejects.toBeInstanceOf(z.ZodError)
  })

  it('rejeita slug malformado com ZodError', async () => {
    await expect(
      createLink({ originalUrl: 'https://example.com', slug: 'ab' })
    ).rejects.toBeInstanceOf(z.ZodError)
  })
})
```

Falha de validação **lança** `ZodError` em vez de virar `Left`. É deliberado:
validação de formato é erro do chamador, não resultado de negócio, e o
`fastify-type-provider-zod` já a captura na borda HTTP e devolve 400 (Task 12).
`Left` fica reservado para os erros que só o domínio conhece.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/app/functions/create-link.spec.ts`
Expected: FAIL — `Failed to resolve import "./create-link"`

- [ ] **Step 3: Implementar o use-case**

`server/src/app/functions/create-link.ts`:

```ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { SlugAlreadyExists } from '@/app/errors/slug-already-exists'
import { SlugIsReserved } from '@/app/errors/slug-is-reserved'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { isReservedSlug } from '@/infra/shared/reserved-slugs'
import { originalUrlSchema, slugSchema } from '@/infra/shared/schemas'

const createLinkInput = z.object({
  originalUrl: originalUrlSchema,
  slug: slugSchema,
})

export type CreateLinkInput = z.input<typeof createLinkInput>

export type LinkOutput = {
  originalUrl: string
  slug: string
  accessCount: number
  createdAt: Date
}

export async function createLink(
  input: CreateLinkInput
): Promise<Either<Error, LinkOutput>> {
  const { originalUrl, slug } = createLinkInput.parse(input)

  if (isReservedSlug(slug)) {
    return makeLeft(new SlugIsReserved())
  }

  const existing = await db
    .select({ id: schema.links.id })
    .from(schema.links)
    .where(eq(schema.links.slug, slug))
    .limit(1)

  if (existing.length > 0) {
    return makeLeft(new SlugAlreadyExists())
  }

  const [created] = await db
    .insert(schema.links)
    .values({ originalUrl, slug })
    .returning({
      originalUrl: schema.links.originalUrl,
      slug: schema.links.slug,
      accessCount: schema.links.accessCount,
      createdAt: schema.links.createdAt,
    })

  if (!created) {
    throw new Error('Falha ao criar o link')
  }

  return makeRight(created)
}
```

O `returning` seleciona colunas explicitamente em vez de devolver a linha
inteira — é o que garante que o `id` nunca escape para a API (D6), por
construção e não por disciplina.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/app/functions/create-link.spec.ts`
Expected: PASS — 8 testes

- [ ] **Step 5: Commit**

```bash
git add server/src/app/functions/create-link.ts server/src/app/functions/create-link.spec.ts
git commit -m "feat(server): add create-link use case"
```

---

## Task 7: Cursor keyset e use-case `list-links`

**Files:**
- Create: `server/src/infra/shared/cursor.ts`
- Create: `server/src/app/functions/list-links.ts`
- Test: `server/src/infra/shared/cursor.spec.ts`,
  `server/src/app/functions/list-links.spec.ts`

**Interfaces:**
- Consumes: `db`, `links`, `Either`, `LinkOutput` da Task 6.
- Produces:
  ```ts
  encodeCursor(input: { createdAt: Date; id: string }): string
  decodeCursor(cursor: string): { createdAt: Date; id: string } | null
  listLinks(input: { cursor?: string; limit?: number }):
    Promise<Either<Error, { links: LinkOutput[]; nextCursor: string | null }>>
  ```

- [ ] **Step 1: Escrever o teste do cursor**

`server/src/infra/shared/cursor.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { decodeCursor, encodeCursor } from './cursor'

describe('cursor', () => {
  const anchor = {
    createdAt: new Date('2026-08-24T12:00:00.000Z'),
    id: '3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
  }

  it('faz round-trip preservando os valores', () => {
    const decoded = decodeCursor(encodeCursor(anchor))

    expect(decoded).not.toBeNull()
    expect(decoded?.id).toBe(anchor.id)
    expect(decoded?.createdAt.toISOString()).toBe(anchor.createdAt.toISOString())
  })

  it('produz uma string opaca, sem os valores legíveis', () => {
    expect(encodeCursor(anchor)).not.toContain(anchor.id)
  })

  it('devolve null para cursor malformado', () => {
    expect(decodeCursor('nao-e-base64!!!')).toBeNull()
    expect(decodeCursor('')).toBeNull()
  })

  it('devolve null para base64 válido sem os campos esperados', () => {
    const bogus = Buffer.from(JSON.stringify({ foo: 'bar' })).toString(
      'base64url'
    )

    expect(decodeCursor(bogus)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/infra/shared/cursor.spec.ts`
Expected: FAIL — `Failed to resolve import "./cursor"`

- [ ] **Step 3: Implementar o cursor**

`server/src/infra/shared/cursor.ts`:

```ts
import { z } from 'zod'

// formas do Zod 4: z.iso.datetime() e z.uuid()
const cursorPayload = z.object({
  createdAt: z.iso.datetime(),
  id: z.uuid(),
})

export type CursorAnchor = { createdAt: Date; id: string }

export function encodeCursor(input: CursorAnchor): string {
  const payload = JSON.stringify({
    createdAt: input.createdAt.toISOString(),
    id: input.id,
  })

  return Buffer.from(payload, 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): CursorAnchor | null {
  try {
    const raw = Buffer.from(cursor, 'base64url').toString('utf8')
    const parsed = cursorPayload.safeParse(JSON.parse(raw))

    if (!parsed.success) return null

    return {
      createdAt: new Date(parsed.data.createdAt),
      id: parsed.data.id,
    }
  } catch {
    return null
  }
}
```

`decodeCursor` devolve `null` em vez de lançar: um cursor inválido vem do
cliente e deve resultar em "primeira página", não em erro 500.

- [ ] **Step 4: Escrever o teste da listagem**

`server/src/app/functions/list-links.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { listLinks } from './list-links'

async function seed(count: number, baseTime = Date.parse('2026-08-24T12:00:00Z')) {
  const rows = Array.from({ length: count }, (_, i) => ({
    originalUrl: `https://example.com/${i}`,
    slug: `slug-${String(i).padStart(3, '0')}`,
    createdAt: new Date(baseTime + i * 1000),
  }))

  await db.insert(schema.links).values(rows)
}

function unwrap<T>(result: Awaited<ReturnType<typeof listLinks>>) {
  if (isLeft(result)) throw new Error('esperava sucesso')
  return unwrapEither(result)
}

describe('listLinks', () => {
  it('devolve lista vazia e nextCursor null quando não há links', async () => {
    const page = unwrap(await listLinks({}))

    expect(page.links).toHaveLength(0)
    expect(page.nextCursor).toBeNull()
  })

  it('ordena do mais recente para o mais antigo', async () => {
    await seed(3)

    const page = unwrap(await listLinks({}))

    expect(page.links.map((l) => l.slug)).toEqual([
      'slug-002',
      'slug-001',
      'slug-000',
    ])
  })

  it('respeita o limit e devolve nextCursor quando há mais', async () => {
    await seed(5)

    const page = unwrap(await listLinks({ limit: 2 }))

    expect(page.links).toHaveLength(2)
    expect(page.nextCursor).not.toBeNull()
  })

  it('devolve nextCursor null na última página', async () => {
    await seed(2)

    const page = unwrap(await listLinks({ limit: 5 }))

    expect(page.links).toHaveLength(2)
    expect(page.nextCursor).toBeNull()
  })

  it('pagina sem repetir nem pular itens', async () => {
    await seed(5)

    const first = unwrap(await listLinks({ limit: 2 }))
    const second = unwrap(
      await listLinks({ limit: 2, cursor: first.nextCursor ?? undefined })
    )
    const third = unwrap(
      await listLinks({ limit: 2, cursor: second.nextCursor ?? undefined })
    )

    const slugs = [...first.links, ...second.links, ...third.links].map(
      (l) => l.slug
    )

    expect(slugs).toEqual([
      'slug-004',
      'slug-003',
      'slug-002',
      'slug-001',
      'slug-000',
    ])
    expect(new Set(slugs).size).toBe(5)
  })

  it('não duplica nem esconde item quando um link é criado entre páginas', async () => {
    await seed(4)

    const first = unwrap(await listLinks({ limit: 2 }))

    // um link novo entra no topo da ordenação, deslocando as linhas
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/novo',
      slug: 'slug-novo',
      createdAt: new Date(Date.parse('2026-08-24T13:00:00Z')),
    })

    const second = unwrap(
      await listLinks({ limit: 2, cursor: first.nextCursor ?? undefined })
    )

    const slugs = [...first.links, ...second.links].map((l) => l.slug)

    expect(new Set(slugs).size).toBe(slugs.length)
    expect(second.links.map((l) => l.slug)).toEqual(['slug-001', 'slug-000'])
  })

  it('desempata por id quando createdAt é idêntico', async () => {
    const sameMoment = new Date('2026-08-24T12:00:00Z')

    await db.insert(schema.links).values([
      { originalUrl: 'https://a.com', slug: 'empate-a', createdAt: sameMoment },
      { originalUrl: 'https://b.com', slug: 'empate-b', createdAt: sameMoment },
      { originalUrl: 'https://c.com', slug: 'empate-c', createdAt: sameMoment },
    ])

    const first = unwrap(await listLinks({ limit: 2 }))
    const second = unwrap(
      await listLinks({ limit: 2, cursor: first.nextCursor ?? undefined })
    )

    const slugs = [...first.links, ...second.links].map((l) => l.slug)

    expect(new Set(slugs).size).toBe(3)
  })

  it('trata cursor inválido como primeira página', async () => {
    await seed(3)

    const page = unwrap(await listLinks({ cursor: 'lixo!!!' }))

    expect(page.links).toHaveLength(3)
  })
})
```

O sexto teste é a regressão que motivou o keyset (D11): com `OFFSET`, o item
`slug-001` apareceria duas vezes.

- [ ] **Step 5: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/app/functions/list-links.spec.ts`
Expected: FAIL — `Failed to resolve import "./list-links"`

- [ ] **Step 6: Implementar a listagem**

`server/src/app/functions/list-links.ts`:

```ts
import { and, desc, eq, lt, or } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { decodeCursor, encodeCursor } from '@/infra/shared/cursor'
import { type Either, makeRight } from '@/infra/shared/either'
import type { LinkOutput } from './create-link'

const listLinksInput = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type ListLinksInput = z.input<typeof listLinksInput>

export type ListLinksOutput = {
  links: LinkOutput[]
  nextCursor: string | null
}

export async function listLinks(
  input: ListLinksInput
): Promise<Either<Error, ListLinksOutput>> {
  const { cursor, limit } = listLinksInput.parse(input)

  const anchor = cursor ? decodeCursor(cursor) : null

  const condition = anchor
    ? or(
        lt(schema.links.createdAt, anchor.createdAt),
        and(eq(schema.links.createdAt, anchor.createdAt), lt(schema.links.id, anchor.id))
      )
    : undefined

  // busca uma linha a mais que o limite: a presença dela indica que existe
  // próxima página, sem precisar de um COUNT separado
  const rows = await db
    .select({
      id: schema.links.id,
      originalUrl: schema.links.originalUrl,
      slug: schema.links.slug,
      accessCount: schema.links.accessCount,
      createdAt: schema.links.createdAt,
    })
    .from(schema.links)
    .where(condition)
    .orderBy(desc(schema.links.createdAt), desc(schema.links.id))
    .limit(limit + 1)

  const hasNextPage = rows.length > limit
  const page = hasNextPage ? rows.slice(0, limit) : rows
  const last = page.at(-1)

  return makeRight({
    links: page.map(({ id: _id, ...publicFields }) => publicFields),
    nextCursor:
      hasNextPage && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null,
  })
}
```

O `id` é selecionado porque o cursor precisa dele, e removido do retorno pelo
destructuring — nunca chega à API (D6).

- [ ] **Step 7: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/infra/shared/cursor.spec.ts src/app/functions/list-links.spec.ts`
Expected: PASS — 4 + 9 testes

- [ ] **Step 8: Commit**

```bash
git add server/src/infra/shared/cursor.ts server/src/infra/shared/cursor.spec.ts server/src/app/functions/list-links.ts server/src/app/functions/list-links.spec.ts
git commit -m "feat(server): add keyset pagination and list-links use case"
```

---

## Task 8: Use-case `get-link-by-slug`

**Files:**
- Create: `server/src/app/functions/get-link-by-slug.ts`
- Test: `server/src/app/functions/get-link-by-slug.spec.ts`

**Interfaces:**
- Consumes: `db`, `links`, `Either`, `slugSchema`, `LinkNotFound`, `LinkOutput`.
- Produces: `getLinkBySlug(input: { slug: string }): Promise<Either<Error, LinkOutput>>`

- [ ] **Step 1: Escrever o teste**

`server/src/app/functions/get-link-by-slug.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'
import { getLinkBySlug } from './get-link-by-slug'

describe('getLinkBySlug', () => {
  it('devolve o link existente', async () => {
    await createLink({ originalUrl: 'https://example.com/x', slug: 'busca' })

    const result = await getLinkBySlug({ slug: 'busca' })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    expect(unwrapEither(result).originalUrl).toBe('https://example.com/x')
  })

  it('não incrementa o contador de acessos', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'sem-conta' })

    await getLinkBySlug({ slug: 'sem-conta' })
    const result = await getLinkBySlug({ slug: 'sem-conta' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(0)
  })

  it('encontra o link mesmo com grafia diferente', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'caixa' })

    expect(isRight(await getLinkBySlug({ slug: 'CAIXA' }))).toBe(true)
  })

  it('devolve LinkNotFound quando o slug não existe', async () => {
    const result = await getLinkBySlug({ slug: 'inexistente' })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(LinkNotFound)
  })
})
```

O segundo teste trava a separação entre resolver e contar (§4.3): se alguém
mover o incremento para dentro do `GET`, este teste falha.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/app/functions/get-link-by-slug.spec.ts`
Expected: FAIL — `Failed to resolve import "./get-link-by-slug"`

- [ ] **Step 3: Implementar**

`server/src/app/functions/get-link-by-slug.ts`:

```ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { slugSchema } from '@/infra/shared/schemas'
import type { LinkOutput } from './create-link'

const getLinkBySlugInput = z.object({ slug: slugSchema })

export type GetLinkBySlugInput = z.input<typeof getLinkBySlugInput>

export async function getLinkBySlug(
  input: GetLinkBySlugInput
): Promise<Either<Error, LinkOutput>> {
  const { slug } = getLinkBySlugInput.parse(input)

  const [found] = await db
    .select({
      originalUrl: schema.links.originalUrl,
      slug: schema.links.slug,
      accessCount: schema.links.accessCount,
      createdAt: schema.links.createdAt,
    })
    .from(schema.links)
    .where(eq(schema.links.slug, slug))
    .limit(1)

  if (!found) {
    return makeLeft(new LinkNotFound())
  }

  return makeRight(found)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/app/functions/get-link-by-slug.spec.ts`
Expected: PASS — 4 testes

- [ ] **Step 5: Commit**

```bash
git add server/src/app/functions/get-link-by-slug.ts server/src/app/functions/get-link-by-slug.spec.ts
git commit -m "feat(server): add get-link-by-slug use case"
```

---

## Task 9: Use-case `increment-link-visits`

**Files:**
- Create: `server/src/app/functions/increment-link-visits.ts`
- Test: `server/src/app/functions/increment-link-visits.spec.ts`

**Interfaces:**
- Consumes: `db`, `links`, `Either`, `slugSchema`, `LinkNotFound`.
- Produces: `incrementLinkVisits(input: { slug: string }):
  Promise<Either<Error, { accessCount: number }>>`

- [ ] **Step 1: Escrever o teste**

`server/src/app/functions/increment-link-visits.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'
import { incrementLinkVisits } from './increment-link-visits'

describe('incrementLinkVisits', () => {
  it('incrementa de 0 para 1 e devolve o novo total', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'contador' })

    const result = await incrementLinkVisits({ slug: 'contador' })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    expect(unwrapEither(result).accessCount).toBe(1)
  })

  it('acumula em chamadas sucessivas', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'acumula' })

    await incrementLinkVisits({ slug: 'acumula' })
    await incrementLinkVisits({ slug: 'acumula' })
    const result = await incrementLinkVisits({ slug: 'acumula' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(3)
  })

  it('não perde contagens sob chamadas concorrentes', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'corrida' })

    await Promise.all(
      Array.from({ length: 20 }, () => incrementLinkVisits({ slug: 'corrida' }))
    )

    const result = await incrementLinkVisits({ slug: 'corrida' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(21)
  })

  it('não afeta o contador de outros links', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'alvo' })
    await createLink({ originalUrl: 'https://b.com', slug: 'intacto' })

    await incrementLinkVisits({ slug: 'alvo' })
    const result = await incrementLinkVisits({ slug: 'intacto' })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).accessCount).toBe(1)
  })

  it('devolve LinkNotFound quando o slug não existe', async () => {
    const result = await incrementLinkVisits({ slug: 'inexistente' })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(LinkNotFound)
  })
})
```

O teste de concorrência é o que prova que a soma acontece no banco. Uma
implementação que lesse o valor, somasse em JavaScript e gravasse de volta
perderia contagens e falharia aqui.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/app/functions/increment-link-visits.spec.ts`
Expected: FAIL — `Failed to resolve import "./increment-link-visits"`

- [ ] **Step 3: Implementar**

`server/src/app/functions/increment-link-visits.ts`:

```ts
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { slugSchema } from '@/infra/shared/schemas'

const incrementLinkVisitsInput = z.object({ slug: slugSchema })

export type IncrementLinkVisitsInput = z.input<typeof incrementLinkVisitsInput>

export type IncrementLinkVisitsOutput = { accessCount: number }

export async function incrementLinkVisits(
  input: IncrementLinkVisitsInput
): Promise<Either<Error, IncrementLinkVisitsOutput>> {
  const { slug } = incrementLinkVisitsInput.parse(input)

  // a soma acontece no banco, numa única instrução: ler-somar-gravar na
  // aplicação perderia contagens sob acessos simultâneos
  const updated = await db
    .update(schema.links)
    .set({ accessCount: sql`${schema.links.accessCount} + 1` })
    .where(eq(schema.links.slug, slug))
    .returning({ accessCount: schema.links.accessCount })

  const row = updated[0]

  if (!row) {
    return makeLeft(new LinkNotFound())
  }

  return makeRight({ accessCount: row.accessCount })
}
```

O `RETURNING` vazio já sinaliza "slug inexistente" — dispensa um `SELECT`
prévio e fecha a janela de corrida entre as duas consultas.

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/app/functions/increment-link-visits.spec.ts`
Expected: PASS — 5 testes

- [ ] **Step 5: Commit**

```bash
git add server/src/app/functions/increment-link-visits.ts server/src/app/functions/increment-link-visits.spec.ts
git commit -m "feat(server): add increment-link-visits use case"
```

---

## Task 10: Use-case `delete-link`

**Files:**
- Create: `server/src/app/functions/delete-link.ts`
- Test: `server/src/app/functions/delete-link.spec.ts`

**Interfaces:**
- Consumes: `db`, `links`, `Either`, `slugSchema`, `LinkNotFound`.
- Produces: `deleteLink(input: { slug: string }): Promise<Either<Error, true>>`
  — o sucesso é `true`, nunca `undefined` (D7).

- [ ] **Step 1: Escrever o teste**

`server/src/app/functions/delete-link.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createLink } from './create-link'
import { deleteLink } from './delete-link'
import { getLinkBySlug } from './get-link-by-slug'

describe('deleteLink', () => {
  it('remove um link existente e devolve true', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'remover' })

    const result = await deleteLink({ slug: 'remover' })

    expect(isRight(result)).toBe(true)
    if (isLeft(result)) return

    expect(unwrapEither(result)).toBe(true)
    expect(isLeft(await getLinkBySlug({ slug: 'remover' }))).toBe(true)
  })

  it('não afeta os demais links', async () => {
    await createLink({ originalUrl: 'https://a.com', slug: 'sai' })
    await createLink({ originalUrl: 'https://b.com', slug: 'fica' })

    await deleteLink({ slug: 'sai' })

    expect(isRight(await getLinkBySlug({ slug: 'fica' }))).toBe(true)
  })

  it('devolve LinkNotFound quando o slug não existe', async () => {
    const result = await deleteLink({ slug: 'inexistente' })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(LinkNotFound)
  })

  it('devolve LinkNotFound ao remover o mesmo link duas vezes', async () => {
    await createLink({ originalUrl: 'https://example.com', slug: 'duas-vezes' })

    expect(isRight(await deleteLink({ slug: 'duas-vezes' }))).toBe(true)
    expect(isLeft(await deleteLink({ slug: 'duas-vezes' }))).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/app/functions/delete-link.spec.ts`
Expected: FAIL — `Failed to resolve import "./delete-link"`

- [ ] **Step 3: Implementar**

`server/src/app/functions/delete-link.ts`:

```ts
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { LinkNotFound } from '@/app/errors/link-not-found'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'
import { slugSchema } from '@/infra/shared/schemas'

const deleteLinkInput = z.object({ slug: slugSchema })

export type DeleteLinkInput = z.input<typeof deleteLinkInput>

export async function deleteLink(
  input: DeleteLinkInput
): Promise<Either<Error, true>> {
  const { slug } = deleteLinkInput.parse(input)

  const removed = await db
    .delete(schema.links)
    .where(eq(schema.links.slug, slug))
    .returning({ id: schema.links.id })

  if (removed.length === 0) {
    return makeLeft(new LinkNotFound())
  }

  // `true`, e não `undefined`: a implementação do Either discrimina os lados
  // por `!== undefined`, então makeRight(undefined) quebraria isRight (D7)
  return makeRight(true)
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/app/functions/delete-link.spec.ts`
Expected: PASS — 4 testes

- [ ] **Step 5: Commit**

```bash
git add server/src/app/functions/delete-link.ts server/src/app/functions/delete-link.spec.ts
git commit -m "feat(server): add delete-link use case"
```

---

## Task 11: Storage e use-case `export-links`

**Files:**
- Create: `server/src/infra/storage/uploader.ts`, `client.ts`, `r2-uploader.ts`
- Create: `server/src/test/in-memory-uploader.ts`
- Create: `server/src/app/functions/export-links.ts`
- Test: `server/src/app/functions/export-links.spec.ts`

**Interfaces:**
- Consumes: `db`, `pg`, `links`, `Either`, `NoLinksToExport`, `env`.
- Produces:
  ```ts
  interface Uploader {
    upload(input: {
      key: string
      contentType: string
      body: Readable
    }): Promise<{ key: string; url: string }>
  }
  createInMemoryUploader(): Uploader & { lastBody(): string; count(): number }
  exportLinks(input: { uploader: Uploader }):
    Promise<Either<Error, { reportUrl: string }>>
  ```

- [ ] **Step 1: Definir a interface do uploader**

`server/src/infra/storage/uploader.ts`:

```ts
import type { Readable } from 'node:stream'

export type UploadInput = {
  key: string
  contentType: string
  body: Readable
}

export type UploadResult = {
  key: string
  url: string
}

export interface Uploader {
  upload(input: UploadInput): Promise<UploadResult>
}
```

- [ ] **Step 2: Criar o duplo de teste**

`server/src/test/in-memory-uploader.ts`:

```ts
import type { Uploader } from '@/infra/storage/uploader'

export type InMemoryUploader = Uploader & {
  lastBody(): string
  lastKey(): string
  count(): number
}

export function createInMemoryUploader(
  publicUrl = 'http://localhost:9999'
): InMemoryUploader {
  const uploads: { key: string; body: string }[] = []

  return {
    async upload({ key, body }) {
      const chunks: Buffer[] = []

      for await (const chunk of body) {
        chunks.push(Buffer.from(chunk))
      }

      uploads.push({ key, body: Buffer.concat(chunks).toString('utf8') })

      return { key, url: `${publicUrl}/${key}` }
    },
    lastBody: () => uploads.at(-1)?.body ?? '',
    lastKey: () => uploads.at(-1)?.key ?? '',
    count: () => uploads.length,
  }
}
```

O duplo consome o stream de verdade, então os testes verificam o conteúdo real
do CSV — não apenas que a função foi chamada.

- [ ] **Step 3: Escrever o teste da exportação**

`server/src/app/functions/export-links.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { NoLinksToExport } from '@/app/errors/no-links-to-export'
import { db } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import { isLeft, isRight, unwrapEither } from '@/infra/shared/either'
import { createInMemoryUploader } from '@/test/in-memory-uploader'
import { exportLinks } from './export-links'

describe('exportLinks', () => {
  it('devolve NoLinksToExport quando não há links', async () => {
    const uploader = createInMemoryUploader()

    const result = await exportLinks({ uploader })

    expect(isLeft(result)).toBe(true)
    if (isRight(result)) return

    expect(unwrapEither(result)).toBeInstanceOf(NoLinksToExport)
    expect(uploader.count()).toBe(0)
  })

  it('gera o CSV com o cabeçalho das quatro colunas exigidas', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/a',
      slug: 'link-a',
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    const [header] = uploader.lastBody().split('\n')

    expect(header).toBe(
      'URL original,URL encurtada,Contagem de acessos,Data de criação'
    )
  })

  it('monta a URL encurtada completa, não apenas o slug', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com/a',
      slug: 'link-a',
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    const body = uploader.lastBody()

    expect(body).toContain('http://localhost:5173/link-a')
    expect(body).toContain('https://example.com/a')
  })

  it('inclui todas as linhas', async () => {
    await db.insert(schema.links).values(
      Array.from({ length: 30 }, (_, i) => ({
        originalUrl: `https://example.com/${i}`,
        slug: `slug-${i}`,
      }))
    )

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    const rows = uploader.lastBody().trim().split('\n')

    expect(rows).toHaveLength(31) // cabeçalho + 30 linhas
  })

  it('exporta a contagem de acessos', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com',
      slug: 'com-acessos',
      accessCount: 42,
    })

    const uploader = createInMemoryUploader()
    await exportLinks({ uploader })

    expect(uploader.lastBody()).toContain('42')
  })

  it('usa o prefixo exports/ e um nome único a cada chamada', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com',
      slug: 'unico',
    })

    const uploader = createInMemoryUploader()

    await exportLinks({ uploader })
    const first = uploader.lastKey()

    await exportLinks({ uploader })
    const second = uploader.lastKey()

    expect(first).toMatch(/^exports\/.+-links\.csv$/)
    expect(second).not.toBe(first)
  })

  it('devolve a reportUrl apontando para o objeto enviado', async () => {
    await db.insert(schema.links).values({
      originalUrl: 'https://example.com',
      slug: 'relatorio',
    })

    const uploader = createInMemoryUploader()
    const result = await exportLinks({ uploader })

    if (isLeft(result)) throw new Error('esperava sucesso')

    expect(unwrapEither(result).reportUrl).toContain(uploader.lastKey())
  })
})
```

O teste do nome único é o que protege o requisito do enunciado: um nome derivado
só de data e hora faria duas exportações próximas sobrescreverem uma à outra.

- [ ] **Step 4: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/app/functions/export-links.spec.ts`
Expected: FAIL — `Failed to resolve import "./export-links"`

- [ ] **Step 5: Implementar a exportação**

`server/src/app/functions/export-links.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { PassThrough, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { stringify } from 'csv-stringify'
import { desc } from 'drizzle-orm'
import { NoLinksToExport } from '@/app/errors/no-links-to-export'
import { env } from '@/env'
import { db, pg } from '@/infra/db'
import { schema } from '@/infra/db/schemas'
import type { Uploader } from '@/infra/storage/uploader'
import { type Either, makeLeft, makeRight } from '@/infra/shared/either'

export type ExportLinksInput = { uploader: Uploader }

export type ExportLinksOutput = { reportUrl: string }

/**
 * Linha como o cursor a entrega: nomes de coluna do banco (snake_case).
 * `pg.unsafe` passa por baixo do mapeamento do Drizzle, então os campos NÃO
 * chegam em camelCase.
 */
type RawRow = {
  original_url: string
  slug: string
  access_count: number
  created_at: string
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export async function exportLinks({
  uploader,
}: ExportLinksInput): Promise<Either<Error, ExportLinksOutput>> {
  const [anyLink] = await db.select({ id: schema.links.id }).from(schema.links).limit(1)

  if (!anyLink) {
    return makeLeft(new NoLinksToExport())
  }

  const { sql, params } = db
    .select({
      originalUrl: schema.links.originalUrl,
      slug: schema.links.slug,
      accessCount: schema.links.accessCount,
      createdAt: schema.links.createdAt,
    })
    .from(schema.links)
    .orderBy(desc(schema.links.createdAt), desc(schema.links.id))
    .toSQL()

  // cursor real do Postgres: memória constante, snapshot consistente.
  // Lotes por LIMIT/OFFSET seriam O(n²) e permitiriam linhas duplicadas.
  const cursor = pg.unsafe(sql, params as string[]).cursor(50)

  const toCsvRow = new Transform({
    objectMode: true,
    transform(batch: RawRow[], _encoding, callback) {
      for (const row of batch) {
        this.push({
          originalUrl: row.original_url,
          shortUrl: `${env.FRONTEND_URL}/${row.slug}`,
          accessCount: row.access_count,
          createdAt: dateFormatter.format(new Date(row.created_at)),
        })
      }

      callback()
    },
  })

  const csv = stringify({
    header: true,
    columns: [
      { key: 'originalUrl', header: 'URL original' },
      { key: 'shortUrl', header: 'URL encurtada' },
      { key: 'accessCount', header: 'Contagem de acessos' },
      { key: 'createdAt', header: 'Data de criação' },
    ],
  })

  const body = new PassThrough()

  const csvPipeline = pipeline(cursor, toCsvRow, csv, body)

  // o upload precisa começar ANTES de o pipeline bombear: sem consumidor, o
  // PassThrough enche o buffer e o pipeline trava por contrapressão
  const uploadPromise = uploader.upload({
    key: `exports/${randomUUID()}-links.csv`,
    contentType: 'text/csv',
    body,
  })

  const [uploaded] = await Promise.all([uploadPromise, csvPipeline])

  return makeRight({ reportUrl: uploaded.url })
}
```

- [ ] **Step 6: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/app/functions/export-links.spec.ts`
Expected: PASS — 7 testes

- [ ] **Step 7: Implementar o uploader real do R2**

`server/src/infra/storage/client.ts`:

```ts
import { S3Client } from '@aws-sdk/client-s3'
import { env } from '@/env'

export const r2 = new S3Client({
  region: 'auto',
  endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: env.CLOUDFLARE_ACCESS_KEY_ID,
    secretAccessKey: env.CLOUDFLARE_SECRET_ACCESS_KEY,
  },
})
```

`server/src/infra/storage/r2-uploader.ts`:

```ts
import { Upload } from '@aws-sdk/lib-storage'
import { env } from '@/env'
import { r2 } from './client'
import type { Uploader } from './uploader'

export const r2Uploader: Uploader = {
  async upload({ key, contentType, body }) {
    // Upload (multipart) e não PutObjectCommand: este exige Content-Length
    // conhecido de antemão, impossível com stream de tamanho desconhecido.
    // Cuidado: o buffer é partSize × queueSize — aumentar partSize multiplica
    // o consumo mínimo de memória (§4.5).
    const upload = new Upload({
      client: r2,
      params: {
        Bucket: env.CLOUDFLARE_BUCKET,
        Key: key,
        Body: body,
        ContentType: contentType,
        // habilita o download no front sem bloqueio de popup (§5.4)
        ContentDisposition: 'attachment',
      },
    })

    await upload.done()

    return {
      key,
      url: `${env.CLOUDFLARE_PUBLIC_URL.replace(/\/$/, '')}/${key}`,
    }
  },
}
```

- [ ] **Step 8: Rodar a suíte inteira**

Run: `cd server && pnpm test`
Expected: PASS — todos os arquivos.

- [ ] **Step 9: Commit**

```bash
git add server/src/infra/storage/ server/src/test/in-memory-uploader.ts server/src/app/functions/export-links.ts server/src/app/functions/export-links.spec.ts
git commit -m "feat(server): add R2 storage and export-links use case"
```

---

## Task 12: Aplicação HTTP, tratamento de erros e rota `POST /links`

**Files:**
- Create: `server/src/infra/http/error-handler.ts`, `app.ts`, `server.ts`
- Create: `server/src/infra/http/routes/create-link.ts`
- Test: `server/src/infra/http/routes/create-link.spec.ts`

**Interfaces:**
- Consumes: todos os use-cases, `env`.
- Produces: `buildApp(): Promise<FastifyInstance>` — aplicação configurada e
  pronta para `.inject()` ou `.listen()`; `linkToJson(link: LinkOutput)` que
  serializa `createdAt` como ISO 8601.

- [ ] **Step 1: Escrever o teste de rota**

`server/src/infra/http/routes/create-link.spec.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

describe('POST /links', () => {
  it('cria o link e responde 201', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://example.com/a', slug: 'novo-link' },
    })

    expect(response.statusCode).toBe(201)

    const body = response.json()

    expect(body.slug).toBe('novo-link')
    expect(body.accessCount).toBe(0)
    expect(typeof body.createdAt).toBe('string')
    expect(body).not.toHaveProperty('id')
  })

  it('responde 409 para slug duplicado', async () => {
    await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://a.com', slug: 'repetido' },
    })

    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://b.com', slug: 'repetido' },
    })

    expect(response.statusCode).toBe(409)
    expect(response.json().message).toBeTruthy()
  })

  it('responde 409 para slug reservado', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'https://a.com', slug: 'assets' },
    })

    expect(response.statusCode).toBe(409)
  })

  it('responde 400 com issues para URL inválida', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'nao-e-url', slug: 'valido' },
    })

    expect(response.statusCode).toBe(400)

    const body = response.json()

    expect(body.message).toBeTruthy()
    expect(Array.isArray(body.issues)).toBe(true)
    expect(body.issues[0]).toHaveProperty('path')
    expect(body.issues[0]).toHaveProperty('message')
  })

  it('responde 400 quando dois campos são inválidos, listando os dois', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links',
      payload: { originalUrl: 'nao-e-url', slug: 'ab' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json().issues.length).toBeGreaterThanOrEqual(2)
  })
})
```

O último teste trava o motivo de o corpo de 400 ter `issues`: achatar a
validação numa mensagem só faria o formulário do front exibir um erro quando
existem dois (§4.3).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/infra/http/routes/create-link.spec.ts`
Expected: FAIL — `Failed to resolve import "../app"`

- [ ] **Step 3: Implementar o tratador de erros**

`server/src/infra/http/error-handler.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod'
import { ZodError } from 'zod'

const STATUS_BY_ERROR_NAME: Record<string, number> = {
  SlugAlreadyExists: 409,
  SlugIsReserved: 409,
  LinkNotFound: 404,
  NoLinksToExport: 422,
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (hasZodFastifySchemaValidationErrors(error)) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        issues: error.validation.map((issue) => ({
          path: issue.instancePath.replace(/^\//, '') || 'body',
          message: issue.message ?? 'Valor inválido',
        })),
      })
    }

    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: 'Dados inválidos.',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const status = STATUS_BY_ERROR_NAME[error.name]

    if (status) {
      return reply.status(status).send({ message: error.message })
    }

    // logger do Fastify, não console: sai estruturado e correlacionado
    // com a requisição (§4.8)
    request.log.error(error)

    return reply.status(500).send({ message: 'Erro interno do servidor.' })
  })
}
```

O `ZodError` aparece duas vezes por motivos diferentes: a primeira captura a
validação que o `fastify-type-provider-zod` faz na borda; a segunda captura o
`.parse()` que roda dentro dos use-cases.

- [ ] **Step 4: Criar os schemas de resposta compartilhados**

`server/src/infra/http/schemas.ts`:

```ts
import { z } from 'zod'

export const linkSchema = z.object({
  originalUrl: z.string(),
  slug: z.string(),
  accessCount: z.number().int(),
  createdAt: z.string(),
})

export const errorSchema = z.object({
  message: z.string(),
  issues: z
    .array(z.object({ path: z.string(), message: z.string() }))
    .optional(),
})
```

- [ ] **Step 5: Implementar a rota**

`server/src/infra/http/routes/create-link.ts`:

```ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { createLink } from '@/app/functions/create-link'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { linkSchema, errorSchema } from '../schemas'

export const createLinkRoute: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/links',
    {
      schema: {
        summary: 'Cria um link encurtado',
        tags: ['links'],
        body: z.object({
          originalUrl: z.string(),
          slug: z.string(),
        }),
        response: {
          201: linkSchema,
          400: errorSchema,
          409: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await createLink(request.body)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      const link = unwrapEither(result)

      return reply.status(201).send({
        originalUrl: link.originalUrl,
        slug: link.slug,
        accessCount: link.accessCount,
        createdAt: link.createdAt.toISOString(),
      })
    }
  )
}
```

A rota **lança** o erro do `Left` em vez de mapear o status ali mesmo. O
tratador central converte, e assim o mapeamento erro → status existe num único
lugar, em vez de repetido em seis rotas.

**O schema do `body` é deliberadamente frouxo** (`z.string()`, sem validar
formato). A validação real — URL válida, regex do slug, normalização — acontece
no `createLinkInput.parse()` dentro do use-case. Duas razões: a regra fica junto
do domínio, testável sem HTTP; e o use-case continua protegido mesmo se chamado
de outro lugar que não a rota. Na prática isso significa que o caminho de
validação percorrido é o `ZodError` do use-case, não o do type provider — e como
o Zod acumula todos os problemas num só `ZodError`, os dois campos inválidos
aparecem juntos em `issues`.

- [ ] **Step 6: Montar a aplicação**

`server/src/infra/http/app.ts`:

```ts
import cors from '@fastify/cors'
import { fastify } from 'fastify'
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { env } from '@/env'
import { registerErrorHandler } from './error-handler'
import { createLinkRoute } from './routes/create-link'

export async function buildApp() {
  const app = fastify({ logger: { level: 'warn' } })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  registerErrorHandler(app)

  const origins = env.FRONTEND_URL.split(',').map((o) => o.trim())

  await app.register(cors, { origin: origins })

  await app.register(createLinkRoute)

  return app
}
```

- [ ] **Step 7: Criar o bootstrap**

`server/src/infra/http/server.ts`:

```ts
import { env } from '@/env'
import { buildApp } from './app'

const app = await buildApp()

await app.listen({ port: env.PORT, host: '0.0.0.0' })

const origins = env.FRONTEND_URL.split(',').map((o) => o.trim())

// logar as origens permitidas: CORS mal configurado falha no navegador,
// sem nenhum sinal do lado do servidor (§4.8)
app.log.warn(`Servidor em http://localhost:${env.PORT}`)
app.log.warn(`Origens de CORS permitidas: ${origins.join(', ')}`)
```

- [ ] **Step 8: Rodar e confirmar que passa**

Run: `cd server && pnpm exec vitest run src/infra/http/routes/create-link.spec.ts`
Expected: PASS — 5 testes

- [ ] **Step 9: Verificar o servidor de verdade**

```bash
cd server && pnpm dev
```

Noutro terminal:

```bash
curl -s -X POST http://localhost:3333/links \
  -H 'content-type: application/json' \
  -d '{"originalUrl":"https://rocketseat.com.br","slug":"rocket"}' | jq
```

Expected: 201 com `{ originalUrl, slug, accessCount: 0, createdAt }`, sem `id`.

- [ ] **Step 10: Commit**

```bash
git add server/src/infra/http/
git commit -m "feat(server): add http app, error handler and create-link route"
```

---

## Task 13: Rotas restantes e documentação OpenAPI

**Files:**
- Create: `server/src/infra/http/routes/list-links.ts`,
  `get-link-by-slug.ts`, `increment-link-visits.ts`, `delete-link.ts`,
  `export-links.ts`
- Modify: `server/src/infra/http/app.ts`
- Test: `server/src/infra/http/routes/links.spec.ts`

**Interfaces:**
- Consumes: `buildApp`, todos os use-cases, `r2Uploader`.
- Produces: as 6 rotas registradas na aplicação.

- [ ] **Step 1: Escrever o teste das rotas restantes**

`server/src/infra/http/routes/links.spec.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from '../app'

let app: FastifyInstance

beforeAll(async () => {
  app = await buildApp()
  await app.ready()
})

afterAll(async () => {
  await app.close()
})

async function create(slug: string, originalUrl = 'https://example.com/a') {
  return app.inject({
    method: 'POST',
    url: '/links',
    payload: { originalUrl, slug },
  })
}

describe('GET /links', () => {
  it('devolve lista vazia com nextCursor null', async () => {
    const response = await app.inject({ method: 'GET', url: '/links' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ links: [], nextCursor: null })
  })

  it('pagina com cursor', async () => {
    await create('um')
    await create('dois')
    await create('tres')

    const first = await app.inject({ method: 'GET', url: '/links?limit=2' })

    expect(first.json().links).toHaveLength(2)

    const cursor = first.json().nextCursor

    expect(cursor).not.toBeNull()

    const second = await app.inject({
      method: 'GET',
      url: `/links?limit=2&cursor=${encodeURIComponent(cursor)}`,
    })

    expect(second.json().links).toHaveLength(1)
    expect(second.json().nextCursor).toBeNull()
  })
})

describe('GET /links/:slug', () => {
  it('resolve o slug e responde 200', async () => {
    await create('resolver', 'https://example.com/destino')

    const response = await app.inject({
      method: 'GET',
      url: '/links/resolver',
    })

    expect(response.statusCode).toBe(200)
    expect(response.json().originalUrl).toBe('https://example.com/destino')
  })

  it('responde 404 para slug inexistente', async () => {
    const response = await app.inject({ method: 'GET', url: '/links/nada' })

    expect(response.statusCode).toBe(404)
  })
})

describe('PATCH /links/:slug/visits', () => {
  it('responde 204 e incrementa o contador', async () => {
    await create('visitas')

    const response = await app.inject({
      method: 'PATCH',
      url: '/links/visitas/visits',
    })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')

    const link = await app.inject({ method: 'GET', url: '/links/visitas' })

    expect(link.json().accessCount).toBe(1)
  })

  it('responde 404 para slug inexistente', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/links/nada/visits',
    })

    expect(response.statusCode).toBe(404)
  })
})

describe('DELETE /links/:slug', () => {
  it('responde 204 e remove o link', async () => {
    await create('apagar')

    const response = await app.inject({
      method: 'DELETE',
      url: '/links/apagar',
    })

    expect(response.statusCode).toBe(204)

    const link = await app.inject({ method: 'GET', url: '/links/apagar' })

    expect(link.statusCode).toBe(404)
  })

  it('responde 404 para slug inexistente', async () => {
    const response = await app.inject({ method: 'DELETE', url: '/links/nada' })

    expect(response.statusCode).toBe(404)
  })
})

describe('POST /links/exports', () => {
  it('responde 422 quando não há links', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/links/exports',
    })

    expect(response.statusCode).toBe(422)
  })
})
```

O teste de exportação cobre só o caso 422 porque o caminho de sucesso exige o
R2 real — o conteúdo do CSV já está coberto na Task 11, com o duplo em memória.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd server && pnpm exec vitest run src/infra/http/routes/links.spec.ts`
Expected: FAIL — 404 em todas as rotas ainda não registradas.

- [ ] **Step 3: Implementar `GET /links`**

`server/src/infra/http/routes/list-links.ts`:

```ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { listLinks } from '@/app/functions/list-links'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema, linkSchema } from '../schemas'

export const listLinksRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/links',
    {
      schema: {
        summary: 'Lista os links, do mais recente para o mais antigo',
        description: [
          'Retorna **todos** os links cadastrados, percorridos por páginas.',
          '',
          'Chame sem parâmetros para obter a primeira página. Enquanto',
          '`nextCursor` não for `null`, repita a chamada passando esse valor',
          'em `cursor` para receber a página seguinte — a concatenação das',
          'páginas é a lista completa.',
          '',
          'A paginação é por âncora (keyset), não por deslocamento: criar ou',
          'remover links durante a navegação não duplica nem esconde itens.',
        ].join('\n'),
        tags: ['links'],
        querystring: z.object({
          cursor: z
            .string()
            .optional()
            .describe('Cursor da página anterior. Omitir para a primeira.'),
          limit: z.coerce
            .number()
            .int()
            .min(1)
            .max(100)
            .optional()
            .describe('Itens por página. Padrão 20, máximo 100.'),
        }),
        response: {
          200: z.object({
            links: z.array(linkSchema),
            nextCursor: z.string().nullable(),
          }),
          400: errorSchema,
        },
      },
    },
    async (request, reply) => {
      const result = await listLinks(request.query)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      const page = unwrapEither(result)

      return reply.status(200).send({
        links: page.links.map((link) => ({
          originalUrl: link.originalUrl,
          slug: link.slug,
          accessCount: link.accessCount,
          createdAt: link.createdAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
      })
    }
  )
}
```

- [ ] **Step 4: Implementar `GET /links/:slug`**

`server/src/infra/http/routes/get-link-by-slug.ts`:

```ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { getLinkBySlug } from '@/app/functions/get-link-by-slug'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema, linkSchema } from '../schemas'

export const getLinkBySlugRoute: FastifyPluginAsyncZod = async (app) => {
  app.get(
    '/links/:slug',
    {
      schema: {
        summary: 'Resolve um slug para a URL original',
        description: 'Não incrementa a contagem de acessos.',
        tags: ['links'],
        params: z.object({ slug: z.string() }),
        response: { 200: linkSchema, 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const result = await getLinkBySlug(request.params)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      const link = unwrapEither(result)

      return reply.status(200).send({
        originalUrl: link.originalUrl,
        slug: link.slug,
        accessCount: link.accessCount,
        createdAt: link.createdAt.toISOString(),
      })
    }
  )
}
```

- [ ] **Step 5: Implementar `PATCH /links/:slug/visits`**

`server/src/infra/http/routes/increment-link-visits.ts`:

```ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { incrementLinkVisits } from '@/app/functions/increment-link-visits'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema } from '../schemas'

export const incrementLinkVisitsRoute: FastifyPluginAsyncZod = async (app) => {
  app.patch(
    '/links/:slug/visits',
    {
      schema: {
        summary: 'Incrementa a contagem de acessos de um link',
        tags: ['links'],
        params: z.object({ slug: z.string() }),
        response: { 204: z.void(), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const result = await incrementLinkVisits(request.params)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      // o use-case devolve { accessCount }, descartado aqui: a resposta é 204
      return reply.status(204).send()
    }
  )
}
```

- [ ] **Step 6: Implementar `DELETE /links/:slug`**

`server/src/infra/http/routes/delete-link.ts`:

```ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { deleteLink } from '@/app/functions/delete-link'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema } from '../schemas'

export const deleteLinkRoute: FastifyPluginAsyncZod = async (app) => {
  app.delete(
    '/links/:slug',
    {
      schema: {
        summary: 'Remove um link',
        tags: ['links'],
        params: z.object({ slug: z.string() }),
        response: { 204: z.void(), 400: errorSchema, 404: errorSchema },
      },
    },
    async (request, reply) => {
      const result = await deleteLink(request.params)

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      return reply.status(204).send()
    }
  )
}
```

- [ ] **Step 7: Implementar `POST /links/exports`**

`server/src/infra/http/routes/export-links.ts`:

```ts
import type { FastifyPluginAsyncZod } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { exportLinks } from '@/app/functions/export-links'
import { r2Uploader } from '@/infra/storage/r2-uploader'
import { isLeft, unwrapEither } from '@/infra/shared/either'
import { errorSchema } from '../schemas'

export const exportLinksRoute: FastifyPluginAsyncZod = async (app) => {
  app.post(
    '/links/exports',
    {
      schema: {
        summary: 'Gera o CSV dos links e devolve a URL pública',
        tags: ['links'],
        response: {
          200: z.object({ reportUrl: z.string() }),
          422: errorSchema,
        },
      },
    },
    async (_request, reply) => {
      const result = await exportLinks({ uploader: r2Uploader })

      if (isLeft(result)) {
        throw unwrapEither(result)
      }

      return reply.status(200).send(unwrapEither(result))
    }
  )
}
```

- [ ] **Step 8: Registrar tudo e adicionar o OpenAPI**

Substituir `server/src/infra/http/app.ts`:

```ts
import cors from '@fastify/cors'
import { fastifySwagger } from '@fastify/swagger'
import scalar from '@scalar/fastify-api-reference'
import { fastify } from 'fastify'
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import { env } from '@/env'
import { registerErrorHandler } from './error-handler'
import { createLinkRoute } from './routes/create-link'
import { deleteLinkRoute } from './routes/delete-link'
import { exportLinksRoute } from './routes/export-links'
import { getLinkBySlugRoute } from './routes/get-link-by-slug'
import { incrementLinkVisitsRoute } from './routes/increment-link-visits'
import { listLinksRoute } from './routes/list-links'

export async function buildApp() {
  const app = fastify({ logger: { level: 'warn' } })

  app.setValidatorCompiler(validatorCompiler)
  app.setSerializerCompiler(serializerCompiler)

  registerErrorHandler(app)

  const origins = env.FRONTEND_URL.split(',').map((o) => o.trim())

  await app.register(cors, { origin: origins })

  await app.register(fastifySwagger, {
    openapi: {
      info: { title: 'Brev.ly API', version: '1.0.0' },
    },
    transform: jsonSchemaTransform,
  })

  await app.register(scalar, { routePrefix: '/docs' })

  await app.register(createLinkRoute)
  await app.register(listLinksRoute)
  await app.register(getLinkBySlugRoute)
  await app.register(incrementLinkVisitsRoute)
  await app.register(deleteLinkRoute)
  await app.register(exportLinksRoute)

  return app
}
```

**Ordem importa:** `/links/exports` precisa ser registrada depois de
`/links/:slug`? Não — o Fastify prioriza segmento estático sobre paramétrico,
então `POST /links/exports` e `GET /links/:slug` não conflitam (são métodos
diferentes de qualquer forma). A ordem acima segue a leitura natural do CRUD.

- [ ] **Step 9: Rodar a suíte inteira**

Run: `cd server && pnpm test`
Expected: PASS — todos os arquivos, incluindo os 9 novos testes de rota.

- [ ] **Step 10: Conferir a documentação no navegador**

```bash
cd server && pnpm dev
```

Abrir `http://localhost:3333/docs`.
Expected: as 6 rotas listadas com seus schemas.

- [ ] **Step 11: Commit**

```bash
git add server/src/infra/http/
git commit -m "feat(server): add remaining routes and OpenAPI documentation"
```

---

## Task 14: Seed de dados

**Files:**
- Create: `server/src/scripts/seed.ts`

**Interfaces:**
- Consumes: `db`, `links`, `pg`.
- Produces: script executável por `pnpm db:seed`.

- [ ] **Step 1: Implementar o seed**

`server/src/scripts/seed.ts`:

```ts
import { db, pg } from '@/infra/db'
import { schema } from '@/infra/db/schemas'

const TOTAL = 20_000
const BATCH_SIZE = 5_000

async function seed() {
  console.log(`Criando ${TOTAL.toLocaleString('pt-BR')} links de teste...`)

  const startedAt = Date.now()

  await db.delete(schema.links)

  for (let offset = 0; offset < TOTAL; offset += BATCH_SIZE) {
    const size = Math.min(BATCH_SIZE, TOTAL - offset)

    const batch = Array.from({ length: size }, (_, i) => {
      const index = offset + i

      return {
        originalUrl: `https://example.com/pagina/${index}`,
        slug: `teste-${index}`,
        accessCount: index % 100,
        // createdAt escalonado: sem isso todas as linhas teriam o mesmo
        // instante e a paginação keyset dependeria só do desempate por id
        createdAt: new Date(Date.now() - index * 1000),
      }
    })

    await db.insert(schema.links).values(batch)

    console.log(`  ${offset + size}/${TOTAL}`)
  }

  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(2)

  console.log(`Concluído em ${elapsed}s`)

  await pg.end()
}

seed().catch((error) => {
  console.error('Falha no seed:', error)
  process.exit(1)
})
```

O volume de 20.000 é deliberado: o requisito de "listagem performática" só é
demonstrável com dados suficientes para que paginação e índice façam diferença
observável (§4.7).

- [ ] **Step 2: Rodar o seed**

Run: `cd server && pnpm db:seed`
Expected: contagem progressiva até 20.000 e o tempo total.

- [ ] **Step 3: Verificar que a listagem continua rápida**

```bash
cd server && pnpm dev
```

Noutro terminal:

```bash
time curl -s 'http://localhost:3333/links?limit=20' -o /dev/null
```

Expected: resposta em dezenas de milissegundos, apesar das 20.000 linhas.

- [ ] **Step 4: Confirmar que o índice está sendo usado**

```bash
docker compose exec postgres psql -U postgres -d brevly -c \
  'EXPLAIN ANALYZE SELECT * FROM links ORDER BY created_at DESC, id DESC LIMIT 20;'
```

Expected: o plano menciona `Index Scan using links_created_at_id_idx`. Se
aparecer `Seq Scan` seguido de `Sort`, o índice composto da Task 2 não foi
criado corretamente.

- [ ] **Step 5: Commit**

```bash
git add server/src/scripts/seed.ts
git commit -m "feat(server): add database seed script"
```

---

## Task 15: Dockerfile e orquestração completa

**Files:**
- Create: `server/Dockerfile`, `server/.dockerignore`
- Modify: `docker-compose.yml`

**Interfaces:**
- Consumes: o pacote `server` completo.
- Produces: imagem da aplicação e serviços `server` e `migrate` no compose.

- [ ] **Step 1: Criar o `.dockerignore`**

`server/.dockerignore`:

```
node_modules
dist
.env
.env.test
*.log
```

- [ ] **Step 2: Escrever o Dockerfile**

`server/Dockerfile`:

```dockerfile
# node:22-alpine (LTS), não a versão local — a imagem precisa ser
# reprodutível independente da máquina de quem builda
FROM node:22-alpine AS base
WORKDIR /app
RUN corepack enable

FROM base AS builder
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --frozen-lockfile --filter server
COPY server server
RUN pnpm --filter server build

FROM base AS runtime
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/package.json
RUN pnpm install --prod --frozen-lockfile --filter server

COPY --from=builder /app/server/dist ./server/dist
COPY server/src/infra/db/migrations ./server/src/infra/db/migrations
COPY server/drizzle.config.ts ./server/drizzle.config.ts

# usuário non-root: a imagem funciona sem isso, e é o item de "boas
# práticas" mais fácil de esquecer
RUN chown -R node:node /app
USER node

WORKDIR /app/server
EXPOSE 3333
CMD ["node", "dist/infra/http/server.js"]
```

⚠️ **Ao adicionar `web` ao `pnpm-workspace.yaml`** (no plano do front), o
lockfile passa a incluí-lo e o `--frozen-lockfile` acima falhará por não achar
`web/package.json` no contexto. A correção é acrescentar
`COPY web/package.json web/package.json` nos dois estágios que instalam
dependências.

- [ ] **Step 3: Construir a imagem**

Run: `docker build -f server/Dockerfile -t brevly-server .`
Expected: build conclui sem erro.

- [ ] **Step 4: Confirmar que roda como non-root**

Run: `docker run --rm brevly-server whoami`
Expected: `node` (não `root`)

- [ ] **Step 5: Completar o compose**

Acrescentar a `docker-compose.yml`:

```yaml
  server:
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: brevly-server
    restart: unless-stopped
    env_file:
      - ./server/.env
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/brevly
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - '3333:3333'

  migrate:
    profiles: ['tools']
    restart: 'no'
    build:
      context: .
      dockerfile: server/Dockerfile
    container_name: brevly-migrate
    env_file:
      - ./server/.env
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/brevly
    depends_on:
      postgres:
        condition: service_healthy
    command: ['npx', 'drizzle-kit', 'migrate']
```

As migrations rodam num serviço separado, sob o profile `tools`, e não no
entrypoint do `server`: mantém a imagem da aplicação com uma responsabilidade
só e torna o momento de migrar uma decisão explícita (§4.8).

- [ ] **Step 6: Subir a pilha completa**

```bash
docker compose down
docker compose up -d postgres
docker compose --profile tools run --rm migrate
docker compose up -d server
```

- [ ] **Step 7: Verificar de ponta a ponta**

```bash
curl -s -X POST http://localhost:3333/links \
  -H 'content-type: application/json' \
  -d '{"originalUrl":"https://rocketseat.com.br","slug":"docker-ok"}' | jq

curl -s http://localhost:3333/links | jq
```

Expected: 201 na criação e o link presente na listagem.

- [ ] **Step 8: Verificar a persistência do volume**

```bash
docker compose down
docker compose up -d postgres server
sleep 5
curl -s http://localhost:3333/links/docker-ok | jq
```

Expected: o link continua existindo. Se voltar 404, o volume está montado no
caminho errado (§7) — conferir se é `/var/lib/postgresql/data`.

- [ ] **Step 9: Verificar que o CSV é acessível pela CDN**

⚠️ **Requer credenciais reais do R2 em `server/.env`.** Este é o único passo do
plano que exige o bucket criado, e é o que fecha o requisito "acessar o CSV por
meio de uma CDN" — os testes automatizados usam duplo em memória e provam o
conteúdo do arquivo, não a sua publicação.

```bash
# gera o relatório e captura a URL retornada
REPORT_URL=$(curl -s -X POST http://localhost:3333/links/exports | jq -r .reportUrl)
echo "$REPORT_URL"

# baixa o arquivo direto da CDN, sem passar pela API
curl -sS -D - -o /tmp/relatorio.csv "$REPORT_URL" | head -n 12

head -n 3 /tmp/relatorio.csv
```

Expected:
- `HTTP/2 200`
- `content-type: text/csv`
- `content-disposition: attachment`
- primeira linha do arquivo:
  `URL original,URL encurtada,Contagem de acessos,Data de criação`
- as linhas seguintes com a URL encurtada completa
  (`http://localhost:5173/...`), não apenas o slug

**Diagnóstico se falhar:**

| Sintoma | Causa provável |
|---|---|
| `403` ou `401` ao baixar | domínio público do bucket não habilitado |
| `404` ao baixar | `CLOUDFLARE_PUBLIC_URL` aponta para outro bucket, ou tem barra final duplicada |
| erro no `POST` | token do R2 sem permissão de escrita |
| `422` no `POST` | não há links cadastrados — criar um antes |
| coluna com o slug puro | `FRONTEND_URL` não está sendo concatenada no `Transform` |

- [ ] **Step 10: Confirmar a regra de ciclo de vida no bucket**

No painel do R2, verificar que existe uma regra expirando objetos com prefixo
`exports/` após 7 dias (D15).

É configuração de painel, invisível no repositório: nada no código denuncia a
ausência, e sem ela o armazenamento cresce indefinidamente, já que cada
exportação cria um objeto novo e nada os remove.

- [ ] **Step 11: Commit**

```bash
git add server/Dockerfile server/.dockerignore docker-compose.yml
git commit -m "feat(server): add multi-stage Dockerfile and compose services"
```

---

## Task 16: Lint, formatação e README

**Files:**
- Create: `README.md` (substitui o atual)
- Create: `.github/workflows/tests.yml`

**Interfaces:**
- Consumes: tudo.
- Produces: `pnpm lint` limpo e instruções de execução.

- [ ] **Step 1: Rodar lint e formatação**

O `biome.json` da raiz já foi criado na Task 1 e cobre os dois pacotes.

```bash
pnpm --filter server format && pnpm --filter server lint
```

Corrigir o que aparecer. O `biome check --write` aplica formatação, ordena os
imports e corrige o que for auto-corrigível numa passada só.

Expected: sem erros. Corrigir o que aparecer.

- [ ] **Step 2: Adicionar CI rodando os testes**

`.github/workflows/tests.yml`:

```yaml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    name: Server test suite
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:17-alpine
        ports:
          - 5432:5432
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: brevly_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 11

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter server test
```

O serviço já sobe com `POSTGRES_DB: brevly_test`, então o `init.sql` não é
necessário aqui. O `pretest` aplica as migrations, e o `.env.test` versionado
(Task 1) fornece a `DATABASE_URL` — é o que torna o workflow tão curto: nenhum
segredo a configurar.

Não é exigido pelo enunciado. Vale pelo que demonstra: a suíte roda numa
máquina limpa, não só na sua.

- [ ] **Step 3: Escrever o README**

`README.md` na raiz:

````markdown
# Brev.ly — Encurtador de URLs

Aplicação fullstack para gerenciamento de URLs encurtadas, com API REST em
Fastify e interface React.

- **Design e decisões técnicas:** [`docs/DESIGN.md`](./docs/DESIGN.md)
- **Plano do servidor:** [`docs/PLAN-SERVER.md`](./docs/PLAN-SERVER.md)

## Estrutura

```
url-shortener/
├── server/   ← API REST + DevOps
└── web/      ← SPA React + Vite
```

## Requisitos

Node 22+ · pnpm 11+ · Docker

## Configuração

```bash
pnpm install

cp server/.env.example server/.env
cp server/.env.test.example server/.env.test
```

### Variáveis de ambiente do servidor

| Chave | Descrição |
|---|---|
| `PORT` | Porta da API (padrão `3333`) |
| `DATABASE_URL` | Conexão PostgreSQL |
| `FRONTEND_URL` | Base pública do front. Define as origens de CORS e monta a coluna "URL encurtada" do CSV. **Deve ser igual a `VITE_FRONTEND_URL` do web** — se divergirem, a interface e o relatório mostram endereços diferentes para o mesmo link |
| `CLOUDFLARE_ACCOUNT_ID` | ID da conta Cloudflare |
| `CLOUDFLARE_ACCESS_KEY_ID` | Chave de acesso do token R2 |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | Segredo do token R2 |
| `CLOUDFLARE_BUCKET` | Nome do bucket |
| `CLOUDFLARE_PUBLIC_URL` | Domínio público do bucket |

## Configuração do bucket R2

1. Criar um bucket no painel R2 da Cloudflare.
2. Gerar um API token S3-compatível com permissão de leitura e escrita.
3. Habilitar o domínio público do bucket e usá-lo em `CLOUDFLARE_PUBLIC_URL`.
4. **Criar uma regra de ciclo de vida** que expire objetos com o prefixo
   `exports/` após 7 dias.

O passo 4 não é opcional: cada exportação cria um objeto novo e nada os
remove, então sem ele o armazenamento cresce indefinidamente. É configuração
de painel, invisível no código — nada no repositório denuncia a ausência.

## Executando

### Com Docker

```bash
docker compose up -d postgres
docker compose --profile tools run --rm migrate
docker compose up -d server
```

### Local

```bash
docker compose up -d postgres
cd server
pnpm db:migrate
pnpm dev
```

API em `http://localhost:3333` · documentação em `http://localhost:3333/docs`

## Scripts do servidor

| Script | Ação |
|---|---|
| `pnpm dev` | Servidor em modo watch |
| `pnpm build` | Compila para `dist/` |
| `pnpm db:generate` | Gera migration a partir do schema |
| `pnpm db:migrate` | Aplica as migrations |
| `pnpm db:seed` | Popula com 20.000 links de teste |
| `pnpm test` | Suíte de testes |
| `pnpm lint` | Biome (lint + formatação) |

## Testes

```bash
cd server && pnpm test
```

Os testes rodam contra um banco separado, `brevly_test`, criado
automaticamente por `docker/init.sql` na primeira subida do Postgres. O
`.env.test` é versionado — não contém segredo algum — então não há nada a
configurar antes.

O script `pretest` aplica as migrations no banco de teste automaticamente. Cada
teste começa com a tabela vazia (`TRUNCATE` no `beforeEach`), o que permite
verificar estados como "lista vazia" de forma confiável.

Se o volume do Postgres já existir de antes e `brevly_test` não estiver lá,
recrie-o: `docker compose down -v && docker compose up -d postgres`.

## API

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/links` | Cria um link |
| `GET` | `/links?cursor&limit` | Lista todos os links, paginado (ver abaixo) |
| `GET` | `/links/:slug` | Resolve o slug (não incrementa acessos) |
| `PATCH` | `/links/:slug/visits` | Incrementa a contagem de acessos |
| `DELETE` | `/links/:slug` | Remove o link |
| `POST` | `/links/exports` | Gera o CSV e devolve a URL pública |

### Listagem completa

`GET /links` devolve **todos** os links cadastrados, percorridos por páginas —
o que atende ao mesmo tempo os requisitos de "listar todas as URLs" e de
"listagem performática". Chame sem parâmetros para a primeira página e repita
passando `nextCursor` enquanto ele não for `null`:

```bash
curl -s 'http://localhost:3333/links?limit=20'
# { "links": [...], "nextCursor": "eyJjcmVhdGVkQXQ..." }

curl -s 'http://localhost:3333/links?limit=20&cursor=eyJjcmVhdGVkQXQ...'
# { "links": [...], "nextCursor": null }   ← fim da lista
```

A paginação é por âncora (keyset), não por deslocamento: criar ou remover links
durante a navegação não duplica nem esconde itens. O front consome isso com
scroll infinito, exibindo a lista inteira.

### Exportação e CDN

`POST /links/exports` gera o CSV, envia ao Cloudflare R2 e devolve
`{ reportUrl }`. O arquivo é servido diretamente pela CDN, sem passar pela API:

```bash
REPORT_URL=$(curl -s -X POST http://localhost:3333/links/exports | jq -r .reportUrl)
curl -sO "$REPORT_URL"
```
````

- [ ] **Step 4: Rodar a suíte completa uma última vez**

```bash
cd server && pnpm test && pnpm lint && pnpm build
```

Expected: testes passam, lint limpo, build gera `dist/`.

- [ ] **Step 5: Commit**

```bash
git add .github/ README.md
git commit -m "chore(server): add CI workflow and project README"
```

---

## Cobertura do spec

| Requisito do spec | Tarefa |
|---|---|
| Criar link | 6, 12 |
| Rejeitar slug malformado | 4, 6, 12 |
| Rejeitar slug duplicado | 6, 12 |
| Rejeitar slug reservado (D12) | 5, 6, 12 |
| Deletar link | 10, 13 |
| Resolver slug → URL original | 8, 13 |
| Listar todas as URLs | 7, 13 |
| Incrementar acessos | 9, 13 |
| Exportar CSV | 11, 13 |
| CSV acessível por CDN (verificado baixando da URL) | 11, 15 |
| Nome de arquivo aleatório e único | 11 |
| Listagem performática (keyset + índice) | 2, 7, 14 |
| CSV com as 4 colunas exigidas | 11 |
| `.env.example` com as 7 chaves | 1 |
| Script `db:migrate` | 1, 2 |
| Dockerfile | 15 |
| CORS habilitado | 12 |
| Either sem `undefined` (D7) | 4, 10 |
| Cursor real do Postgres (D9) | 11 |
| Isolamento de testes (D10) | 3 |
| Paginação keyset (D11) | 7 |
| Prefixo `exports/` para lifecycle (D15) | 11, 16 |
| `timestamptz` explícito | 2 |
| Logger do Fastify, não `console` | 12, 16 |
| OpenAPI em `/docs` | 13 |
| Seed de 20.000 links | 14 |
