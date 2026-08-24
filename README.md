# Brev.ly — Encurtador de URLs

Aplicação fullstack para gerenciamento de URLs encurtadas, com API REST e interface React.

## Estrutura

```
url-shortener/
├── web/      ← frontend React + Vite (SPA)
└── server/   ← backend Fastify + DevOps
```

### Páginas

| Rota | Descrição |
|---|---|
| `/` | Formulário de cadastro + listagem dos links |
| `/:url-encurtada` | Redireciona para a URL original |
| `*` | Página de recurso não encontrado |
