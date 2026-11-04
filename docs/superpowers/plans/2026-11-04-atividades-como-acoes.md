# Atividades como ações · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Atividade de topo não concluída, sem tarefa vinculada aberta, aparece em Tarefas da equipe ("Sem responsável") como ação (atrasada, vence hoje, próximos 5 dias); o gestor atribui alguém pela folha de tarefa, criando a tarefa vinculada à atividade; tela inicial e push do gestor contam essas atividades.

**Architecture:** Espelho exato do que foi feito para providências (PR #113): regra pura no core (`atividadesSemDono`, `semTarefaAbertaAtividade`, `prazosParaGravarAtividades`), coluna derivada `obra_atividade.fim_previsto_calc` gravada por RPC em lote, `union all` na CTE `acoes` do `gerar_avisos`, variante `'atividade'` em `AcaoObra`, card e modo atribuir já existentes em `TarefaSheet`.

**Tech Stack:** TypeScript/Vitest (core), Supabase (Postgres, pgTAP), React + TanStack Query.

**Spec:** `docs/superpowers/specs/2026-11-04-atividades-como-acoes-design.md`

## Global Constraints
- Regra só no core, com teste (regra 1). Nada novo em `obra_atividade` além da coluna derivada `fim_previsto_calc` (gravada só pelo app). Atribuir = `salvar_tarefa` com `vinculoTipo:'atividade'`, `vinculoId`, `origemTexto:'Atividade da obra'`, prazo = fim previsto; toast "Atividade atribuída a <nome>" com Desfazer (`excluir`). Otimista/offline (regra 9/10).
- "Sem dono" = topo (`pai_id null`), não concluída, não excluída, fase não preliminar, obra ativa, `fim_previsto` no cronograma, sem tarefa aberta `vinculo_tipo='atividade'`/`vinculo_id`. Texto `"Atividade: <nome>"`; detalhe obra · fase · prestador · "fim previsto <data>".
- Hoje: esconder o item de atividade (`concluir`/`andamento`) quando há tarefa vinculada aberta. Contadores "Ações da equipe" somam atividades sem dono. Push: `gerar_avisos` soma atividades sem dono com `fim_previsto_calc` não nulo ao grupo "Sem responsável".
- Nome das funções/arquivos espelhando as providências (`packages/core/src/providencias.ts` tem `providenciasSemDono`, `prazosParaGravar`, `semTarefaAberta`; migration `20261104200000_providencia_prazo.sql` tem a RPC e a CTE; web `acoesObra.ts` tem `providenciaParaAcao`; `TarefasScreen.tsx`/`CardAcao.tsx` tratam `origem === 'providencia'`).
- Branch `atividades-acoes` a partir de `main`. Migration com pgTAP. PRD/SPEC/PLAN no mesmo PR. Commits pt-BR no imperativo.

## Review Focus
1. Atividade com subitens: só a mãe vira ação; concluir a tarefa vinculada conclui a mãe (fluxo existente da câmera). Teste do core em Task 1 (subitem excluído da lista).
2. Atividade concluída fora da janela e atividade de obra pausada: nunca na lista. Teste em Task 1 e pgTAP em Task 2.
3. Atividade com tarefa vinculada aberta: fora de "Sem responsável", fora do item de Hoje, e só a tarefa conta nos contadores e no push. Teste em Task 1 (regra), Task 3 (agenda) e pgTAP (Task 2).
4. Desfazer da atribuição devolve a atividade a "Sem responsável" sem recarregar (filtro otimista). Verificação manual Task 6.
5. `fim_previsto_calc` nulo (obra nunca aberta após a migration) não quebra o push. pgTAP Task 2.

---

### Task 1: Core — `atividadesSemDono`
**Files:** Modify `packages/core/src/acoes.ts` (`OrigemAcao` ganha `'atividade'`; `atividadeParaAcaoBase`), Create `packages/core/src/atividadesAcoes.ts` (+ `.test.ts`), Modify `index.ts`.
**Interfaces:**
```ts
export interface AtividadeSemDono { id: string; obraId: string; obraNome: string; nome: string; faseNome: string; prestador: string | null; prazo: DataISO } // prazo = fim_previsto
export interface LinhaAtividadeTopo { id: string; obra_id: string; fase_id: string; pai_id: string | null; nome: string; prestador: string | null; concluida_em: string | null; fim_previsto_calc: string | null }
export function atividadesSemDono(atividades: LinhaAtividadeTopo[], fases: { id: string; preliminar: boolean; titulo: string }[], cron: { porId: Record<string, { fim_previsto: DataISO }> }, tarefasAbertas: { vinculo_tipo: string | null; vinculo_id: string | null }[], obraId: string, obraNome: string): AtividadeSemDono[];
export function prazosParaGravarAtividades(atividades: LinhaAtividadeTopo[], cron: ...): { id: string; ate: DataISO }[]; // não concluídas, de topo, fora do pré-obra, onde fim_previsto !== fim_previsto_calc
export function semTarefaAbertaAtividade<T extends { id: string }>(atividades: T[], tarefas: { status: string; vinculo_tipo: string | null; vinculo_id: string | null }[]): T[];
export function atividadeParaAcaoBase(a: AtividadeSemDono): Acao; // origem 'atividade', texto "Atividade: <nome>", aberta true, sem responsável
```
- [ ] Testes (falham): inclui topo não concluída com fim previsto; exclui subitem, concluída, preliminar, sem cronograma, com tarefa vinculada aberta (`vinculo_tipo 'atividade'`); `prazosParaGravarAtividades` só diferenças; `atividadeParaAcaoBase` texto e campos; `resumoEquipeDia` com uma atividade sem dono vencida → `sem` 1 e corpo do push sem "Sem responsável".
- [ ] FAIL → implementar → PASS; `pnpm test && pnpm typecheck && pnpm lint`. Commit — `adiciona a atividade como ação sem dono no core`.

### Task 2: Banco — `fim_previsto_calc`, RPC e `gerar_avisos`
**Files:** Create `supabase/migrations/20261104500000_atividade_prazo.sql`, `supabase/tests/atividade_prazo.test.sql`.
**Interfaces:** `alter table obra_atividade add column fim_previsto_calc date`; `public.atualizar_prazos_atividades(p_obra_id uuid, p_prazos jsonb) returns int` (cópia de `atualizar_prazos_providencias` para `obra_atividade`); `gerar_avisos` ganha na CTE `acoes` um `union all` de atividades sem dono: `oa.pai_id is null and oa.concluida_em is null and oa.deleted_at is null and oa.fim_previsto_calc is not null`, fase `not preliminar`, obra ativa, `not exists` tarefa aberta `vinculo_tipo='atividade' and vinculo_id = oa.id`; chave `sem`, prazo `fim_previsto_calc`.
- [ ] pgTAP: RPC grava e é idempotente; não membro erro; outra obra não muda; cenário: atividade atrasada sem tarefa → entra no total do gestor sem ocupar vaga; com tarefa vinculada aberta → sai de `sem` e entra na pessoa; `fim_previsto_calc` nulo não conta; subitem não conta; preliminar não conta; obra pausada não conta. `acoes_avisos.test.sql` e `providencia_prazo.test.sql` seguem passando.
- [ ] reset + test db → FAIL → migration → PASS. Commit — `grava o fim previsto da atividade e conta as sem responsável no aviso do gestor`.

### Task 3: Web — dados, agenda e contadores
**Files:** Modify `apps/web/src/features/obras/api.ts` (`listarObras`: select `fim_previsto_calc` e `prestador` nas atividades, montar `atividadesSemDono` com `cronogramaDaObra`, expor `ObraResumo.atividadesSemDono`, somar nos contadores, gravar via `atualizar_prazos_atividades` fire-and-forget, esconder do `agenda` (entrada `atividades`) as que têm tarefa vinculada aberta — ou passar a `agendaDoDia` um conjunto `comTarefa` para pular `concluir`/`andamento`), `packages/core/src/agendaDia.ts` só se precisar do conjunto (+ teste), `apps/web/src/features/obras/acoesObra.ts` (variante `'atividade'`, `atividadeParaAcao`), `useAcoesDasObras.ts` (inclui atividades sem dono de `useObras()` e esconde com `semTarefaAbertaAtividade` sobre o cache de tarefas), `acoesObra.test.ts`.
- [ ] Testes do adaptador e da agenda (item de atividade some quando há tarefa vinculada aberta). `pnpm lint && pnpm typecheck && pnpm test`. Commit — `expõe as atividades sem responsável como ações e grava o fim previsto`.

### Task 4: Tarefas da equipe e ficha
**Files:** Modify `CardAcao.tsx` (variante atividade: sem check, meta `obra · fase · prestador · "fim previsto <data>"`, aria "…: atribuir responsável", toque → `onAtribuirAtividade`), `TarefasScreen.tsx` (estado `atribuindoAtividade`; `TarefaSheet` modo atribuir com `inicial {texto:"Atividade: <nome>", prazo: fimPrevisto, obraId}`; salvar com `vinculoTipo:'atividade'`, `vinculoId`, `origemTexto:'Atividade da obra'`; toast "Atividade atribuída a <nome>" + Desfazer), `FichaAtividade.tsx` (linha "Quem cuida: <nome> · até <data>" via `useObraTarefas`), `entradaTarefa.ts` (+ teste de `entradaAtribuicaoAtividade`).
- [ ] Conferir no app: "Sem responsável" lista as atividades atrasadas do seed; atribuir move para o chip da pessoa; concluir a tarefa pela câmera conclui a atividade; Desfazer devolve; Hoje sem duplicata. `pnpm lint && pnpm typecheck && pnpm test`. Commit — `atribui responsável à atividade a partir de Tarefas da equipe`.

### Task 5: Docs
- [ ] PRD (§5.11 e §Hoje), SPEC (coluna, RPC, CTE, core), PLAN (seção "## Atividades como ações (04/11/2026)" + Decisões: `2026-11-04 · **Atividades como ações.** Atividade de topo sem tarefa vinculada aberta entra em Tarefas da equipe ("Sem responsável") nas três seções e nos contadores; atribuir cria a tarefa vinculada à atividade (concluir pela câmera conclui a atividade). fim_previsto_calc derivado para o push do gestor. Hoje esconde a atividade que já tem tarefa. · pedido do usuário · usuário`). Commit — `documenta as atividades como ações no PRD, SPEC e PLAN`.

### Task 6: Verificação final e PR
- [ ] `pnpm lint && pnpm typecheck && pnpm test`; reset + test db; roteiro manual (a) Paquetá-like: atividades atrasadas em "Sem responsável" com badge; (b) atribuir → chip da pessoa, push `atribuicao`; (c) concluir a tarefa → câmera → atividade concluída e some; (d) Desfazer devolve; (e) Hoje sem duplicata; (f) `fim_previsto_calc` gravado; (g) `gerar_avisos` conta no total do gestor; (h) tela inicial = Tarefas. `git push -u origin atividades-acoes`; `gh pr create` ("Atividades como ações: Sem responsável e atribuição pelo gestor"); nota de `db push` antes do merge. Sem merge.
