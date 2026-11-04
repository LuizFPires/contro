# Providências como ações · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Providência pendente sem dono aparece em Tarefas da equipe ("Sem responsável") como ação; o gestor atribui um responsável a partir dali, criando a tarefa vinculada que já existe no sistema; tela inicial e push do gestor contam essas providências.

**Architecture:** O core ganha a origem `'providencia'` em `Acao` e um conversor puro. `listarObras` (que já calcula o cronograma e `providenciarAte`) expõe as providências sem dono e grava a data calculada no banco por uma RPC em lote, para o `gerar_avisos` (SQL, sem cronograma) contar as mesmas providências. A atribuição reaproveita `TarefaSheet` + `salvar_tarefa` com `vinculo_tipo='providencia'`.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Supabase (Postgres, pgTAP), Vitest, pnpm.

**Spec:** `docs/superpowers/specs/2026-11-04-providencias-como-acoes-design.md` (continua `2026-11-04-acoes-do-dia-design.md`).

## Global Constraints

- Regra de domínio só em `packages/core`, com teste; o SQL espelha (CLAUDE.md regra 1). Dias úteis seg–sex (regra 2). Nada de valor/fornecedor/responsável em `obra_providencia` (regra 4): a coluna nova `providenciar_ate` é **derivada** e só o app grava.
- Texto da ação de providência: `"<Rótulo>: <descrição>"` com rótulos `Contratação`, `Locação`, `Compra`. Estado via `estadoAcao` sobre `providenciarAte` (`< hoje` atrasada, `= hoje` vence hoje).
- Providência "sem dono" = `status='pendente'`, atividade não concluída e não excluída, obra ativa, **sem tarefa aberta** com `vinculo_tipo='providencia'` e `vinculo_id = providência.id`. Com tarefa vinculada aberta, a providência não aparece (nem em Tarefas nem na lista Hoje); a tarefa a representa.
- Atribuir = `salvar_tarefa` com `vinculoTipo:'providencia'`, `vinculoId`, `origemTexto:'Providência da obra'`, texto editável, responsável obrigatório (pessoa ou nome digitado), prazo pré-preenchido com `providenciarAte`. Toast "Providência atribuída a <nome>" com Desfazer (= excluir a tarefa, `acoes.excluir`). Tudo otimista/offline (regra 9/10).
- Push do gestor: providências sem dono com `providenciar_ate` não nulo entram no total e em "Sem responsável" (nunca ocupam vaga de nome). Aviso "Providências para começar" não muda.
- Cores: vermelho só atraso, âmbar só vence hoje; estados com texto e ícone; pt-BR; sem emoji; toque ≥ 44px.
- Migration com RLS e pgTAP no mesmo PR; PRD/SPEC/PLAN atualizados. Commits pt-BR no imperativo, um por tarefa. Branch `providencias-acoes` a partir de `main`.

## Review Focus

1. A mesma providência não pode aparecer duas vezes (sem dono e como tarefa da pessoa), nem na tela Hoje nem em Tarefas: teste em Task 3 (`listarObras` filtra pela tarefa vinculada aberta) e verificação manual em Task 6.
2. Providência de atividade concluída ou de obra pausada não entra: teste no core/adaptador (Task 3) e pgTAP (Task 2).
3. `providenciar_ate` nulo (obra nunca aberta depois da migration) não quebra o push: pgTAP em Task 2 ignora nulos.
4. Desfazer da atribuição devolve a providência a "Sem responsável" sem recarregar: verificação manual em Task 6 (a invalidação de `['obras']` após excluir tarefa).
5. Offline: atribuir enfileira `salvar_tarefa`; a RPC de prazos nunca bloqueia a tela nem gera erro visível quando falha: Task 3 (fire-and-forget com `catch`).

---

### Task 1: Core — origem `'providencia'`

**Files:**
- Modify: `packages/core/src/acoes.ts` (`OrigemAcao` ganha `'providencia'`; novo `ROTULO_TIPO_PROVIDENCIA: Record<'contratacao'|'locacao'|'compra', string>`; `providenciaParaAcaoBase`)
- Modify: `packages/core/src/acoes.test.ts`

**Interfaces:**
- Produces:
```ts
export const ROTULO_TIPO_PROVIDENCIA = { contratacao: 'Contratação', locacao: 'Locação', compra: 'Compra' } as const;
export interface ProvidenciaBase { id: string; obraId: string; tipo: keyof typeof ROTULO_TIPO_PROVIDENCIA; descricao: string; prazo: DataISO }
export function providenciaParaAcaoBase(p: ProvidenciaBase): Acao; // origem 'providencia', aberta true, responsavelId/Nome null, texto "Contratação: Pinturas"
```

- [ ] **Step 1: Teste (falha):** `providenciaParaAcaoBase({ id:'p1', obraId:'o1', tipo:'contratacao', descricao:'Pinturas', prazo:'2026-10-26' })` → `{ origem:'providencia', id:'p1', obraId:'o1', texto:'Contratação: Pinturas', prazo:'2026-10-26', aberta:true, responsavelId:null, responsavelNome:null }`; `resumoEquipeDia` com essa ação e hoje `2026-11-04` → `sem` com `atrasadas:1` e `textoAvisoEquipe` sem "Sem responsável" no corpo.
- [ ] **Step 2:** `pnpm vitest run packages/core/src/acoes.test.ts` → FAIL.
- [ ] **Step 3:** Implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck`.
- [ ] **Step 5: Commit** — `adiciona a providência como origem de ação no core`

---

### Task 2: Migration `providenciar_ate`, RPC e `gerar_avisos`

**Files:**
- Create: `supabase/migrations/20261104200000_providencia_prazo.sql`
- Create: `supabase/tests/providencia_prazo.test.sql`
- Modify: `supabase/tests/acoes_avisos.test.sql` só se o `plan(n)` precisar (não deve)

**Interfaces:**
- Produces: `obra_providencia.providenciar_ate date null`; `public.atualizar_prazos_providencias(p_obra_id uuid, p_prazos jsonb) returns int` (security definer, `set search_path=''`; exige `contro_e_membro()` e obra existente; `p_prazos = [{"id": uuid, "ate": "YYYY-MM-DD"}]`; `update ... where providenciar_ate is distinct from ate`; devolve linhas alteradas; `grant execute to authenticated`); `gerar_avisos` com a CTE `acoes` ganhando `union all` das providências sem dono: `op.status='pendente' and op.providenciar_ate is not null`, obra ativa não excluída, atividade `concluida_em is null and deleted_at is null`, `not exists (select 1 from tarefa t where t.vinculo_tipo='providencia' and t.vinculo_id=op.id and t.status='aberta' and t.deleted_at is null)`, `pessoa_id null`, `nome 'Sem responsável'`, `prazo = providenciar_ate`.

- [ ] **Step 1: pgTAP (falha):** (a) RPC grava `ate` e devolve 1; segunda chamada igual devolve 0; usuário não membro recebe erro; (b) cenário de `gerar_avisos` com gestor G e equipe J: uma providência pendente com `providenciar_ate = hoje - 5` e sem tarefa → corpo de G começa com `1 atrasada` e não contém "Sem responsável"; (c) a mesma providência com tarefa aberta vinculada a J → sai de "sem" e entra em J (corpo cita J); (d) providência com `providenciar_ate null` não conta; (e) providência de atividade concluída não conta.
- [ ] **Step 2:** `npx supabase@2.122.1 db reset && npx supabase@2.122.1 test db` → FAIL no novo arquivo.
- [ ] **Step 3:** Migration (copiar `gerar_avisos` da `20261104100000`, só a CTE muda; comentário no topo cita o core). **Step 4:** PASS em todos os arquivos.
- [ ] **Step 5: Commit** — `grava o prazo da providência e conta as sem responsável no aviso do gestor`

---

### Task 3: Dados no web — providências sem dono, contadores e RPC

**Files:**
- Modify: `apps/web/src/features/obras/api.ts` (`ObraResumo.providenciasSemDono`; contadores; agenda; RPC)
- Modify: `apps/web/src/features/obras/acoesObra.ts` (`AcaoObra` 3ª variante; `providenciaParaAcao`)
- Modify: `apps/web/src/features/obras/useAcoesDasObras.ts` (junta `useObras().data` → providências)
- Modify: `apps/web/src/features/obras/acoesObra.test.ts`
- Modify: `apps/web/src/features/obras/useObraTarefas.ts` (invalidar `['obras']` em `onSettled` de `salvar`, `excluir`, `restaurar`, `concluir`, `reabrir` se ainda não faz — conferir; é o que tira/devolve a providência de "Sem responsável")

**Interfaces:**
- Produces:
```ts
// api.ts
export interface ProvidenciaSemDono { id: string; obraId: string; obraNome: string; tipo: 'contratacao'|'locacao'|'compra'; descricao: string; prazo: string; atividadeNome: string }
ObraResumo.providenciasSemDono: ProvidenciaSemDono[]
// acoesObra.ts
export type AcaoObra = … | (Acao & { origem: 'providencia'; providencia: ProvidenciaSemDono });
export function providenciaParaAcao(p: ProvidenciaSemDono): AcaoObra; // usa providenciaParaAcaoBase
```
- Regras em `listarObras`: `prazo = providenciarAte(o.inicio, cron.porId[atv].es, p.antecedencia_du)` (já calculado para a agenda; reaproveitar); filtro "sem dono" com o conjunto de tarefas abertas vinculadas (`tarefas` já carregadas: ampliar o select para `vinculo_tipo,vinculo_id`); `agenda.providencias` recebe só as sem tarefa vinculada aberta; contadores `acoesAbertas/Atrasadas/Hoje` somam `providenciasSemDono` com `estadoAcao`; após montar, `void supabase.rpc('atualizar_prazos_providencias', { p_obra_id, p_prazos })` por obra apenas para providências pendentes cujo `ate` difere do valor carregado (`select` passa a trazer `providenciar_ate`), com `.catch(() => {})` e sem `await`.

- [ ] **Step 1: Testes (falham):** `providenciaParaAcao` → `origem 'providencia'`, texto "Compra: Cabos", `providencia` anexada; `secoesAcoes` coloca uma providência vencida em Atrasadas. Extrair de `listarObras` uma função pura `providenciasSemDono(provs, tarefasAbertas, atividades, cron, inicio)` em `apps/web/src/features/obras/providenciasSemDono.ts` e testá-la: exclui com tarefa vinculada aberta, atividade concluída, status feito; inclui pendente sem tarefa com o prazo certo.
- [ ] **Step 2:** `pnpm vitest run apps/web/src/features/obras` → FAIL. **Step 3:** Implementar. **Step 4:** PASS; `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **Step 5: Commit** — `expõe as providências sem responsável como ações e grava o prazo calculado`

---

### Task 4: Tarefas da equipe — card e atribuição

**Files:**
- Modify: `apps/web/src/features/obras/CardAcao.tsx` (variante providência: sem check, meta `obra · atividade · "providenciar até <data>"`, `aria-label` "…: atribuir responsável", toque → `onAtribuir`)
- Modify: `apps/web/src/features/obras/TarefasScreen.tsx` (chip "Sem responsável" inclui providências; `atribuindo: ProvidenciaSemDono | null`; abre `TarefaSheet` modo atribuir; `salvar` com vínculo; toast com Desfazer)
- Modify: `apps/web/src/features/obras/TarefaSheet.tsx` (prop `modo?: 'atribuir'` + `inicial?: { texto, prazo, obraId }`: título "Atribuir providência", botão "Atribuir", obra fixa, responsável obrigatório; sem rascunho `useRascunho` nesse modo)
- Modify: `apps/web/src/features/obras/MinhasAcoesScreen.tsx` só se o tipo `AcaoObra` exigir (providência nunca tem `responsavelId`, logo não aparece)
- Modify: `apps/web/src/features/obras/ProvidenciasAba.tsx` (linha "Quem cuida: <nome> · até <data>" quando houver tarefa vinculada aberta; dados via `useObraTarefas(obra.id)`)

**Interfaces:**
- Consumes: Task 3 (`AcaoObra` providência, `useAcoesDasObras`), `useTarefasAcoes().salvar/excluir`, `usePessoas()`.
- Produces: `TarefaSheet` props `modo`, `inicial`; `CardAcao` prop `onAtribuir?: (p: ProvidenciaSemDono) => void`.

- [ ] **Step 1:** Implementar card + tela + sheet. Toast: `showToast({ message: \`Providência atribuída a ${nome}\`, onUndo: () => acoes.excluir.mutate({ obraId, id }) })`.
- [ ] **Step 2:** Conferir no app (seed local; `npx supabase@2.122.1 start`; Vite pode cair em outra porta): "Sem responsável" lista as contratações vencidas do seed; atribuir move para o chip da pessoa sem recarregar; Desfazer devolve; tela inicial "Ações da equipe" bate com o resumo da tela; lista Hoje sem duplicata; Providências da obra mostra "Quem cuida".
- [ ] **Step 3:** `pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 4: Commit** — `atribui responsável à providência a partir de Tarefas da equipe`

---

### Task 5: Documentação

**Files:**
- Modify: `PRD.md` §5.6 (providência sem dono aparece em Tarefas; atribuir cria a tarefa vinculada) e §5.11 (chip "Sem responsável" com providências; folha Atribuir), `SPEC.md` (coluna derivada `providenciar_ate`, RPC, defasagem documentada, CTE do `gerar_avisos`, `providenciaParaAcaoBase`), `PLAN.md` (seção "## Providências como ações (04/11/2026)" com as Tasks 1–6 e entrada em "Decisões": `2026-11-04 · **Providências como ações.** Providência pendente sem dono entra em Tarefas da equipe ("Sem responsável") e nos contadores; o gestor atribui responsável pela folha de tarefa, criando a tarefa vinculada à providência (mecanismo já existente; sem campo novo no lembrete). O app grava `providenciar_ate` (derivado) para o push do gestor contar as mesmas providências; pode ficar defasado até alguém abrir o app. · pedido do usuário · usuário`)
- [ ] **Step 1:** Editar; `pnpm exec prettier --check PRD.md SPEC.md PLAN.md`.
- [ ] **Step 2: Commit** — `documenta as providências como ações no PRD, SPEC e PLAN`

---

### Task 6: Verificação final e PR

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm test`; `npx supabase@2.122.1 db reset && npx supabase@2.122.1 test db`; `pnpm format:check` nos arquivos da branch.
- [ ] **Step 2:** Roteiro manual: (a) CDC Fall's do seed com contratações vencidas aparece em "Sem responsável" com 4 atrasadas e o badge vermelho; (b) atribuir uma a Thaina com prazo sugerido → some de "Sem responsável", aparece no chip Thaina, push `atribuicao` gerado em `aviso_disparo`; (c) Desfazer devolve; (d) `select gerar_avisos('<hoje> 07:40-03')` → corpo do gestor conta as providências no total e não lista "Sem responsável"; (e) tela Hoje sem item duplicado antes e depois de atribuir; (f) `providenciar_ate` preenchido no banco após abrir o app.
- [ ] **Step 3:** `git push -u origin providencias-acoes` e `gh pr create` ("Providências como ações: Sem responsável e atribuição pelo gestor"), corpo com resumo, nota de `db push` antes do merge, saída dos testes. Sem merge.
