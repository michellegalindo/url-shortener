# Brev.ly — Encurtador de URLs

Aplicação fullstack para gerenciamento de URLs encurtadas, com API REST em
Fastify e interface React.

- **Design e decisões técnicas:** [`docs/DESIGN.md`](./docs/DESIGN.md)
- **Servidor — como ficou e por quê:** [`docs/DECISIONS-SERVER.md`](./docs/DECISIONS-SERVER.md)

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
```

As cinco chaves `CLOUDFLARE_*` do `.env.example` vêm vazias (`""`) de
propósito — são as chaves do enunciado do desafio, e o repositório não pode
carregar segredos. `server/src/env.ts` valida essas variáveis com `.min(1)` /
`z.url()` e falha a inicialização do processo se alguma estiver vazia, então
é preciso preencher as cinco antes de subir o servidor. Placeholders bastam
para exercitar tudo exceto a exportação para o R2, que exige credenciais
reais — mas `CLOUDFLARE_PUBLIC_URL` precisa ser uma URL válida (por exemplo
`http://localhost:9999`), não qualquer texto.

O `server/.env.test` já vem versionado — não contém segredos e aponta para o
banco local de teste, então `pnpm test` funciona sem configuração adicional.

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

A ordem abaixo é obrigatória, não uma sugestão: as migrations ficam fora do
entrypoint da aplicação de propósito (`docs/DESIGN.md` §4.8), então pular o
passo 2 sobe um servidor que inicia normalmente e responde 500 em toda
requisição que toca o banco.

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
| `pnpm lint` (na raiz) | Biome — lint + formatação dos dois pacotes |

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

O caminho de upload é verificado por testes automatizados contra um dublê em
memória, que confere os bytes reais do CSV gerado (cabeçalho, colunas,
contagem de linhas em múltiplos lotes do cursor). O round trip real contra o
R2 exige credenciais que este repositório deliberadamente não carrega — foi
verificado manualmente contra um bucket real, e precisa ser repetido em cada
ambiente novo depois de configurar o bucket (seção acima).
