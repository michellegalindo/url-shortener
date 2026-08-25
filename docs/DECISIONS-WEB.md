# Brev.ly — Front-end

**Status:** Implementado · 30 testes · [`DESIGN.md`](./DESIGN.md) é a especificação

Este documento é a referência da implementação do front-end: o que existe, por
que está assim, e onde é fácil quebrar. O `DESIGN.md` diz **o que** construir e
por quê (§5); aqui está **como ficou** — em particular, as escolhas em que o
caminho óbvio é o errado.

---

## Arquitetura em uma página

SPA em React + Vite, sem framework de servidor. Toda leitura e escrita passa
por um cliente HTTP único; estado assíncrono vive no TanStack Query. Todo
estado que o navegador já mantém — foco, valor preenchido, aberto/fechado do
`<dialog>` — fica no CSS ou no DOM, nunca espelhado em `useState`: é o que
evita bugs de dessincronização por autofill, `setValue` do React Hook Form ou
reset de formulário.

```
web/src/
├── env.ts                   valida import.meta.env no import, falha alto
├── app/routes.ts             ROUTES + STATIC_PATHS — fonte única de caminhos
├── components/ui/            button, icon-button, text-field, spinner, confirm-dialog
├── features/
│   ├── create-link/          form, schema Zod, mutation
│   ├── links-list/           lista, item, empty state, skeleton, delete, export
│   └── redirect/             resolução do slug + incremento + link-not-found
├── pages/                     home, redirect, not-found
├── lib/api.ts                 fetch + ApiError
└── styles/globals.css         tokens do Style Guide via @theme
```

---

## O cliente HTTP

### `content-type` só quando há corpo — senão o Fastify derruba DELETE e export

`api()` (`web/src/lib/api.ts`) monta o header condicionalmente:
`...(init?.body ? { 'content-type': 'application/json' } : {})`.

**A armadilha:** o caminho óbvio é sempre mandar
`content-type: application/json` — "é uma API JSON". Isso quebra qualquer
requisição sem corpo: `DELETE /links/:slug` e `POST /links/exports`. O
Fastify 5 tenta fazer parse de JSON em **todo** request que declara esse
header, mesmo vazio, e responde `400 FST_ERR_CTP_EMPTY_JSON_BODY`. Passou
despercebido até a revisão final porque nenhum teste inspecionava o `init`
passado ao `fetch` — só o valor de retorno. `api.spec.ts` agora inspeciona
`fetch.mock.calls[0]?.[1].headers` diretamente, nos dois sentidos, para não
depender de reproduzir o comportamento real do Fastify no teste.

### `ApiError` com `status: 0` para falha de transporte

`fetch` só rejeita a promise por falha de rede — um `404`/`500` resolve
normalmente. `status = 0` marca "a requisição nem chegou ao servidor"
(`error.isNetworkError`) e é o que permite ao redirect e à lista distinguir
"link não existe" de "estou sem internet" (ver §Redirect). `204` retorna
`undefined` sem tentar ler o corpo — chamar `.json()` num corpo vazio lançaria
e transformaria um `DELETE` bem-sucedido em erro.

---

## Variáveis de ambiente

`env.ts` roda `parseEnv(import.meta.env)` **no import do módulo**, e o Vite
substitui `import.meta.env.VITE_*` por literais em build. Faltar uma
variável **não falha o build**: `vite build` sai com código 0 mesmo sem
`VITE_FRONTEND_URL`; o Zod só lança quando o bundle **executa** no navegador —
tela branca em produção, sem log de build apontando a causa. Por isso o step
de CI que builda o front passa valores dummy explícitos via `env:` no
workflow: não porque o build precisa deles para funcionar, mas porque sem
eles o build "passa" escondendo a falha que só apareceria no navegador. O
vitest resolve o mesmo problema via `test.env` em `vitest.config.ts`, para não
depender de um `web/.env` na máquina de quem roda os testes.

`VITE_FRONTEND_URL` precisa coincidir com `FRONTEND_URL` do servidor — a URL
curta é derivada nos dois lados (front exibe/copia, servidor escreve no CSV);
se divergirem, interface e relatório mostram domínios diferentes para o mesmo
link, e nada no repositório detecta isso.

---

## Rotas

Só três rotas (`ROUTES` em `web/src/app/routes.ts`): `home: '/'`,
`redirect: '/:slug'`, `notFound: '*'`. Não existe rota estática
`/not-found` — a tela de link não encontrado é renderizada **dentro** de
`/:slug` quando a API devolve 404, não por navegação (ver §Redirect). Uma
rota estática colidiria com `/:slug` no roteador (tornando o apelido
`not-found` inalcançável) e perderia, ao navegar, qual apelido falhou.

`STATIC_PATHS` (hoje `[]`) é verificado contra `RESERVED_SLUGS` do servidor
**por import direto do arquivo real**, não por cópia manual:
`routes.spec.ts` importa `../../../server/src/infra/shared/reserved-slugs` e
falha se algum `STATIC_PATHS` não estiver reservado lá. Isso fecha a
pendência mais importante deixada em
[`DECISIONS-SERVER.md`](./DECISIONS-SERVER.md): um apelido que colide com um
caminho estático do front continua sendo criado com sucesso e ficando
inalcançável para sempre, sem erro em lugar nenhum — o teste é o que impede
as duas listas de divergirem no futuro, não o que impede a colisão em si. Um
segundo teste no mesmo arquivo confere que `route-objects.tsx` (o
`RouteObject[]` consumido por `router.tsx`) declara exatamente os três
caminhos de `ROUTES`; ele existe separado de `router.tsx` porque
`createBrowserRouter` exige `window`/`document`, ausentes no ambiente de
teste.

O schema Zod do formulário (`create-link-schema.ts`) espelha o do servidor:
`originalUrl` só `http`/`https` (rejeita `javascript:`, testado
explicitamente) e máximo 2048 caracteres; `slug` normaliza (`trim` +
`toLowerCase`) via `.transform()` **antes** de validar via `.pipe()`, na
mesma ordem do servidor — invertida, `MeuLink` seria rejeitado em vez de virar
`meulink`. A duplicação é deliberada (retorno imediato no cliente, o servidor
sempre revalida), mas não há teste automatizado de paridade entre os dois
schemas — ver Pendências.

---

## Design tokens e componentes de UI

**`--color-*: initial`** zera a paleta padrão do Tailwind antes do `@theme`
declarar a do Style Guide. Sem essa linha, `gray-700`/`800`/`900` (e toda a
paleta default) continuariam vivos como classe — duas rampas de cinza
coexistindo, sem aviso de qual é usada por engano.

**Tamanho, entrelinha e peso no mesmo token** (`--text-md`,
`--text-md--line-height`, `--text-md--font-weight`): não existe combinação de
tamanho de um degrau com entrelinha de outro, porque a entrelinha não é
classe Tailwind separada.

**Quicksand em `h1`/`h2`** via `@layer base` em `globals.css`. Só foi
corrigido na revisão final: a fonte estava importada e tokenizada, mas nunca
aplicada a nenhum elemento — sintoma (título em Open Sans) que não aparece em
nenhum teste automatizado, só em inspeção visual.

**`!important` no reset de `prefers-reduced-motion`**, com
`biome-ignore lint/complexity/noImportantStyles` por linha (não por arquivo):
é a única forma de garantir que o reset vence a especificidade normal de uma
transição declarada por componente individual.

### `TextField`: estado visual vem do CSS

`group-focus-within:` (foco), `group-has-[input:not(:placeholder-shown)]:`
(campo preenchido, aplicado ao prefixo `brev.ly/`), `data-error` (único que
não existe nativamente no DOM — setado pelo componente a partir do Zod).

**A armadilha do `placeholder=" "`:** `:placeholder-shown` só dispara quando o
atributo `placeholder` é **não-vazio**. O campo de slug usa `placeholder=" "`
(um espaço) precisamente para isso — sem ele, `group-has-[...]` nunca teria
`:placeholder-shown` ativo, e o prefixo nunca escureceria ao digitar. Um
campo sem `prefix` não precisa do truque porque não usa esse seletor.
`group-has-[...]` (não `peer-[...]`) porque `peer` só alcança irmãos
posteriores, e o `<span>` do prefixo vem antes do `<input>`.

### `Button`: spinner sobreposto, `type="button"` por padrão

O spinner ocupa `absolute inset-0` sobre o conteúdo em vez de substituí-lo —
trocar o texto por um spinner do mesmo tamanho encolheria o botão. `type` tem
default `'button'` (HTML nativo faz o oposto: `<button>` sem `type` dentro de
um `<form>` submete) — qualquer botão secundário (cancelar, copiar, deletar,
exportar) dentro do form sem esse default disparia submit por acidente. O
único `<button type="submit">` real já declara o tipo explicitamente.

---

## Formulário — mapeamento de erro

`create-link-form.tsx` trata a resposta de erro em ordem: **409** vai direto
para `setError('slug', …, { shouldFocus: true })` (é sempre sobre o slug, o
único campo com restrição de unicidade); **`issues`** percorre cada uma e
chama `setError` no campo (`originalUrl`/`slug`) correspondente; se nenhuma
issue bateu com um campo conhecido, cai num `toast.error` genérico em vez de
terminar em silêncio. Esse terceiro ramo só foi adicionado na revisão final —
antes, o código retornava depois do loop de issues mesmo sem nenhuma ter sido
aplicada a um campo.

---

## Lista de links

**Scroll infinito com keyset**, `IntersectionObserver` com
`root: scrollRef.current` — a `<ul>` da lista, não a `window`. O card tem
rolagem própria (`max-h-[26rem] overflow-y-auto`); com o `root` padrão
(viewport), o sentinela nunca entraria em interseção porque a janela nunca
rola — a lista pararia de carregar ao chegar no fim, sem erro nenhum.

**Três indicadores, nunca o mesmo:** `isPending` → skeleton de 5 linhas;
`isFetching && !isFetchingNextPage` → barra fina no topo; `isFetchingNextPage`
→ spinner no rodapé. Usar `isFetching` para o skeleton faria a lista sumir e
reaparecer a cada criação/remoção — a invalidação de `['links']` conta como
fetch — perdendo posição de rolagem numa ação que deveria ser incremental.

**Erro de busca é estado distinto de lista vazia** (`isError && !data`
renderiza bloco próprio com "Tentar novamente", separado do empty state) —
mesmo princípio de D18 do servidor (ausência ≠ falha): tratar as duas
situações com o mesmo componente faria uma falha de rede parecer "você ainda
não tem links". Esse ramo não existia na implementação original — a query com
erro caía silenciosamente no cálculo de `links.length === 0` e mostrava o
empty state; corrigido em fix round da revisão da Task 6. Uma falha ao
buscar a página **seguinte** não cai nesse ramo — a lista já carregada
permanece.

`SKELETON_ROWS` tem 5 entradas fixas (Figma §5.3), usadas como `key` — não
`key={index}` (a regra `noArrayIndexKey` do Biome rejeitaria), mas como as
linhas nunca reordenam nem mudam de contagem, um rótulo fixo por linha é
chave estável e honesta.

---

## Exportação de CSV

`useExportLinks()` usa `useMutation` com `retry: 0` explícito (mesmo sendo o
default de mutations, para legibilidade da intenção) — **nunca `useQuery`**.
`POST /links/exports` não é idempotente: cada chamada varre a tabela e cria
um objeto novo no R2. `useQuery` (mesmo com `enabled: false`) herdaria
`retry: 3` com backoff, e uma falha por timeout **depois** do upload
concluído faria o retry repetir a exportação — um clique vira até quatro
CSVs, três órfãos.

Download via `window.location.assign(reportUrl)`, não um `<a>` clicado por
script: o objeto sobe com `Content-Disposition: attachment` (decisão do
servidor), então `assign()` inicia download sem sair da SPA. Um `<a>` clicado
dentro do callback assíncrono da mutation seria bloqueado como popup — o
clique sintético acontece muito depois do clique real e deixa de contar como
gesto confiável.

`ExportCsvButton` recebe `disabled` calculado a partir de
`links.length === 0`, evitando uma chamada que a API rejeitaria de qualquer
forma; mesmo assim um 422 (`NoLinksToExport`, possível por corrida entre duas
abas) tem toast próprio, distinto do genérico.

---

## Exclusão de link

`ConfirmDialog` usa `<dialog>` nativo com `showModal()`/`close()` sincronizado
a partir da prop `open` via `useEffect`. `showModal()` entrega de graça foco
preso, fechamento por Esc (interceptado para bloquear durante `loading`) e
inertização do resto da página — tudo o que um overlay em `<div>` exigiria
reimplementar à mão. `aria-labelledby`/`aria-describedby` apontam para
título e descrição via `useId()`; não fazia parte da implementação inicial
(adiado como item menor na revisão da Task 7) e foi incluído no polimento de
acessibilidade da Task 9.

---

## Redirect

`retry: false` na query de resolução — repetir automaticamente um 404 é
inútil e só atrasa a mensagem correta. `isNotFound` (`status === 404`) e
`isUnavailable` (qualquer outro `ApiError`, incluindo `isNetworkError`) são
telas diferentes: a primeira não tem botão de retry (não adianta tentar de
novo), a segunda distingue "verifique sua conexão" de "serviço indisponível".

**`keepalive` no `PATCH` de incremento:** sem ele, o navegador aborta
requisições em voo da página sendo descartada assim que a navegação começa —
o incremento passaria a depender de o socket ter esvaziado a tempo, contando
de forma intermitente. Pior que nunca contar: passa despercebido em teste
manual local (rede rápida, mesma máquina) e falha silenciosamente em
produção. A falha do `PATCH` é engolida (`.catch(() => {})`) — não pode
impedir o redirecionamento.

**`window.location.replace`, nunca `href`:** `href` empilharia a página de
redirect no histórico; como ela redireciona ao montar, o botão Voltar
reexecutaria o redirect a cada clique.

**`useRef`, não `useState`, para "já redirecionei":** em StrictMode (dev), o
React roda o efeito duas vezes antes que uma atualização de `useState`
dispare o re-render que o guardaria — o segundo disparo ainda veria o valor
antigo, e o `PATCH /visits` sairia duas vezes, dobrando a contagem **apenas
em desenvolvimento**. `useRef` é lido/escrito de forma síncrona dentro do
próprio efeito, sem esperar re-render. Em produção (sem StrictMode) as duas
abordagens seriam idênticas — a diferença só aparece em dev, o que a torna
fácil de nunca notar.

---

## Desvios deliberados da especificação

**URL original com `truncate`, não `break-all`** — o `DESIGN.md` §5.4 pede
`break-all`. Mantido `truncate` (com texto completo em `title`) porque as
linhas da lista são de uma linha só (layout `flex` horizontal com contagem e
ações ao lado); `break-all` quebraria a URL em múltiplas linhas dentro da
mesma linha, empurrando os outros elementos e quebrando o alinhamento
vertical. Revisado duas vezes (plano e revisão final) e mantido nas duas.

**`formatDate` fixo em `America/Sao_Paulo`**, não no fuso do navegador de
quem acessa — o produto é local ao Brasil, e datas na mesma zona do servidor
evitam confusão entre "criado hoje" no fuso do servidor vs. no de quem vê a
tela. Efeito colateral aceito: alguém em outro fuso vê uma data que não bate
com o relógio local da própria máquina.

---

## Qualidade de código

Regras extras do Biome além do `recommended`: `suspicious.noConsole`
(resíduo mais comum de uma entrega), `correctness.useExhaustiveDependencies`
e `correctness.useHookAtTopLevel` — pegam dependência esquecida em
`useEffect` (o tipo de bug que faria o `IntersectionObserver` da lista ou o
efeito do redirect rodar com closures obsoletas) e hook chamado
condicionalmente. `web/src/assets/**` e `web/public/**` têm o linter
desligado por override. `.superpowers/` está no `.gitignore` da raiz — é o
diretório de trabalho do processo de planejamento, não parte da aplicação
entregue.

---

## O que só se verifica fora do repositório

Nenhum agente que trabalhou nesta branch tem navegador. As verificações a
seguir dependem de abrir a aplicação de verdade e não foram feitas:

- **Responsividade** em 360px, 768px e 1024px.
- **Fidelidade ao Figma** — cores, espaçamento, tipografia lado a lado com o
  Style Guide.
- **Navegação por teclado** — Tab pelo formulário e pela lista, Esc no
  diálogo, `focus-visible` visível em todo elemento interativo.
- **Fluxo de redirect real** — URL curta numa aba nova (não clique interno),
  incremento da contagem, botão Voltar do navegador, servidor fora do ar e
  depois recuperado.
- **Copiar para a área de transferência** — nunca clicado num navegador real.
- **Download do CSV sem navegação** — confirmar visualmente que não abre
  nova aba nem sai da SPA.
- **`pnpm preview` com acesso direto a `/slug`** — verificação do rewrite de
  SPA (§5.6); só falha fora do dev server do Vite, que já faz esse fallback.

**O que foi verificado de ponta a ponta, fora do navegador:** os endpoints
que exclusão e exportação usam foram exercitados contra a API real (Docker de
pé) por script, não pela interface — `POST /links` → `201`,
`DELETE /links/:slug` → `204`, `POST /links/exports` → `200` com `reportUrl`
válido. Confirma que a correção do `content-type` condicional funciona contra
o servidor real, não só contra o mock de teste — mas não confirma que os
botões de deletar/exportar, clicados na interface, chegam a disparar essas
chamadas corretamente.

---

## Pendências

- **Sem teste de paridade entre o schema Zod do cliente e o do servidor.**
  Conferido manualmente (duas revisões independentes), mas nada no
  repositório impede que uma mudança futura em um dos dois divirja
  silenciosamente do outro.
- **Um único chunk JS de ~524 kB** — `vite build` avisa (chunks acima de
  500 kB) porque não há code-splitting (sem `React.lazy`, sem divisão por
  rota). Não afeta funcionalidade, só o tempo de carregamento inicial.
- **`biome.json` usa o campo `recommended`**, marcado deprecated pela versão
  instalada do Biome (sugere migrar para `preset`). Arquivo compartilhado com
  o servidor — fora do escopo alterá-lo nesta branch.

---

## Evidência

| Verificação | Resultado |
|---|---|
| Suíte | 30 testes em 5 arquivos (`env`, `routes`, `build-short-url`, `api`, `create-link-schema`) |
| `pnpm lint` | 0 avisos/erros (2 infos de versão de schema do Biome, pré-existentes) |
| `pnpm --filter web exec tsc --noEmit` | limpo |
| `pnpm --filter web build` | ok — aviso de chunk único de ~524 kB (ver Pendências) |
| E2E contra API real (script, fora da UI) | `POST /links` → 201 · `DELETE /links/:slug` → 204 · `POST /links/exports` → 200 |
| Verificação manual no navegador | não realizada nesta branch — ver seção acima |

Um teste prova uma decisão de design em vez de comportamento superficial:
`api.spec.ts` inspeciona diretamente os headers passados ao `fetch` mockado
para os casos com e sem corpo — não apenas o retorno de `api()`, que
continuaria passando mesmo com o bug do `content-type` incondicional, porque
o mock nunca simulou a resposta 400 real do Fastify.
