# Brev.ly — Plano de Implementação: Front-end

> **Execução:** implemente tarefa a tarefa, na ordem. Os passos usam checkbox
> (`- [ ]`) para acompanhamento.

**Goal:** Construir a SPA React que consome a API do Brev.ly — cadastro,
listagem com scroll infinito, cópia, remoção, download do relatório CSV e
redirecionamento de links encurtados.

**Architecture:** Vite + React 19 em SPA, com três rotas. Estado de servidor no
TanStack Query; estado visual derivado de pseudo-classes do CSS, não de
`useState`. Tokens do Style Guide expostos como tema do Tailwind v4.

**Tech Stack:** TypeScript · React 19 · Vite · TailwindCSS v4 · React Router v7 ·
TanStack Query v5 · React Hook Form + Zod · Phosphor Icons · Sonner · Vitest

**Spec:** [`docs/DESIGN.md`](./DESIGN.md) §5 — o plano argumenta a partir do
spec; leia os dois. O servidor já está implementado; o que ele expõe e as decisões
que o front precisa respeitar estão em
[`docs/DECISIONS-SERVER.md`](./DECISIONS-SERVER.md).

**Pré-requisito:** o servidor precisa estar implementado e rodando em
`http://localhost:3333`. As tarefas 6 em diante verificam contra a API real.

## Global Constraints

Valores copiados literalmente do spec. Valem para **todas** as tarefas.

- **`.env.example` do web:** `VITE_FRONTEND_URL` e `VITE_BACKEND_URL`
  (obrigatórias pelo enunciado) mais `VITE_API_DELAY_MS` (opcional, dev).
- **`VITE_FRONTEND_URL` tem uso obrigatório:** é a base da URL curta exibida e
  copiada, via `buildShortUrl`. Nunca usar `window.location.origin` no lugar.
  Deve coincidir com `FRONTEND_URL` do servidor (§5.5).
- **Três rotas apenas:** `/`, `/:slug`, `*`. Nenhuma rota estática além da raiz
  — é o que mantém a blocklist do servidor reduzida a `assets` (D17).
- **Cliente HTTP é `fetch`, não axios.** O incremento de acessos exige
  `keepalive: true` (D8), que axios não expõe.
- **Tipografia por token:** usar `text-xs`…`text-xl`, que já trazem entrelinha e
  peso. Nunca aplicar `leading-*` avulso sobre um tamanho (§5.1.1).
- **Estado visual do CSS:** foco, vazio e desabilitado vêm de `:focus-within`,
  `:placeholder-shown` e `:disabled`. Nunca espelhados em `useState` (§5.2.2).
- **`retry: 0`** nas mutations; **`retry: false`** na query de redirect.
- **Acessibilidade:** `focus-visible` em todo interativo, `aria-label` nos botões
  de ícone, `prefers-reduced-motion` respeitado.
- **Idioma:** textos de interface em português; código e commits em inglês.
- **Commits:** Conventional Commits, um por tarefa no mínimo.

---

## Estrutura de arquivos

```
web/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vitest.config.ts
├── .env.example
├── public/
│   └── favicon.ico
└── src/
    ├── main.tsx
    ├── env.ts
    ├── app/
    │   ├── routes.ts               # ROUTES — fonte única dos caminhos
    │   ├── router.tsx
    │   ├── providers.tsx
    │   └── query-client.ts
    ├── assets/
    │   ├── logo.svg
    │   ├── logo-icon.svg
    │   └── 404.svg
    ├── styles/
    │   └── globals.css             # @theme: paleta + escala tipográfica
    ├── components/ui/
    │   ├── button.tsx
    │   ├── icon-button.tsx
    │   ├── text-field.tsx
    │   ├── spinner.tsx
    │   └── confirm-dialog.tsx
    ├── features/
    │   ├── create-link/
    │   │   ├── create-link-form.tsx
    │   │   ├── create-link-schema.ts
    │   │   └── use-create-link.ts
    │   ├── links-list/
    │   │   ├── links-list.tsx
    │   │   ├── link-item.tsx
    │   │   ├── links-list-empty.tsx
    │   │   ├── links-list-skeleton.tsx
    │   │   ├── export-csv-button.tsx
    │   │   ├── use-links.ts
    │   │   ├── use-delete-link.ts
    │   │   └── use-export-links.ts
    │   └── redirect/
    │       ├── use-redirect.ts
    │       └── link-not-found.tsx
    ├── lib/
    │   ├── api.ts                  # fetch + ApiError com status
    │   ├── build-short-url.ts
    │   ├── format-date.ts
    │   └── cn.ts
    └── pages/
        ├── home.tsx
        ├── redirect.tsx
        └── not-found.tsx
```

**Responsabilidades:** `lib/` não importa de `features/`. `components/ui/` não
conhece o domínio — recebe tudo por props. Cada feature agrupa seus hooks,
componentes e schema.

---

## Nota sobre testes

O spec não exige testes no front. Este plano usa Vitest apenas onde há **lógica
pura** com risco real de regressão — `buildShortUrl`, o mapeamento de erro do
cliente HTTP, o schema do formulário e a consistência da tabela de rotas.
Componentes visuais são verificados por passos manuais explícitos no navegador,
que é onde a fidelidade ao Figma e a responsividade realmente se checam.

---

## Task 1: Scaffold do Vite e tokens do Style Guide

**Files:**
- Modify: `pnpm-workspace.yaml`, `server/Dockerfile`
- Create: `web/package.json`, `web/tsconfig.json`, `web/vite.config.ts`,
  `web/vitest.config.ts`, `web/.env.example`
- Create: `web/index.html`, `web/src/main.tsx`, `web/src/env.ts`
- Create: `web/src/styles/globals.css`
- Test: `web/src/env.spec.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `env: { VITE_FRONTEND_URL: string; VITE_BACKEND_URL: string;
  VITE_API_DELAY_MS: number }`; tokens `text-xs`…`text-xl`, `bg-gray-*`,
  `text-blue-base`, `bg-danger` disponíveis como utilitários Tailwind.

- [ ] **Step 1: Adicionar `web` ao workspace**

`pnpm-workspace.yaml`:

```yaml
packages:
  - server
  - web
```

E no `server/Dockerfile`, acrescentar a cópia do manifesto do web nos dois
estágios que instalam dependências, logo após a linha
`COPY server/package.json server/package.json`:

```dockerfile
COPY web/package.json web/package.json
```

Sem isso, o `--frozen-lockfile` falha: o lockfile passa a incluir `web`, e o
build da imagem não encontra o manifesto no contexto copiado.

- [ ] **Step 2: Criar o pacote**

`web/package.json`:

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.5.7",
    "@phosphor-icons/react": "^2.1.10",
    "@tanstack/react-query": "^5.101.4",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "react-hook-form": "^7.83.0",
    "react-router": "^7.18.1",
    "sonner": "^2.0.7",
    "tailwind-variants": "^3.1.1",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.3.3",
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.3",
    "tailwindcss": "^4.3.3",
    "typescript": "^5.9.0",
    "vite": "^8.1.1",
    "vite-tsconfig-paths": "^6.1.1",
    "vitest": "^4.1.10"
  }
}
```

`react-router` v7 exporta tudo o que precisamos — `react-router-dom` não entra.

Instalar: `pnpm install`

- [ ] **Step 3: Configurar TypeScript e Vite**

`web/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "types": ["vite/client"],
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"]
}
```

`web/vite.config.ts`:

```ts
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [react(), tailwindcss(), tsconfigPaths()],
})
```

`web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: { environment: 'node', include: ['src/**/*.spec.ts'] },
})
```

O alias `@/` precisa das **duas** declarações — `paths` no tsconfig (compilador
e editor) e `tsconfigPaths()` no Vite (build e testes). Só uma delas produz ou
build quebrado ou erro vermelho no editor com build funcionando.

- [ ] **Step 4: Criar o `.env.example`**

`web/.env.example`:

```env
# Base pública do front. Monta a URL curta exibida e copiada.
# Deve coincidir com FRONTEND_URL do servidor.
VITE_FRONTEND_URL=http://localhost:5173

VITE_BACKEND_URL=http://localhost:3333

# Opcional, só em desenvolvimento: atraso artificial nas requisições,
# para tornar visíveis os skeletons e estados de carregamento.
VITE_API_DELAY_MS=0
```

Copiar: `cp web/.env.example web/.env`

- [ ] **Step 5: Escrever o teste do env**

`web/src/env.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { parseEnv } from './env'

const valid = {
  VITE_FRONTEND_URL: 'http://localhost:5173',
  VITE_BACKEND_URL: 'http://localhost:3333',
}

describe('parseEnv', () => {
  it('aceita as duas chaves obrigatórias', () => {
    const parsed = parseEnv(valid)

    expect(parsed.VITE_BACKEND_URL).toBe('http://localhost:3333')
  })

  it('usa 0 como atraso padrão', () => {
    expect(parseEnv(valid).VITE_API_DELAY_MS).toBe(0)
  })

  it('converte o atraso para número', () => {
    expect(parseEnv({ ...valid, VITE_API_DELAY_MS: '500' }).VITE_API_DELAY_MS).toBe(500)
  })

  it('lança quando VITE_BACKEND_URL falta', () => {
    const { VITE_BACKEND_URL, ...incomplete } = valid

    expect(() => parseEnv(incomplete)).toThrow(/VITE_BACKEND_URL/)
  })

  it('lança quando VITE_FRONTEND_URL não é URL', () => {
    expect(() => parseEnv({ ...valid, VITE_FRONTEND_URL: 'nao-e-url' })).toThrow(
      /VITE_FRONTEND_URL/
    )
  })
})
```

- [ ] **Step 6: Rodar e confirmar que falha**

Run: `cd web && pnpm exec vitest run src/env.spec.ts`
Expected: FAIL — `Failed to resolve import "./env"`

- [ ] **Step 7: Implementar o env**

`web/src/env.ts`:

```ts
import { z } from 'zod'

const envSchema = z.object({
  VITE_FRONTEND_URL: z.url(),
  VITE_BACKEND_URL: z.url(),
  VITE_API_DELAY_MS: z.coerce.number().int().min(0).default(0),
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

export const env = parseEnv(import.meta.env)
```

- [ ] **Step 8: Definir os tokens do Style Guide**

`web/src/styles/globals.css`:

```css
@import 'tailwindcss';

@theme {
  /* zera a paleta padrão do Tailwind: sem isso, gray-700/800/900 sobrevivem
     e convivem duas rampas de cinza diferentes no projeto (§5.1.1) */
  --color-*: initial;

  --color-white: #ffffff;
  --color-gray-100: #f9f9fb;
  --color-gray-200: #e4e6ec;
  --color-gray-300: #cdcfd5;
  --color-gray-400: #74798b;
  --color-gray-500: #4d505c;
  --color-gray-600: #1f2025;

  --color-blue-base: #2c46b1;
  --color-blue-dark: #2c4091;

  --color-danger: #b12c4d;

  --color-transparent: transparent;
  --color-current: currentColor;

  --font-sans: 'Open Sans', ui-sans-serif, system-ui, sans-serif;
  --font-display: 'Quicksand', ui-sans-serif, system-ui, sans-serif;

  /* tamanho, entrelinha e peso no MESMO token: não existe caminho para
     aplicar um tamanho com a entrelinha de outro degrau (§5.1.1) */
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

@layer base {
  body {
    background-color: var(--color-gray-200);
    color: var(--color-gray-600);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 9: Criar o `index.html` com as fontes**

`web/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Open+Sans:wght@400;600;700&family=Quicksand:wght@600;700&display=swap"
      rel="stylesheet"
    />
    <title>Brev.ly</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`href="/favicon.ico"` é absoluto, não `./favicon.ico`: o mesmo `index.html` é
servido em qualquer rota, e um caminho relativo se resolveria contra a rota
atual (§5.2.1).

- [ ] **Step 10: Criar o ponto de entrada provisório**

`web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/globals.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento #root não encontrado no index.html')
}

createRoot(root).render(
  <StrictMode>
    <h1 className="text-xl text-blue-base">Brev.ly</h1>
  </StrictMode>
)
```

- [ ] **Step 11: Rodar os testes e verificar no navegador**

```bash
cd web && pnpm test && pnpm dev
```

Abrir `http://localhost:5173`.

Expected:
- Testes do env passam (5).
- O título aparece em **azul `#2c46b1`**, 24px, peso 700.
- O fundo da página é o cinza `#e4e6ec`, não branco.
- A fonte é **Open Sans**, não a sans-serif do sistema. Comparar com um texto
  em `font-display` (Quicksand): se forem idênticos, nenhuma das duas carregou.

- [ ] **Step 12: Commit**

```bash
git add pnpm-workspace.yaml server/Dockerfile web/
git commit -m "feat(web): scaffold vite app with style guide tokens"
```

---

## Task 2: Assets e cliente HTTP

**Files:**
- Create: `web/public/favicon.ico`
- Create: `web/src/assets/logo.svg`, `logo-icon.svg`, `404.svg`
- Create: `web/src/lib/api.ts`, `web/src/lib/build-short-url.ts`,
  `web/src/lib/format-date.ts`, `web/src/lib/cn.ts`
- Test: `web/src/lib/api.spec.ts`, `web/src/lib/build-short-url.spec.ts`

**Interfaces:**
- Consumes: `env` da Task 1.
- Produces:
  ```ts
  class ApiError extends Error {
    readonly status: number
    readonly issues?: { path: string; message: string }[]
  }
  type Link = { originalUrl: string; slug: string; accessCount: number; createdAt: string }
  api<T>(path: string, init?: RequestInit): Promise<T>
  buildShortUrl(slug: string): string
  formatDate(iso: string): string
  cn(...inputs): string
  ```

- [ ] **Step 1: Colocar os assets**

Exportar do Figma (aba Style Guide) para `web/src/assets/`:
- `logo.svg` — marca completa, usada no cabeçalho da home
- `logo-icon.svg` — símbolo isolado, usado na tela de redirect
- `404.svg` — ilustração das telas de erro

E `web/public/favicon.ico`, baseado no **símbolo**, nunca no logotipo com
texto: uma marca horizontal renderizada em 16×16px vira um borrão ilegível
(§5.2.1). Um ICO multi-resolução (16×16 e 32×32 embutidos) é preferível a um
SVG aqui — traz o desenho já ajustado para cada tamanho, em vez de depender do
navegador reduzir vetor até 16px.

⚠️ Cada arquivo existe em **um** lugar só. Não duplicar `logo-icon.svg` em
`public/` — o componente importa de `src/assets/`, o `index.html` usa
`/favicon.ico`, e são propósitos distintos.

- [ ] **Step 2: Escrever os testes de `lib`**

`web/src/lib/build-short-url.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { buildShortUrl } from './build-short-url'

describe('buildShortUrl', () => {
  it('monta a URL a partir de VITE_FRONTEND_URL', () => {
    expect(buildShortUrl('meu-link')).toBe('http://localhost:5173/meu-link')
  })

  it('não duplica a barra quando a base termina com /', () => {
    expect(buildShortUrl('x', 'http://localhost:5173/')).toBe(
      'http://localhost:5173/x'
    )
  })
})
```

`web/src/lib/api.spec.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from './api'

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
}

afterEach(() => vi.unstubAllGlobals())

describe('api', () => {
  it('devolve o corpo em caso de sucesso', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { slug: 'x' }))

    await expect(api<{ slug: string }>('/links')).resolves.toEqual({ slug: 'x' })
  })

  it('devolve undefined em 204, sem tentar ler o corpo', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 204,
        json: async () => {
          throw new Error('não deveria ler o corpo de um 204')
        },
      } as unknown as Response)
    )

    await expect(api('/links/x', { method: 'DELETE' })).resolves.toBeUndefined()
  })

  it('lança ApiError preservando o status', async () => {
    vi.stubGlobal('fetch', mockFetch(404, { message: 'Link não encontrado.' }))

    const error = await api('/links/x').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.message).toBe('Link não encontrado.')
  })

  it('preserva issues no erro 400', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetch(400, {
        message: 'Dados inválidos.',
        issues: [{ path: 'slug', message: 'muito curto' }],
      })
    )

    const error = await api('/links', { method: 'POST' }).catch((e) => e)

    expect(error.issues).toEqual([{ path: 'slug', message: 'muito curto' }])
  })

  it('vira ApiError com status 0 quando a rede falha', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('failed')))

    const error = await api('/links').catch((e) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(0)
  })
})
```

O último teste é o que sustenta a decisão D18: uma falha de rede precisa
chegar às telas como `ApiError` com status distinguível, não como `TypeError`
solto. Sem isso, o redirect não consegue separar "não existe" de "não consegui
perguntar".

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd web && pnpm exec vitest run src/lib/`
Expected: FAIL — módulos não encontrados.

- [ ] **Step 4: Implementar as utilidades**

`web/src/lib/build-short-url.ts`:

```ts
import { env } from '@/env'

export function buildShortUrl(
  slug: string,
  base: string = env.VITE_FRONTEND_URL
): string {
  return `${base.replace(/\/$/, '')}/${slug}`
}
```

Fonte **única** da URL curta: exibição na lista e valor copiado saem daqui.
Derivar de `window.location.origin` num lugar e de uma string fixa noutro faz
o usuário ver um endereço e copiar outro (§5.2.2).

`web/src/lib/format-date.ts`:

```ts
const formatter = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo',
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatDate(iso: string): string {
  return formatter.format(new Date(iso))
}
```

`web/src/lib/cn.ts`:

```ts
export { cn } from 'tailwind-variants'
```

`web/src/lib/api.ts`:

```ts
import { env } from '@/env'

export type ApiIssue = { path: string; message: string }

/** Formato devolvido pela API em toda resposta que carrega um link. */
export type Link = {
  originalUrl: string
  slug: string
  accessCount: number
  createdAt: string
}

export class ApiError extends Error {
  readonly name = 'ApiError'

  constructor(
    readonly status: number,
    message: string,
    readonly issues?: ApiIssue[]
  ) {
    super(message)
  }

  /** true quando a requisição nem chegou ao servidor */
  get isNetworkError() {
    return this.status === 0
  }
}

const delay = (ms: number) =>
  ms > 0 ? new Promise((resolve) => setTimeout(resolve, ms)) : undefined

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  await delay(env.VITE_API_DELAY_MS)

  let response: Response

  try {
    response = await fetch(`${env.VITE_BACKEND_URL}${path}`, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch só rejeita por falha de transporte; status HTTP de erro resolve
    // normalmente. Status 0 marca "não chegou ao servidor" (D18).
    throw new ApiError(0, 'Não foi possível conectar ao servidor.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      response.status,
      body?.message ?? 'Erro inesperado.',
      body?.issues
    )
  }

  return body as T
}
```

Usamos `fetch` e não axios porque o incremento de acessos exige
`keepalive: true` (D8), que axios não expõe — e manter dois clientes HTTP no
mesmo projeto seria pior que escrever este.

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd web && pnpm exec vitest run src/lib/`
Expected: PASS — 2 + 5 testes

- [ ] **Step 6: Commit**

```bash
git add web/public/ web/src/assets/ web/src/lib/
git commit -m "feat(web): add assets and http client with typed errors"
```

---

## Task 3: Componentes de UI

**Files:**
- Create: `web/src/components/ui/button.tsx`, `icon-button.tsx`,
  `text-field.tsx`, `spinner.tsx`

**Interfaces:**
- Consumes: `cn` da Task 2.
- Produces:
  ```tsx
  <Button variant?="primary"|"secondary"|"destructive"
          density?="default"|"compact" loading?={boolean} />
  <IconButton icon={ReactNode} label={string} loading?={boolean} />
  <TextField label={string} prefix?={string} error?={string} {...inputProps} />
  <Spinner className?={string} />
  ```

- [ ] **Step 1: Criar o spinner**

`web/src/components/ui/spinner.tsx`:

```tsx
import { CircleNotchIcon } from '@phosphor-icons/react'
import { cn } from '@/lib/cn'

export function Spinner({ className }: { className?: string }) {
  return (
    <CircleNotchIcon
      className={cn('size-4 animate-spin', className)}
      weight="bold"
      aria-hidden
    />
  )
}
```

`aria-hidden` porque o spinner é decorativo — quem anuncia o estado é o
`aria-busy` do botão que o contém.

- [ ] **Step 2: Criar o botão**

`web/src/components/ui/button.tsx`:

```tsx
import { tv, type VariantProps } from 'tailwind-variants'
import { Spinner } from './spinner'

const button = tv({
  base: [
    'relative flex cursor-pointer items-center justify-center rounded-lg',
    'transition-colors',
    'focus-visible:outline-2 focus-visible:outline-offset-2',
    // pointer-events-none desliga o hover sozinho, dispensando prefixar
    // `enabled:` em cada regra
    'disabled:pointer-events-none disabled:opacity-50',
  ],
  variants: {
    variant: {
      primary:
        'bg-blue-base text-white hover:bg-blue-dark focus-visible:outline-blue-dark',
      secondary:
        'bg-gray-200 text-gray-500 ring-1 ring-transparent hover:ring-blue-base focus-visible:outline-blue-base',
      destructive:
        'bg-danger text-white hover:opacity-90 focus-visible:outline-danger',
    },
    density: {
      default: 'h-12 gap-3 px-5 text-md',
      compact: 'h-8 gap-1.5 rounded-sm px-2 text-sm',
    },
  },
  defaultVariants: { variant: 'primary', density: 'default' },
})

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof button> & { loading?: boolean }

export function Button({
  children,
  className,
  variant,
  density,
  loading = false,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={button({ variant, density, class: className })}
      disabled={disabled || loading}
      aria-busy={loading}
      {...props}
    >
      {loading && (
        // sobreposto em vez de substituir o conteúdo: trocar o texto por um
        // spinner encolheria o botão e deslocaria o que está ao lado
        <span className="absolute inset-0 flex items-center justify-center bg-inherit">
          <Spinner />
        </span>
      )}
      {children}
    </button>
  )
}
```

- [ ] **Step 3: Criar o botão de ícone**

`web/src/components/ui/icon-button.tsx`:

```tsx
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { Spinner } from './spinner'

type IconButtonProps = React.ComponentProps<'button'> & {
  icon: ReactNode
  /** anunciado por leitores de tela; `title` não é lido de forma confiável */
  label: string
  loading?: boolean
}

export function IconButton({
  icon,
  label,
  loading = false,
  className,
  disabled,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-busy={loading}
      disabled={disabled || loading}
      className={cn(
        'flex size-8 cursor-pointer items-center justify-center rounded-sm',
        'bg-gray-200 text-gray-600 ring-1 ring-transparent transition-colors',
        'hover:ring-blue-base',
        'focus-visible:outline-2 focus-visible:outline-blue-base focus-visible:outline-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
    </button>
  )
}
```

- [ ] **Step 4: Criar o campo de texto**

`web/src/components/ui/text-field.tsx`:

```tsx
import { WarningIcon } from '@phosphor-icons/react'
import { useId } from 'react'
import { cn } from '@/lib/cn'

type TextFieldProps = React.ComponentProps<'input'> & {
  label: string
  prefix?: string
  error?: string
}

export function TextField({
  label,
  prefix,
  error,
  className,
  id,
  ...props
}: TextFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const errorId = `${inputId}-error`

  return (
    // `group` + `data-error` levam o estado às partes internas por CSS.
    // Foco e conteúdo NÃO são espelhados em useState: o navegador já os
    // mantém em :focus-within e :placeholder-shown, e uma cópia em React
    // dessincroniza com autofill e com setValue do React Hook Form (§5.2.2)
    <div className="group flex flex-col gap-2" data-error={error ? true : undefined}>
      <label
        htmlFor={inputId}
        className={cn(
          'text-xs uppercase transition-colors',
          'text-gray-500',
          'group-focus-within:text-blue-base',
          'group-data-[error]:text-danger'
        )}
      >
        {label}
      </label>

      <div
        className={cn(
          'flex h-12 items-center rounded-lg border-[1.5px] bg-white px-4',
          'border-gray-300 transition-colors',
          'group-focus-within:border-blue-base',
          'group-data-[error]:border-danger'
        )}
      >
        {prefix && (
          // `group-has-[...]` e não `peer-[...]`: o modificador `peer` só
          // alcança irmãos POSTERIORES, e este span vem antes do input.
          // `:has()` no grupo funciona porque o wrapper contém os dois.
          <span className="text-md font-normal text-gray-400 group-has-[input:not(:placeholder-shown)]:text-gray-600">
            {prefix}
          </span>
        )}

        <input
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          // React 19 trata `ref` como prop comum, então o spread abaixo
          // repassa o ref que o `register()` do React Hook Form injeta —
          // sem isso o campo ficaria fora do controle do formulário
          className={cn(
            'flex-1 bg-transparent text-md font-normal text-gray-600 outline-none',
            'caret-blue-base placeholder:text-gray-400',
            className
          )}
          {...props}
        />
      </div>

      {error && (
        <p id={errorId} className="flex items-center gap-2 text-sm text-gray-500">
          <WarningIcon className="size-4 shrink-0 text-danger" aria-hidden />
          {error}
        </p>
      )}
    </div>
  )
}
```

O `aria-describedby` liga a mensagem de erro ao campo: sem isso o leitor de
tela anuncia que o campo é inválido, mas não diz por quê.

- [ ] **Step 5: Verificar no navegador**

Substituir temporariamente o conteúdo de `web/src/main.tsx` por uma vitrine:

```tsx
import { CopyIcon, TrashIcon } from '@phosphor-icons/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Button } from './components/ui/button'
import { IconButton } from './components/ui/icon-button'
import { TextField } from './components/ui/text-field'
import './styles/globals.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="flex flex-col gap-6 p-8">
      <div className="flex gap-3">
        <Button>Salvar</Button>
        <Button loading>Salvar</Button>
        <Button disabled>Salvar</Button>
        <Button variant="secondary" density="compact">Baixar CSV</Button>
        <Button variant="destructive">Excluir</Button>
      </div>
      <div className="flex gap-2">
        <IconButton icon={<CopyIcon />} label="Copiar link" />
        <IconButton icon={<TrashIcon />} label="Excluir link" loading />
      </div>
      <div className="flex max-w-sm flex-col gap-4">
        <TextField label="Link original" placeholder="www.exemplo.com.br" />
        {/* placeholder=" " (um espaço) é necessário: um campo sem o atributo
            `placeholder` nunca casa com :placeholder-shown, e o prefixo
            deixaria de reagir ao preenchimento */}
        <TextField label="Link encurtado" prefix="brev.ly/" placeholder=" " />
        <TextField label="Com erro" error="Informe uma URL válida." />
      </div>
    </div>
  </StrictMode>
)
```

```bash
cd web && pnpm dev
```

Expected:
- O botão **não muda de largura** ao entrar em `loading` — comparar lado a lado.
- Navegando por **Tab**, cada elemento mostra um anel de foco visível.
- Focar o campo deixa o rótulo azul e a borda azul.
- O campo com erro tem rótulo, borda e ícone em vermelho.
- Preencher o campo com prefixo escurece o `brev.ly/`.
- Com "reduzir movimento" ativado no sistema, o spinner para de girar.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/
git commit -m "feat(web): add ui components with css-driven state"
```

---

## Task 4: Roteamento e providers

**Files:**
- Create: `web/src/app/routes.ts`, `router.tsx`, `providers.tsx`,
  `query-client.ts`
- Create: `web/src/pages/home.tsx`, `redirect.tsx`, `not-found.tsx`
- Modify: `web/src/main.tsx`
- Test: `web/src/app/routes.spec.ts`

**Interfaces:**
- Consumes: nada de tarefas anteriores.
- Produces: `ROUTES`, `STATIC_PATHS`, `router`, `Providers`, `queryClient`.

- [ ] **Step 1: Escrever o teste da tabela de rotas**

`web/src/app/routes.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { RESERVED_SLUGS } from '../../../server/src/infra/shared/reserved-slugs'
import { ROUTES, STATIC_PATHS } from './routes'

describe('tabela de rotas', () => {
  it('declara as três rotas da aplicação', () => {
    expect(ROUTES.home).toBe('/')
    expect(ROUTES.redirect).toBe('/:slug')
    expect(ROUTES.notFound).toBe('*')
  })

  it('resolve o caminho de um slug', () => {
    expect(ROUTES.redirectTo('meu-link')).toBe('/meu-link')
  })

  it('todo caminho estático do front está reservado no servidor', () => {
    const desprotegidos = STATIC_PATHS.filter(
      path => !RESERVED_SLUGS.includes(path as (typeof RESERVED_SLUGS)[number])
    )

    expect(desprotegidos).toEqual([])
  })
})
```

O terceiro teste é o que o spec exige (§4.3.1, §5.3): ele **confronta** a
blocklist do servidor com a tabela de rotas, em vez de apenas alarmar. A
diferença aparece no dia em que alguém adiciona `/sobre`:

| | teste que afirma `STATIC_PATHS === []` | teste que confronta as listas |
|---|---|---|
| Rota adicionada sem reservar | falha | falha |
| Depois de reservar `sobre` no servidor | **continua falhando** | passa |
| Correção natural de quem vê a falha | editar o teste para `toEqual(['sobre'])` | reservar o slug |
| Estado depois disso | teste repete a constante; **ninguém mais confere o servidor** | segue conferindo |

Um alarme que se cala editando o próprio alarme não é defesa. A relação de
subconjunto se mantém sozinha conforme as rotas crescem — e é por isso que o
spec pede confronto, não contagem.

`RESERVED_SLUGS` é importado por caminho relativo direto, sem `web` depender do
pacote `server`: o arquivo `reserved-slugs.ts` não tem nenhum import, então nada
mais é arrastado junto e a validação de ambiente do servidor não dispara. Se o
`tsc` do `web` reclamar do arquivo estar fora do `rootDir`, inclua-o no
`include` do tsconfig do front — não duplique a lista, que é exatamente o
defeito que este teste existe para pegar.

A assimetria com `assets` é esperada: ele está no `RESERVED_SLUGS` sem estar em
`STATIC_PATHS`, porque é diretório de build do Vite e não rota do React. Por
isso a asserção é de subconjunto e não de igualdade — reservar demais custa um
apelido, reservar de menos custa um link inalcançável para sempre (D12, D17).

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && pnpm exec vitest run src/app/routes.spec.ts`
Expected: FAIL — `Failed to resolve import "./routes"`

- [ ] **Step 3: Declarar as rotas**

`web/src/app/routes.ts`:

```ts
export const ROUTES = {
  home: '/',
  redirect: '/:slug',
  notFound: '*',

  redirectTo(slug: string) {
    return `/${slug}`
  },
} as const

/**
 * Caminhos estáticos que a aplicação ocupa, além da raiz.
 *
 * ⚠️ Toda entrada aqui precisa estar em RESERVED_SLUGS no servidor
 * (`server/src/infra/shared/reserved-slugs.ts`) — senão um apelido com esse nome é
 * criado com sucesso e fica permanentemente inalcançável.
 *
 * Isso é verificado: `routes.spec.ts` confronta esta lista com a do servidor e
 * quebra se alguma entrada aqui não estiver reservada lá.
 *
 * Hoje vazio: a tela de link não encontrado é renderizada DENTRO de `/:slug`,
 * e não como rota própria (D17). O diretório `/assets/` do build do Vite não
 * é rota do React, mas está reservado no servidor pelo mesmo motivo.
 */
export const STATIC_PATHS: string[] = []
```

- [ ] **Step 4: Criar as páginas provisórias**

`web/src/pages/home.tsx`:

```tsx
export function HomePage() {
  return <h1 className="text-xl">Home</h1>
}
```

`web/src/pages/redirect.tsx`:

```tsx
export function RedirectPage() {
  return <h1 className="text-xl">Redirect</h1>
}
```

`web/src/pages/not-found.tsx`:

```tsx
import notFoundImage from '@/assets/404.svg'
import { ROUTES } from '@/app/routes'

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
        {/* decorativa: o título ao lado já diz o que aconteceu (§5.2.1) */}
        <img src={notFoundImage} alt="" width={194} height={85} />

        <h1 className="text-xl">Página não encontrada</h1>

        <p className="text-md text-gray-500">
          O conteúdo que você tentou acessar não existe.{' '}
          <a href={ROUTES.home} className="text-blue-base underline">
            Voltar para a página inicial
          </a>
        </p>
      </div>
    </div>
  )
}
```

Título **"Página não encontrada"**, distinto de "Link não encontrado" (Task 7):
são estados semanticamente diferentes, e reaproveitar um componente só faria
`/caminho/errado` exibir uma mensagem sobre links (§5.3).

- [ ] **Step 5: Montar router e providers**

`web/src/app/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, staleTime: 30_000 },
    mutations: { retry: 0 },
  },
})
```

`retry: 0` nas mutations é o padrão do TanStack Query, declarado aqui para
deixar a intenção legível: a exportação de CSV cria um objeto no R2 a cada
chamada, e repetir custa dinheiro (§5.4).

`web/src/app/router.tsx`:

```tsx
import { createBrowserRouter } from 'react-router'
import { HomePage } from '@/pages/home'
import { NotFoundPage } from '@/pages/not-found'
import { RedirectPage } from '@/pages/redirect'
import { ROUTES } from './routes'

export const router = createBrowserRouter([
  { path: ROUTES.home, element: <HomePage /> },
  { path: ROUTES.redirect, element: <RedirectPage /> },
  { path: ROUTES.notFound, element: <NotFoundPage /> },
])
```

`web/src/app/providers.tsx`:

```tsx
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { queryClient } from './query-client'
import { router } from './router'

export function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" duration={4000} />
    </QueryClientProvider>
  )
}
```

`web/src/main.tsx`:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Providers } from './app/providers'
import './styles/globals.css'

const root = document.getElementById('root')

if (!root) {
  throw new Error('Elemento #root não encontrado no index.html')
}

createRoot(root).render(
  <StrictMode>
    <Providers />
  </StrictMode>
)
```

- [ ] **Step 6: Rodar os testes e verificar as rotas**

```bash
cd web && pnpm test && pnpm dev
```

Visitar e conferir:

| URL | Esperado |
|---|---|
| `/` | "Home" |
| `/qualquer-slug` | "Redirect" |
| `/a/b/c` | "Página não encontrada" |

- [ ] **Step 7: Commit**

```bash
git add web/src/app/ web/src/pages/ web/src/main.tsx
git commit -m "feat(web): add routing, providers and query client"
```

---

## Task 5: Cadastro de link

**Files:**
- Create: `web/src/features/create-link/create-link-schema.ts`,
  `use-create-link.ts`, `create-link-form.tsx`
- Modify: `web/src/pages/home.tsx`
- Test: `web/src/features/create-link/create-link-schema.spec.ts`

**Interfaces:**
- Consumes: `api`, `ApiError`, `TextField`, `Button`.
- Produces:
  ```ts
  createLinkSchema: ZodType<{ originalUrl: string; slug: string }>
  useCreateLink(): { create(values): Promise<void>; isPending: boolean }
  <CreateLinkForm />
  ```

- [ ] **Step 1: Escrever o teste do schema**

`web/src/features/create-link/create-link-schema.spec.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { createLinkSchema } from './create-link-schema'

const valid = { originalUrl: 'https://example.com', slug: 'meu-link' }

describe('createLinkSchema', () => {
  it('aceita entrada válida', () => {
    expect(createLinkSchema.safeParse(valid).success).toBe(true)
  })

  it('normaliza o apelido para minúsculas', () => {
    const parsed = createLinkSchema.parse({ ...valid, slug: 'MeuLink' })

    expect(parsed.slug).toBe('meulink')
  })

  it.each(['ab', 'a'.repeat(33), 'meu_link', 'meu link', '-x-', 'a--b'])(
    'rejeita o apelido %s',
    (slug) => {
      expect(createLinkSchema.safeParse({ ...valid, slug }).success).toBe(false)
    }
  )

  it.each(['nao-e-url', 'example.com', ''])('rejeita a URL %s', (originalUrl) => {
    expect(createLinkSchema.safeParse({ ...valid, originalUrl }).success).toBe(
      false
    )
  })
})
```

O schema é **o mesmo do servidor**, repetido de propósito: valida no cliente
para dar retorno imediato, e o servidor revalida porque nunca confia no cliente.
As regras precisam bater — se divergirem, o formulário aceita algo que a API
recusa com 400, e o usuário vê um erro que poderia ter sido evitado.

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd web && pnpm exec vitest run src/features/create-link/`
Expected: FAIL — módulo não encontrado.

- [ ] **Step 3: Implementar o schema**

`web/src/features/create-link/create-link-schema.ts`:

```ts
import { z } from 'zod'

export const createLinkSchema = z.object({
  originalUrl: z.url({ error: 'Informe uma URL válida.' }),
  slug: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(
      z
        .string()
        .min(3, 'Use ao menos 3 caracteres.')
        .max(32, 'Use no máximo 32 caracteres.')
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'Use apenas letras minúsculas, números e hífens.'
        )
    ),
})

export type CreateLinkValues = z.input<typeof createLinkSchema>
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd web && pnpm exec vitest run src/features/create-link/`
Expected: PASS — 11 testes

- [ ] **Step 5: Criar o hook de mutation**

`web/src/features/create-link/use-create-link.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type Link } from '@/lib/api'

export function useCreateLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (values: { originalUrl: string; slug: string }) =>
      api<Link>('/links', {
        method: 'POST',
        body: JSON.stringify(values),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
    },
  })
}
```

- [ ] **Step 6: Criar o formulário**

`web/src/features/create-link/create-link-form.tsx`:

```tsx
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { TextField } from '@/components/ui/text-field'
import { ApiError } from '@/lib/api'
import { createLinkSchema, type CreateLinkValues } from './create-link-schema'
import { useCreateLink } from './use-create-link'

export function CreateLinkForm() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateLinkValues>({
    resolver: zodResolver(createLinkSchema),
    defaultValues: { originalUrl: '', slug: '' },
  })

  const { mutateAsync } = useCreateLink()

  async function onSubmit(values: CreateLinkValues) {
    try {
      await mutateAsync(createLinkSchema.parse(values))
      reset()
      toast.success('Link criado com sucesso.')
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        // 409 é sempre sobre o apelido: leva o erro ao campo em vez de um
        // toast solto, para o usuário saber exatamente o que corrigir
        setError('slug', { message: error.message }, { shouldFocus: true })
        return
      }

      if (error instanceof ApiError && error.issues) {
        for (const issue of error.issues) {
          if (issue.path === 'originalUrl' || issue.path === 'slug') {
            setError(issue.path, { message: issue.message })
          }
        }
        return
      }

      toast.error(
        error instanceof ApiError
          ? error.message
          : 'Não foi possível criar o link.'
      )
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-5 rounded-lg bg-white p-6 md:p-8"
      noValidate
    >
      <h2 className="text-lg">Novo link</h2>

      <TextField
        label="Link original"
        placeholder="www.exemplo.com.br"
        error={errors.originalUrl?.message}
        {...register('originalUrl')}
      />

      <TextField
        label="Link encurtado"
        prefix="brev.ly/"
        placeholder=" "
        error={errors.slug?.message}
        {...register('slug')}
      />

      <Button type="submit" loading={isSubmitting}>
        Salvar link
      </Button>
    </form>
  )
}
```

`noValidate` desliga a validação nativa do navegador: as mensagens dela são do
idioma do sistema e não seguem o Style Guide.

- [ ] **Step 7: Montar na home**

`web/src/pages/home.tsx`:

```tsx
import logo from '@/assets/logo.svg'
import { CreateLinkForm } from '@/features/create-link/create-link-form'

export function HomePage() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 p-3 md:gap-8 md:p-8">
      <img src={logo} alt="Brev.ly" className="h-6 w-fit self-center md:self-start" />

      <main className="grid gap-3 md:grid-cols-[minmax(0,380px)_1fr] md:items-start md:gap-5">
        <CreateLinkForm />
      </main>
    </div>
  )
}
```

- [ ] **Step 8: Verificar contra a API real**

Com o servidor rodando (`cd server && pnpm dev`):

```bash
cd web && pnpm dev
```

| Ação | Esperado |
|---|---|
| Salvar com URL vazia | erro no campo, sem requisição |
| Salvar com apelido `ab` | "Use ao menos 3 caracteres." |
| Salvar com apelido `Meu_Link` | erro de caracteres inválidos |
| Salvar `MeuLink` válido | criado; o servidor devolve `meulink` |
| Salvar o mesmo apelido de novo | **erro no campo do apelido**, com foco nele — não um toast |
| Salvar com o servidor parado | toast "Não foi possível conectar ao servidor." |
| Durante o envio | botão desabilitado, spinner, largura inalterada |

- [ ] **Step 9: Commit**

```bash
git add web/src/features/create-link/ web/src/pages/home.tsx
git commit -m "feat(web): add create link form with field-level error mapping"
```

---

## Task 6: Listagem com scroll infinito

**Files:**
- Create: `web/src/features/links-list/use-links.ts`, `links-list.tsx`,
  `link-item.tsx`, `links-list-empty.tsx`, `links-list-skeleton.tsx`
- Modify: `web/src/pages/home.tsx`

**Interfaces:**
- Consumes: `api`, `buildShortUrl`, `formatDate`, `Link` da Task 5.
- Produces: `useLinks()` (infinite query) e `<LinksList />`.

- [ ] **Step 1: Criar a query paginada**

`web/src/features/links-list/use-links.ts`:

```ts
import { useInfiniteQuery } from '@tanstack/react-query'
import { api, type Link } from '@/lib/api'

type LinksPage = { links: Link[]; nextCursor: string | null }

export function useLinks() {
  return useInfiniteQuery({
    queryKey: ['links'],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: '20' })

      if (pageParam) {
        params.set('cursor', pageParam)
      }

      return api<LinksPage>(`/links?${params}`)
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })
}
```

- [ ] **Step 2: Criar os estados vazio e de carregamento**

`web/src/features/links-list/links-list-empty.tsx`:

```tsx
import { LinkIcon } from '@phosphor-icons/react'

export function LinksListEmpty() {
  return (
    <div className="flex flex-col items-center gap-3 border-t border-gray-200 px-3 py-8">
      <LinkIcon className="size-8 text-gray-400" aria-hidden />
      <p className="text-xs uppercase text-gray-500">
        ainda não existem links cadastrados
      </p>
    </div>
  )
}
```

`web/src/features/links-list/links-list-skeleton.tsx`:

```tsx
export function LinksListSkeleton() {
  return (
    <ul className="flex flex-col" aria-hidden>
      {Array.from({ length: 4 }).map((_, index) => (
        <li
          key={index}
          className="flex items-center justify-between gap-4 border-t border-gray-200 py-4"
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
            <div className="h-3 w-48 max-w-full animate-pulse rounded bg-gray-200" />
          </div>
          <div className="h-3 w-16 animate-pulse rounded bg-gray-200" />
          <div className="flex gap-1">
            <div className="size-8 animate-pulse rounded bg-gray-200" />
            <div className="size-8 animate-pulse rounded bg-gray-200" />
          </div>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 3: Criar o item da lista**

`web/src/features/links-list/link-item.tsx`:

```tsx
import { CopyIcon, TrashIcon } from '@phosphor-icons/react'
import { IconButton } from '@/components/ui/icon-button'
import type { Link } from '@/lib/api'
import { buildShortUrl } from '@/lib/build-short-url'
import { formatDate } from '@/lib/format-date'

type LinkItemProps = {
  link: Link
  onCopy: (shortUrl: string) => void
  onDelete: (link: Link) => void
  isDeleting: boolean
}

export function LinkItem({ link, onCopy, onDelete, isDeleting }: LinkItemProps) {
  const shortUrl = buildShortUrl(link.slug)

  return (
    <li className="flex items-center justify-between gap-4 border-t border-gray-200 py-4">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <a
          href={shortUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate text-md text-blue-base hover:underline focus-visible:outline-2 focus-visible:outline-blue-base focus-visible:outline-offset-2"
        >
          {shortUrl.replace(/^https?:\/\//, '')}
        </a>

        {/* break-all: sem isso uma URL longa estoura o card no mobile */}
        <span className="truncate text-sm text-gray-500" title={link.originalUrl}>
          {link.originalUrl}
        </span>
      </div>

      <span
        className="shrink-0 text-sm text-gray-500"
        title={`Criado em ${formatDate(link.createdAt)}`}
      >
        {link.accessCount} {link.accessCount === 1 ? 'acesso' : 'acessos'}
      </span>

      <div className="flex shrink-0 gap-1">
        <IconButton
          icon={<CopyIcon />}
          label={`Copiar ${shortUrl}`}
          onClick={() => onCopy(shortUrl)}
        />
        <IconButton
          icon={<TrashIcon />}
          label={`Excluir ${shortUrl}`}
          loading={isDeleting}
          onClick={() => onDelete(link)}
        />
      </div>
    </li>
  )
}
```

A pluralização cobre o zero: `0 acessos`, `1 acesso`, `2 acessos`.

- [ ] **Step 4: Montar a lista com scroll infinito**

`web/src/features/links-list/links-list.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { Spinner } from '@/components/ui/spinner'
import type { Link } from '@/lib/api'
import { LinkItem } from './link-item'
import { LinksListEmpty } from './links-list-empty'
import { LinksListSkeleton } from './links-list-skeleton'
import { useLinks } from './use-links'

type LinksListProps = {
  onCopy: (shortUrl: string) => void
  onDelete: (link: Link) => void
  deletingSlug: string | null
}

export function LinksList({ onCopy, onDelete, deletingSlug }: LinksListProps) {
  const {
    data,
    isPending,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useLinks()

  const scrollRef = useRef<HTMLUListElement>(null)
  const sentinelRef = useRef<HTMLLIElement>(null)

  useEffect(() => {
    const sentinel = sentinelRef.current

    if (!sentinel || !hasNextPage) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      // root é a LISTA, não a janela: o scroll acontece dentro do card, e com
      // o root padrão o sentinela nunca entra em interseção — a lista para de
      // carregar ao chegar no fim, sem erro nenhum (§5.3)
      { root: scrollRef.current, threshold: 0.1 }
    )

    observer.observe(sentinel)

    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isPending) {
    return <LinksListSkeleton />
  }

  const links = data?.pages.flatMap((page) => page.links) ?? []

  if (links.length === 0) {
    return <LinksListEmpty />
  }

  return (
    <div className="relative">
      {/* barra fina no revalidar, skeleton só na primeira carga: disparar o
          skeleton por isFetching faria a lista sumir a cada criação ou
          remoção de link (§5.3) */}
      {isFetching && !isFetchingNextPage && (
        <div
          className="absolute inset-x-0 top-0 h-0.5 overflow-hidden"
          aria-hidden
        >
          <div className="h-full w-1/3 animate-pulse bg-blue-base" />
        </div>
      )}

      <ul ref={scrollRef} className="max-h-[26rem] overflow-y-auto">
        {links.map((link) => (
          <LinkItem
            key={link.slug}
            link={link}
            onCopy={onCopy}
            onDelete={onDelete}
            isDeleting={deletingSlug === link.slug}
          />
        ))}

        {hasNextPage && (
          <li ref={sentinelRef} className="flex justify-center py-4">
            {isFetchingNextPage && <Spinner className="text-gray-400" />}
          </li>
        )}
      </ul>
    </div>
  )
}
```

- [ ] **Step 5: Montar na home**

Substituir o `<main>` de `web/src/pages/home.tsx`:

```tsx
      <main className="grid gap-3 md:grid-cols-[minmax(0,380px)_1fr] md:items-start md:gap-5">
        <CreateLinkForm />

        <section className="flex flex-col gap-4 rounded-lg bg-white p-6 md:p-8">
          <h2 className="text-lg">Meus links</h2>

          <LinksList
            onCopy={() => {}}
            onDelete={() => {}}
            deletingSlug={null}
          />
        </section>
      </main>
```

Com os imports correspondentes.

- [ ] **Step 6: Verificar contra a API real**

Popular o banco: `cd server && pnpm db:seed`

| Verificação | Esperado |
|---|---|
| Banco vazio (`docker compose exec postgres psql -U postgres -d brevly -c 'TRUNCATE links'`) | empty state com ícone e texto |
| Primeira carga | skeleton de 4 linhas, depois a lista |
| Rolar até o fim da lista | carrega mais 20, com spinner no rodapé |
| Rolar várias páginas | **nenhum item repetido** — conferir os apelidos |
| Criar um link com a lista rolada | barra fina no topo, lista **não** some |
| Rolar com 20.000 links | fluido, sem travar |

- [ ] **Step 7: Commit**

```bash
git add web/src/features/links-list/ web/src/pages/home.tsx
git commit -m "feat(web): add links list with keyset infinite scroll"
```

---

## Task 7: Copiar, excluir e exportar CSV

**Files:**
- Create: `web/src/components/ui/confirm-dialog.tsx`
- Create: `web/src/features/links-list/use-delete-link.ts`,
  `use-export-links.ts`, `export-csv-button.tsx`
- Modify: `web/src/pages/home.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `Button`, `LinksList`.
- Produces: `<ConfirmDialog />`, `useDeleteLink()`, `useExportLinks()`,
  `<ExportCsvButton />`.

- [ ] **Step 1: Criar o diálogo de confirmação**

`web/src/components/ui/confirm-dialog.tsx`:

```tsx
import { useEffect, useRef } from 'react'
import { Button } from './button'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current

    if (!dialog) return

    // showModal() do <dialog> nativo entrega foco preso, fechamento por Esc
    // e inertização do resto da página — tudo o que um overlay em <div>
    // exigiria implementar à mão
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        if (!loading) onCancel()
      }}
      className="m-auto w-[calc(100%-1.5rem)] max-w-md rounded-lg bg-white p-6 backdrop:bg-gray-600/60"
    >
      <div className="flex flex-col gap-4">
        <h2 className="text-lg">{title}</h2>
        <p className="text-md font-normal text-gray-500">{description}</p>

        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={onCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  )
}
```

- [ ] **Step 2: Criar o hook de remoção**

`web/src/features/links-list/use-delete-link.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useDeleteLink() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (slug: string) =>
      api<void>(`/links/${encodeURIComponent(slug)}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['links'] })
    },
  })
}
```

- [ ] **Step 3: Criar o hook de exportação**

`web/src/features/links-list/use-export-links.ts`:

```ts
import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useExportLinks() {
  return useMutation({
    mutationFn: () =>
      api<{ reportUrl: string }>('/links/exports', { method: 'POST' }),
    // explícito, embora seja o padrão de mutations: cada chamada varre a
    // tabela e cria um objeto novo no R2 — repetir custa dinheiro (§4.5.1)
    retry: 0,
  })
}
```

Modelar isso com `useQuery` seria um erro de categoria: queries são presumidas
idempotentes e têm `retry: 3` por padrão, de forma que uma falha de resposta
após o upload geraria até quatro CSVs órfãos por clique.

- [ ] **Step 4: Criar o botão de exportação**

`web/src/features/links-list/export-csv-button.tsx`:

```tsx
import { DownloadSimpleIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ApiError } from '@/lib/api'
import { useExportLinks } from './use-export-links'

export function ExportCsvButton({ disabled }: { disabled: boolean }) {
  const { mutateAsync, isPending } = useExportLinks()

  async function handleExport() {
    try {
      const { reportUrl } = await mutateAsync()

      // o objeto sobe ao R2 com Content-Disposition: attachment, então
      // assign() baixa em vez de navegar. Criar um <a> e clicar por script
      // seria bloqueado como popup: o clique sintético acontece dentro de um
      // callback assíncrono e deixa de ser gesto confiável (§5.4)
      window.location.assign(reportUrl)
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        toast.error('Não há links para exportar.')
        return
      }

      toast.error('Não foi possível gerar o relatório.')
    }
  }

  return (
    <Button
      variant="secondary"
      density="compact"
      onClick={handleExport}
      loading={isPending}
      disabled={disabled}
    >
      <DownloadSimpleIcon className="size-4" aria-hidden />
      Baixar CSV
    </Button>
  )
}
```

- [ ] **Step 5: Ligar tudo na home**

`web/src/pages/home.tsx` — versão final:

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import logo from '@/assets/logo.svg'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CreateLinkForm } from '@/features/create-link/create-link-form'
import type { Link } from '@/lib/api'
import { ExportCsvButton } from '@/features/links-list/export-csv-button'
import { LinksList } from '@/features/links-list/links-list'
import { useDeleteLink } from '@/features/links-list/use-delete-link'
import { useLinks } from '@/features/links-list/use-links'

export function HomePage() {
  const [linkToDelete, setLinkToDelete] = useState<Link | null>(null)

  const { data } = useLinks()
  const { mutateAsync: deleteLink, isPending: isDeleting } = useDeleteLink()

  const isEmpty = (data?.pages[0]?.links.length ?? 0) === 0

  async function handleCopy(shortUrl: string) {
    try {
      await navigator.clipboard.writeText(shortUrl)
      toast.success('Link copiado para a área de transferência.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

  async function handleConfirmDelete() {
    if (!linkToDelete) return

    try {
      await deleteLink(linkToDelete.slug)
      toast.success('Link excluído.')
    } catch {
      toast.error('Não foi possível excluir o link.')
    } finally {
      setLinkToDelete(null)
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col gap-3 p-3 md:gap-8 md:p-8">
      <img src={logo} alt="Brev.ly" className="h-6 w-fit self-center md:self-start" />

      <main className="grid gap-3 md:grid-cols-[minmax(0,380px)_1fr] md:items-start md:gap-5">
        <CreateLinkForm />

        <section className="flex flex-col gap-4 rounded-lg bg-white p-6 md:p-8">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg">Meus links</h2>
            <ExportCsvButton disabled={isEmpty} />
          </div>

          <LinksList
            onCopy={handleCopy}
            onDelete={setLinkToDelete}
            deletingSlug={isDeleting ? (linkToDelete?.slug ?? null) : null}
          />
        </section>
      </main>

      <ConfirmDialog
        open={linkToDelete !== null}
        title="Excluir link"
        description={`O link brev.ly/${linkToDelete?.slug ?? ''} será removido permanentemente. Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setLinkToDelete(null)}
      />
    </div>
  )
}
```

- [ ] **Step 6: Verificar contra a API real**

| Ação | Esperado |
|---|---|
| Clicar em copiar | toast de confirmação; colar em outro lugar dá `http://localhost:5173/apelido` |
| Clicar em excluir | diálogo abre com foco preso; **Esc** fecha |
| Confirmar exclusão | botão em carregamento, item some, toast |
| Lista vazia | botão "Baixar CSV" **desabilitado** |
| Exportar com links | arquivo baixa; a página **não** navega para fora |
| Exportar com a lista vazia forçada via API | toast "Não há links para exportar." |
| Abrir o CSV | 4 colunas, URL encurtada completa |

- [ ] **Step 7: Commit**

```bash
git add web/src/components/ui/confirm-dialog.tsx web/src/features/links-list/ web/src/pages/home.tsx
git commit -m "feat(web): add copy, delete and csv export"
```

---

## Task 8: Página de redirecionamento

**Files:**
- Create: `web/src/features/redirect/use-redirect.ts`, `link-not-found.tsx`
- Modify: `web/src/pages/redirect.tsx`

**Interfaces:**
- Consumes: `api`, `ApiError`, `env`, `Link`.
- Produces: `useRedirect(slug)` e `<LinkNotFound />`.

- [ ] **Step 1: Criar o hook de redirecionamento**

`web/src/features/redirect/use-redirect.ts`:

```ts
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { env } from '@/env'
import { ApiError, api, type Link } from '@/lib/api'

export function useRedirect(slug: string) {
  const [isRedirecting, setIsRedirecting] = useState(false)

  const query = useQuery({
    queryKey: ['redirect', slug],
    queryFn: () => api<Link>(`/links/${encodeURIComponent(slug)}`),
    enabled: slug.length > 0,
    // repetir automaticamente um 404 é inútil e só atrasa a mensagem correta
    retry: false,
  })

  const originalUrl = query.data?.originalUrl

  useEffect(() => {
    if (!originalUrl || isRedirecting) return

    setIsRedirecting(true)

    async function go(url: string) {
      // keepalive: sem ele o navegador aborta a requisição em voo ao iniciar
      // a navegação, e a contagem sobe de forma intermitente (D8)
      await fetch(`${env.VITE_BACKEND_URL}/links/${encodeURIComponent(slug)}/visits`, {
        method: 'PATCH',
        keepalive: true,
      }).catch(() => {
        // falhar o contador não pode impedir o redirecionamento
      })

      // replace e não href: href empilha esta página no histórico, e como ela
      // redireciona ao montar, o botão Voltar reexecuta o redirect (D14)
      window.location.replace(url)
    }

    void go(originalUrl)
  }, [originalUrl, slug, isRedirecting])

  const error = query.error

  return {
    originalUrl,
    isLoading: query.isPending,
    // 404 e falha de transporte são estados distintos (D18)
    isNotFound: error instanceof ApiError && error.status === 404,
    isUnavailable:
      error instanceof ApiError && error.status !== 404 ? error : null,
    retry: query.refetch,
  }
}
```

- [ ] **Step 2: Criar a tela de link não encontrado**

`web/src/features/redirect/link-not-found.tsx`:

```tsx
import notFoundImage from '@/assets/404.svg'
import { ROUTES } from '@/app/routes'

export function LinkNotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
        <img src={notFoundImage} alt="" width={194} height={85} />

        <h1 className="text-xl">Link não encontrado</h1>

        <p className="text-md font-normal text-gray-500">
          O link que você está tentando acessar não existe, foi removido ou é
          uma URL inválida. Saiba mais em{' '}
          <a href={ROUTES.home} className="text-blue-base underline">
            brev.ly
          </a>
          .
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Montar a página**

`web/src/pages/redirect.tsx`:

```tsx
import { useParams } from 'react-router'
import logoIcon from '@/assets/logo-icon.svg'
import { Button } from '@/components/ui/button'
import { LinkNotFound } from '@/features/redirect/link-not-found'
import { useRedirect } from '@/features/redirect/use-redirect'

export function RedirectPage() {
  const { slug = '' } = useParams<{ slug: string }>()

  const { originalUrl, isNotFound, isUnavailable, retry } = useRedirect(slug)

  if (isNotFound) {
    return <LinkNotFound />
  }

  if (isUnavailable) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-3">
        <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
          <img src={logoIcon} alt="Brev.ly" width={48} height={48} />

          <h1 className="text-xl">Não foi possível carregar o link</h1>

          <p className="text-md font-normal text-gray-500">
            {isUnavailable.isNetworkError
              ? 'Verifique sua conexão e tente novamente.'
              : 'O serviço está indisponível no momento.'}
          </p>

          <Button onClick={() => retry()}>Tentar novamente</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-3">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-lg bg-gray-100 px-5 py-12 text-center md:px-12 md:py-16">
        <img src={logoIcon} alt="Brev.ly" width={48} height={48} />

        <h1 className="text-xl">Redirecionando...</h1>

        <div className="flex flex-col gap-1 text-md font-normal text-gray-500">
          <p>O link será aberto automaticamente em alguns instantes.</p>
          <p>
            Não foi redirecionado?{' '}
            {originalUrl ? (
              <a href={originalUrl} className="text-blue-base underline">
                Acesse aqui
              </a>
            ) : (
              'Aguarde...'
            )}
          </p>
        </div>
      </div>
    </div>
  )
}
```

A tela de "não foi possível carregar" é distinta da de "link não encontrado":
dizer que um link **válido** não existe leva o usuário a desistir dele (D18).

- [ ] **Step 4: Verificar os três caminhos**

| Cenário | Como reproduzir | Esperado |
|---|---|---|
| Sucesso | criar `teste` e abrir `/teste` | tela "Redirecionando...", vai para o destino |
| Contagem | voltar à home | `1 acesso` no item |
| Botão Voltar | após redirecionar, clicar em Voltar | volta à **origem**, não reabre o redirect |
| Link inexistente | abrir `/nao-existe` | "Link não encontrado", URL segue `/nao-existe` |
| Servidor fora | `docker compose stop server`, abrir `/teste` | "Não foi possível carregar o link" + botão |
| Recuperação | subir o servidor, clicar em Tentar novamente | redireciona normalmente |

O teste da contagem é o que valida o `keepalive`: sem ele, o incremento sai de
forma intermitente e esse passo falha em parte das execuções.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/redirect/ web/src/pages/redirect.tsx
git commit -m "feat(web): add redirect page distinguishing 404 from outage"
```

---

## Task 9: Responsividade, lint e README

**Files:**
- Modify: `biome.json` (raiz), `README.md`
- Ajustes de layout conforme necessário

**Interfaces:**
- Consumes: tudo.
- Produces: `pnpm lint` limpo e instruções de execução do front.

- [ ] **Step 1: Ativar as regras de React no Biome**

O `biome.json` da raiz (criado na Task 1 do plano do servidor) já cobre este
pacote. Acrescentar as regras específicas de React:

```json
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noConsole": "error" },
      "correctness": {
        "useExhaustiveDependencies": "error",
        "useHookAtTopLevel": "error"
      }
    }
  }
```

São os equivalentes do `eslint-plugin-react-hooks`:
`useExhaustiveDependencies` cobre `exhaustive-deps` e `useHookAtTopLevel` cobre
`rules-of-hooks`. A primeira é a que importa mais aqui — o
`IntersectionObserver` da Task 6 e o efeito de redirecionamento da Task 8 têm
listas de dependência que erradas causam bug silencioso.

- [ ] **Step 2: Rodar lint e formatação**

```bash
pnpm format && pnpm lint
```

Corrigir o que aparecer.

- [ ] **Step 3: Verificar a responsividade**

Com o DevTools em modo dispositivo:

| Largura | Esperado |
|---|---|
| 360px | uma coluna: formulário acima, lista abaixo; logo centralizado; nada de scroll horizontal |
| 768px | ainda uma coluna, com respiro maior |
| 1024px+ | duas colunas; formulário à esquerda com largura fixa, lista ocupando o resto |

Verificações críticas no mobile:
- Uma URL original bem longa **não** estoura o card — deve truncar.
- Os botões de ícone continuam alcançáveis, sem sobrepor o texto.
- O diálogo de exclusão cabe na tela e não vaza pelas bordas.
- A lista rola dentro do card, não a página inteira.

Ajustar as classes onde necessário. O layout do Figma é a referência.

- [ ] **Step 4: Verificar a fidelidade ao Figma**

Abrir o Figma lado a lado e conferir, tela a tela: espaçamentos, tamanhos de
fonte, cores, raios de borda e estados (padrão, foco, erro, desabilitado).

Corrigir divergências. Os tokens já garantem cor e tipografia; o que costuma
divergir é espaçamento interno e largura dos cards.

- [ ] **Step 5: Verificar acessibilidade por teclado**

Percorrer a aplicação inteira usando **apenas Tab, Shift+Tab, Enter e Esc**:
- Todo elemento interativo recebe foco visível.
- A ordem de foco segue a leitura visual.
- O diálogo prende o foco e fecha com Esc.
- Os botões de ícone anunciam o que fazem (conferir no inspetor de
  acessibilidade do navegador que têm `aria-label`).

- [ ] **Step 6: Atualizar o README**

Acrescentar ao `README.md` da raiz, após a seção do servidor:

````markdown
## Front-end

```bash
cp web/.env.example web/.env
cd web && pnpm dev
```

Aplicação em `http://localhost:5173`.

### Variáveis de ambiente do web

| Chave | Descrição |
|---|---|
| `VITE_FRONTEND_URL` | Base pública do front. Monta a URL curta exibida e copiada. **Deve ser igual a `FRONTEND_URL` do servidor** |
| `VITE_BACKEND_URL` | Endereço da API |
| `VITE_API_DELAY_MS` | Opcional. Atraso artificial nas requisições, para inspecionar os estados de carregamento |

### Páginas

| Rota | Descrição |
|---|---|
| `/` | Cadastro de link e listagem com scroll infinito |
| `/:slug` | Resolve o apelido, incrementa a contagem e redireciona |
| `*` | Página não encontrada |

### Scripts

| Script | Ação |
|---|---|
| `pnpm dev` | Servidor de desenvolvimento |
| `pnpm build` | Type-check e build de produção |
| `pnpm preview` | Serve o build localmente |
| `pnpm test` | Testes de lógica |
| `pnpm lint` (na raiz) | Biome — lint + formatação dos dois pacotes |

### Publicação

A aplicação é uma SPA cuja funcionalidade central é o acesso direto a `/:slug`.
O host precisa reescrever toda rota desconhecida para `index.html`, senão cada
link encurtado devolve 404 — e o problema **não aparece em desenvolvimento**,
porque o servidor do Vite já faz esse redirecionamento.

| Host | Configuração |
|---|---|
| nginx | `try_files $uri $uri/ /index.html;` |
| Vercel | `"rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]` |
| Netlify | `/* /index.html 200` em `public/_redirects` |

Após publicar, abrir uma URL encurtada **em aba nova** — só o acesso direto
exercita o rewrite.
````

- [ ] **Step 7: Verificação final**

```bash
pnpm lint && cd web && pnpm test && pnpm build && pnpm preview
```

Expected: testes passam, lint limpo, build gera `dist/`, e o preview funciona.

No preview, conferir que **acessar `/algum-slug` diretamente** funciona — é o
comportamento que depende do rewrite em produção.

- [ ] **Step 8: Commit**

```bash
git add biome.json README.md web/src/
git commit -m "chore(web): add react lint rules, responsive polish and README"
```

---

## Cobertura do checklist

| Requisito | Tarefa |
|---|---|
| Criar um link | 5 |
| Rejeitar encurtamento mal formatado | 5 |
| Rejeitar encurtamento já existente | 5 (409 → erro no campo) |
| Deletar um link | 7 |
| Obter a URL original pelo encurtamento | 8 |
| Listar todas as URLs cadastradas | 6 (scroll infinito percorre tudo) |
| Incrementar a quantidade de acessos | 8 (`keepalive`) |
| Baixar CSV com o relatório | 7 |
| SPA React com Vite | 1 |
| Fidelidade ao Figma | 1 (tokens), 9 (conferência) |
| Empty state | 6 |
| Ícones de carregamento | 3 (botões), 6 (skeleton, barra, spinner) |
| Bloqueio de ações por estado | 5, 7 |
| Responsividade | 9 |

## Cobertura das decisões do spec

| Decisão | Tarefa |
|---|---|
| D8 — `keepalive` no incremento | 8 |
| D11 — paginação keyset | 6 |
| D14 — `location.replace` | 8 |
| D17 — erro renderizado dentro de `/:slug` | 4, 8 |
| D18 — 404 distinto de falha de transporte | 2, 8 |
| §5.1.1 — tokens com entrelinha pareada | 1 |
| §5.2.1 — assets e `alt` correto | 2, 4 |
| §5.2.2 — estado visual via CSS | 3 |
| §5.3 — `IntersectionObserver` com `root` na lista | 6 |
| §5.3 — `isPending` vs `isFetching` | 6 |
| §5.4 — download sem bloqueio de popup | 7 |
| §5.6 — rewrite da SPA | 9 |
