# Próximos 5 dias · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** As listas de ações (Tarefas da equipe e Minhas ações) mostram em "Próximos 5 dias" só o que vence de amanhã até 4 dias úteis depois; o resto não aparece.

**Architecture:** `classificarAcoes` no core ganha a janela (`proximosDU`, padrão 5) e devolve `proximas` só dentro dela e `depois` com o restante (não renderizado). As telas e `secoesAcoes` só mudam o título e o resumo.

**Tech Stack:** TypeScript, Vitest, React.

**Spec:** `docs/superpowers/specs/2026-11-04-proximos-5-dias-design.md`

## Global Constraints
- Regra só no core, com teste. Dias úteis seg–sex (`addDU`). Título "Próximos 5 dias · N"; resumo "N nos próximos 5 dias" (singular "1 nos próximos 5 dias"). Sem linha "Mais adiante". Tela inicial e push não mudam. Branch `proximos-5-dias` a partir de `main`. Commit pt-BR no imperativo.

## Review Focus
1. Sexta-feira: a janela vai de segunda a sexta seguinte (5 d.u.), teste em Task 1.
2. Ação com prazo exatamente em `addDU(hoje, 5)` entra; `addDU(hoje, 6)` sai. Teste em Task 1.
3. `textoResumoSecoes` com 0 próximas: "0 nos próximos 5 dias". Teste em Task 1.

---

### Task 1: Core e telas
**Files:** Modify `packages/core/src/acoes.ts` (+ test), `apps/web/src/features/obras/acoesObra.ts` (título da seção), `TarefasScreen.tsx`/`MinhasAcoesScreen.tsx` só se o tipo exigir.

**Interfaces:**
```ts
export interface AcoesClassificadas<T> { atrasadas: T[]; hoje: T[]; proximas: T[]; depois: T[]; concluidas: T[] }
export function classificarAcoes<T extends Acao>(acoes: T[], hoje: DataISO, opcoes?: { proximosDU?: number }): AcoesClassificadas<T>; // padrão 5
export const PROXIMOS_DU = 5;
```
- [ ] **Step 1: Testes (falham):** sexta 06/11/2026 → `proximas` inclui prazo 13/11 e exclui 16/11; prazo em `addDU(hoje,5)` entra; `depois` recebe o resto, ordenado; `textoResumoSecoes({ atrasadas:1, hoje:7, proximas:43, concluidas:2 })` → `1 atrasada · 7 vencem hoje · 43 nos próximos 5 dias · 2 concluídas`; `proximas: 1` → `1 nos próximos 5 dias`.
- [ ] **Step 2:** `pnpm vitest run packages/core/src/acoes.test.ts` → FAIL. **Step 3:** implementar; `secoesAcoes` título `Próximos 5 dias`. **Step 4:** PASS; `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **Step 5: Commit** — `limita a seção de próximas ações aos próximos 5 dias úteis`

### Task 2: Docs e PR
- [ ] PRD §5.11 ("Próximos 5 dias", sem lista além disso), SPEC (`classificarAcoes` com `proximosDU`), PLAN (seção curta + Decisões: `2026-11-04 · **Próximos 5 dias.** As listas de ações mostram só o que vence de amanhã até 4 d.u. depois; o resto não aparece (sem "Mais adiante"). · pedido do usuário · usuário`). Commit — `documenta a janela de 5 dias das próximas ações`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test`; conferir no app a seção e o resumo; `git push -u origin proximos-5-dias`; `gh pr create` ("Próximos 5 dias nas listas de ações"). Sem merge.
