# CONTRO · obras da contorno

PWA mobile-first para **planejar e acompanhar as obras de reforma** das unidades
Contorno do Corpo. Cada obra nasce de um **modelo de obra** e é conduzida como um jogo
de fases: concluir atividade **com foto**, resolver pendência com **antes e depois**,
lembretes de contratação/locação/compra, **reunião de segunda** com ata e **boletim
semanal** pelo WhatsApp.

## Stack
React 18 + TypeScript + Vite (PWA) · TanStack Query · CSS Modules · Supabase (Postgres,
Auth, Storage, RLS, RPCs, pg_cron) · Vitest. Monorepo pnpm.

## Estrutura
```
apps/web            PWA (telas, features, componentes)
apps/pdf-service    HTML → PDF (débito: ainda não implementado)
packages/core       REGRAS DE DOMÍNIO puras e testadas (cronograma, semana, indicadores, textos)
packages/ui         tokens do design system + componentes base
supabase            migrations, RLS, seed, RPCs
```
A regra de domínio vive **só** em `packages/core` (telas e serviços importam, nunca
recalculam). Toda função do core tem teste.

## Comandos
```bash
pnpm i
pnpm dev           # web em http://localhost:5173
pnpm test          # vitest (core + web)
pnpm lint && pnpm typecheck && pnpm format:check
pnpm build         # build do PWA (apps/web/dist)
pnpm db:reset      # supabase db reset + seed de homologação (modelos 1, 2 e 3)
```
Configure `apps/web/.env` a partir de `apps/web/.env.example` (ver **DEPLOY.md**).

## Documentos
- **[PRD.md](PRD.md)** — o quê e por quê. **[SPEC.md](SPEC.md)** — como (dados, algoritmos,
  RLS). **[PLAN.md](PLAN.md)** — execução por milestones + decisões.
- **[DEPLOY.md](DEPLOY.md)** — subir Supabase + Vercel (go-live).
- **[PILOTO.md](PILOTO.md)** — prontidão para o piloto e o que falta.
- `docs/prototipo/` — protótipo navegável aprovado (referência visual e de fluxo).

## Status
M0–M8 concluídos (base, modelos, obra, providências, pendências, cronograma/indicadores,
tarefas, reunião/ata, boletim). O M9 foca na **prontidão para o piloto** (este milestone);
a **fila offline** é um milestone dedicado futuro. Ver PLAN.md.

## Marca e design
Marca **CONTRO** (maiúsculas). Cores: turquesa `#54B4B0`, preto `#181818`, branco; vermelho
`#C62828` só para atraso; fundo `#F6F6F6`. Tipografia Nunito Sans. pt-BR.
