# Item do Mapa de coleta · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Na fase Mapa de coleta da obra, um botão "Adicionar item do mapa" abre uma folha (nome, duração, antecedência, atividades que libera) e cria o item com prazo derivado, otimista e offline, com Desfazer.

**Architecture:** Nova RPC `adicionar_mapa_obra` espelhando `adicionar_atividade_obra` (insere `obra_atividade` com `mapa_antecedencia_du` + linhas em `obra_mapa_libera`, evento `criada`, idempotente por `p_id`). No web, uma op nova na fila (`adicionar_mapa`), patch otimista no cache do detalhe da obra (o pré-obra é recalculado pelo core `cronogramaPreObra` já com o item) e a folha `NovoMapaSheet`. Desfazer usa `excluir_atividade_obra`.

**Tech Stack:** Supabase (Postgres, pgTAP), React + TypeScript, TanStack Query, Dexie outbox, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-04-item-do-mapa-design.md`

## Global Constraints
- Nada novo em modelo de obra (regra 6); só a obra. Ação otimista/offline com `client_op_id` (regra 9); Desfazer no toast (regra 10). Design system (turquesa/preto/branco; toque ≥ 44 px; pt-BR). Prazo do mapa pela regra existente em `core/preObra.ts` (sem regra nova). Migration com RLS e pgTAP no mesmo PR. Branch `item-do-mapa` a partir de `main`.
- Padrões: duração 5 d.u., antecedência 10 d.u.; pelo menos uma atividade liberada; alvos só atividades de topo (`pai_id null`), de fases não preliminares, não concluídas, da mesma obra.
- Textos: botão "Adicionar item do mapa"; título da folha "Novo item do mapa"; campos "Nome", "Leva (dias úteis)", "Antecedência da contratação (dias úteis)", "Libera as atividades"; botão "Adicionar"; toast "Item do mapa adicionado".

## Review Focus
1. Op repetida offline não duplica o item (idempotência por `p_id`): pgTAP em Task 1.
2. Alvo de outra obra, subitem ou atividade preliminar é rejeitado: pgTAP em Task 1.
3. Item novo aparece com o prazo certo sem recarregar (otimista): verificação manual em Task 3; teste do patch em Task 2.
4. Desfazer remove o item e as linhas de `obra_mapa_libera` (o `excluir_atividade_obra` já cascateia? conferir; se não, a RPC de excluir precisa cobrir): pgTAP em Task 1.
5. Alvo concluído depois: o item segue com o prazo da regra atual (nada a fazer): conferir no core que `cronogramaPreObra` tolera alvo concluído.

---

### Task 1: RPC `adicionar_mapa_obra` + pgTAP
**Files:** Create `supabase/migrations/20261104400000_adicionar_mapa.sql`, `supabase/tests/adicionar_mapa.test.sql`.
**Interfaces:** `public.adicionar_mapa_obra(p_obra_id uuid, p_nome text, p_duracao_du int, p_antecedencia_du int, p_libera uuid[], p_id uuid default null) returns uuid` (security definer, `set search_path=''`, membro; fase = a fase preliminar da obra cujo título é "Mapa de coleta" — localizar por `preliminar and titulo ilike 'mapa%'`; valida nome, duração ≥ 1, antecedência ≥ 0, `p_libera` não vazio e alvos válidos; repetição de `p_id` devolve o existente; insere atividade com `mapa_antecedencia_du`, `em_sequencia true`, ordem = max+1 na fase; insere `obra_mapa_libera (obra_id, mapa_id, atividade_id)`; evento `criada` com `depois = {nome, duracao_du, antecedencia_du, libera: [...]}`; grant a `authenticated`, revoke de `public, anon`).
- [ ] pgTAP: cria com 2 alvos (linhas em `obra_mapa_libera` = 2, `mapa_antecedencia_du` = 10, fase = Mapa de coleta); mesmo `p_id` duas vezes → mesmo id e sem duplicar; alvo de outra obra → erro; alvo subitem → erro; alvo preliminar → erro; `p_libera` vazio → erro; `excluir_atividade_obra` no item remove/anula as linhas de `obra_mapa_libera` (ou documentar que ficam órfãs e filtrar no cliente — decidir e testar); não membro → erro.
- [ ] reset + test db → FAIL → migration → PASS. Commit — `adiciona a RPC de item do mapa de coleta na obra`.

### Task 2: Web — op offline, patch otimista e folha
**Files:** Modify `apps/web/src/features/obras/campo.ts` (`adicionarMapa(v)` → rpc), `apps/web/src/lib/sync.ts` (op `adicionar_mapa`, invalidações `['obra', id]`/`['obras']`), `apps/web/src/features/obras/useObraCampo.ts` (`adicionarMapa` mutation com `onMutate` inserindo a atividade no cache do detalhe com `mapa_antecedencia_du`, `mapaLibera`, fase do mapa; o core recalcula o pré-obra no `select`/derivação já existente; `onError` reverte), Create `apps/web/src/features/obras/NovoMapaSheet.tsx` (+ `.module.css`) com nome (datalist de nomes de itens de mapa já existentes na obra/obras carregadas), duração (− / +, padrão 5), antecedência (− / +, padrão 10), seleção múltipla de alvos reaproveitando a lista/busca do `AtividadePicker` (extrair o filtro de busca para um helper reutilizável se necessário), botão "Adicionar" desabilitado sem nome ou sem alvo; Modify `ObraDetalhe.tsx` (botão na fase Mapa de coleta: `onAdicionar` quando `preliminar && titulo` for o mapa → abre `NovoMapaSheet`; Orçamento sem botão); toast com Desfazer (`excluirAtividade`).
- [ ] Testes: patch otimista puro (função que insere o item no `ObraCompleta` e devolve com o prazo do pré-obra calculado) e o helper de busca de alvos. `pnpm lint && pnpm typecheck && pnpm test`. Commit — `adiciona item do mapa de coleta pela obra, com desfazer`.

### Task 3: Docs, verificação e PR
- [ ] PRD §5.6/§Fases (botão e folha), SPEC (RPC, op, patch), PLAN (seção + Decisões: `2026-11-04 · **Item do mapa pela obra.** Botão "Adicionar item do mapa" na fase Mapa de coleta; folha com nome, duração, antecedência e atividades liberadas; RPC adicionar_mapa_obra; não altera o modelo. · pedido do usuário · usuário`). Commit — `documenta o item do mapa adicionado pela obra`.
- [ ] `pnpm lint && pnpm typecheck && pnpm test`; reset + test db; roteiro manual: botão só no Mapa de coleta; criar item com 2 alvos → prazo aparece na hora e bate com a regra; offline → fila e sincroniza; Desfazer remove; Orçamento sem botão. `git push -u origin item-do-mapa`; `gh pr create` ("Adicionar item do Mapa de coleta pela obra"); nota de `db push` antes do merge. Sem merge.
