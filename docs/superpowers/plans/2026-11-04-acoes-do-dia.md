# Ações do dia · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um aviso de manhã por pessoa ("Ações de hoje": atrasadas + vencem hoje, de tarefas e pendências) e um da equipe para o gestor, com as listas do app (Tarefas da equipe, Minhas ações, Hoje, boletim) tratando tarefa e pendência como "ação" nas seções Atrasadas · Vencem hoje · Próximos dias · Concluídas.

**Architecture:** A regra fica em `packages/core/src/acoes.ts` (prazo da pendência por criticidade, estado da ação, classificação, resumos e textos do push). O SQL de `gerar_avisos` espelha a regra com o helper `contro_add_du`. No web, um adaptador `acoesObra.ts` converte `TarefaObra` e `PendenciaObra` em `Acao` e um hook `useAcoesDasObras` junta as duas fontes com o mesmo cache por obra que o Check list já usa. As telas só classificam e desenham.

**Tech Stack:** React 18 + TypeScript + Vite, TanStack Query, Supabase (Postgres, pg_cron, pgTAP), Vitest, CSS Modules, tokens em `packages/ui`.

**Spec:** `docs/superpowers/specs/2026-11-04-acoes-do-dia-design.md`

## Global Constraints

- Regra de domínio só em `packages/core`, com teste (CLAUDE.md regra 1). Telas e SQL não recalculam por conta própria; o SQL espelha e tem teste pgTAP comparando casos do core.
- Dias úteis seg–sex, sem feriados (regra 2). Datas ISO `YYYY-MM-DD`; "apontada em" é `apontada_em` no fuso `America/Sao_Paulo`.
- Cores: só turquesa, preto, branco; vermelho `#C62828` só para atraso; **âmbar `#B45309` só para "vence hoje"**; fundo do card atrasado `#FBEAEA`. Estados sempre com texto e ícone.
- Vocabulário para a pessoa ler: **ação** (não "tarefa") nos avisos, seções, bloco da tela inicial, boletim. A tela de criar/editar tarefa de reunião continua "tarefa".
- Push: título `CONTRO · Ações de hoje` / `CONTRO · Equipe hoje`; corpo com no máximo 120 caracteres; ninguém recebe aviso com 0 ações; gestor recebe só o da equipe.
- Prazo da pendência: alta 2, média 4, baixa 6 dias úteis a partir do dia útil em que foi apontada (`diaUtilAPartir` + `addDU`), configurável em `config_avisos` (1–30).
- Mensagens de commit em pt-BR no imperativo; um item por commit. Migrations com RLS/teste no mesmo PR. Atualizar PRD, SPEC, PLAN (Decisões) e CLAUDE.md no mesmo PR.
- Branch de trabalho: `acoes-do-dia`, a partir de `main`.

## Review Focus

1. Pendência apontada no sábado às 23h (horário de Brasília) ou às 01h UTC de segunda: o dia-base é o dia local de São Paulo e, se cair no fim de semana, o próximo dia útil. Teste em Task 1 (`prazoPendencia`) e em Task 4 (pgTAP com `apontada_em` em UTC que vira sábado local).
2. Pendência fechada: aparece em Concluídas com `resolvida_em`, nunca em Atrasadas mesmo com prazo vencido. Teste em Task 1 (`classificarAcoes`).
3. Pessoa com 0 atrasadas e 0 hoje não recebe linha em `aviso_disparo`; gestor com equipe zerada idem; gestor nunca recebe `acoes` (só `acoes_equipe`). Teste em Task 4.
4. Corpo do push da equipe com 10 pessoas e nomes longos corta em 120 caracteres sem cortar nome no meio. Teste em Task 1 (`textoAvisoEquipe`).
5. Cache otimista do Check list: resolver uma pendência no Check list some de "Vencem hoje" em Minhas ações sem refetch, porque as duas telas leem `['pendencias', obraId]`. Verificação manual em Task 7 (passo de conferência no app).

---

### Task 1: Regra de domínio `acoes.ts`

**Files:**
- Create: `packages/core/src/acoes.ts`
- Create: `packages/core/src/acoes.test.ts`
- Modify: `packages/core/src/index.ts` (adicionar `export * from './acoes';`)

**Interfaces:**
- Consumes: `addDU`, `diaUtilAPartir`, `DataISO` de `./calendar`; `Criticidade` de `./pendencias`; `nomeCurto` de `./nomes`.
- Produces:

```ts
export type OrigemAcao = 'tarefa' | 'pendencia';
export type EstadoAcao = 'atrasada' | 'hoje' | 'proxima' | 'concluida';
export interface Acao {
  origem: OrigemAcao;
  id: string;
  obraId: string;
  texto: string;
  prazo: DataISO;
  aberta: boolean;
  responsavelId: string | null;
  /** Nome digitado (tarefa sem pessoa do app) ou nome da pessoa. */
  responsavelNome: string | null;
  concluidaEm?: string | null; // ISO timestamp
}
export interface PrazosPendencia { alta: number; media: number; baixa: number }
export const PRAZOS_PENDENCIA_PADRAO: PrazosPendencia; // { alta: 2, media: 4, baixa: 6 }
export function prazoPendencia(criticidade: Criticidade, apontadaEm: DataISO, cfg?: PrazosPendencia): DataISO;
export function estadoAcao(a: Pick<Acao, 'aberta' | 'prazo'>, hoje: DataISO): EstadoAcao;
export interface AcoesClassificadas<T extends Acao> { atrasadas: T[]; hoje: T[]; proximas: T[]; concluidas: T[] }
export function classificarAcoes<T extends Acao>(acoes: T[], hoje: DataISO): AcoesClassificadas<T>;
export interface ResumoAcoes { atrasadas: number; hoje: number }
export function resumoAcoesDia(acoes: Pick<Acao, 'aberta' | 'prazo'>[], hoje: DataISO): ResumoAcoes;
export interface LinhaEquipe extends ResumoAcoes { chave: string; nome: string } // chave: responsavelId | `nome:${nome}` | 'sem'
export interface ResumoEquipe extends ResumoAcoes { pessoas: LinhaEquipe[] }
export function resumoEquipeDia(acoes: Acao[], hoje: DataISO): ResumoEquipe;
export function textoAvisoAcoes(r: ResumoAcoes): { titulo: string; corpo: string } | null;
export function textoAvisoEquipe(r: ResumoEquipe): { titulo: string; corpo: string } | null;
export function textoResumoSecoes(c: { atrasadas: number; hoje: number; proximas: number; concluidas: number }): string;
```

- [ ] **Step 1: Escrever os testes (falham)**

```ts
// acoes.test.ts (Vitest)
it('prazoPendencia: alta 2 d.u. a partir de segunda 02/11 → qua 04/11', () =>
  expect(prazoPendencia('alta', '2026-11-02')).toBe('2026-11-04'));
it('média 4 e baixa 6 d.u.', () => {
  expect(prazoPendencia('media', '2026-11-02')).toBe('2026-11-06');
  expect(prazoPendencia('baixa', '2026-11-02')).toBe('2026-11-10');
});
it('apontada no sábado conta a partir da segunda', () =>
  expect(prazoPendencia('alta', '2026-10-31')).toBe('2026-11-04'));
it('config própria', () =>
  expect(prazoPendencia('alta', '2026-11-02', { alta: 1, media: 4, baixa: 6 })).toBe('2026-11-03'));
it('estadoAcao', () => {
  expect(estadoAcao({ aberta: true, prazo: '2026-11-03' }, '2026-11-04')).toBe('atrasada');
  expect(estadoAcao({ aberta: true, prazo: '2026-11-04' }, '2026-11-04')).toBe('hoje');
  expect(estadoAcao({ aberta: true, prazo: '2026-11-05' }, '2026-11-04')).toBe('proxima');
  expect(estadoAcao({ aberta: false, prazo: '2026-10-01' }, '2026-11-04')).toBe('concluida');
});
it('classificarAcoes ordena por prazo e concluídas da mais recente', ...); // 4 listas, fechada vencida vai para concluidas
it('resumoAcoesDia conta só abertas', ...);
it('resumoEquipeDia agrupa por responsavelId, nome digitado e "sem"; ordena atrasadas desc, hoje desc, nome', ...);
it('textoAvisoAcoes', () => {
  expect(textoAvisoAcoes({ atrasadas: 0, hoje: 0 })).toBeNull();
  expect(textoAvisoAcoes({ atrasadas: 3, hoje: 4 })).toEqual({ titulo: 'CONTRO · Ações de hoje', corpo: '3 atrasadas e 4 vencem hoje. Toque para ver a lista.' });
  expect(textoAvisoAcoes({ atrasadas: 1, hoje: 0 }).corpo).toBe('1 atrasada. Toque para ver a lista.');
  expect(textoAvisoAcoes({ atrasadas: 0, hoje: 1 }).corpo).toBe('1 vence hoje. Toque para ver a lista.');
  expect(textoAvisoAcoes({ atrasadas: 1, hoje: 1 }).corpo).toBe('1 atrasada e 1 vence hoje. Toque para ver a lista.');
});
it('textoAvisoEquipe: até 3 pessoas, "e mais N", "Sem responsável" fora das vagas', () =>
  expect(textoAvisoEquipe({ atrasadas: 5, hoje: 9, pessoas: [
    { chave: 'a', nome: 'João Vítor Silva', atrasadas: 2, hoje: 3 },
    { chave: 'b', nome: 'Matheus Teixeira', atrasadas: 1, hoje: 2 },
    { chave: 'c', nome: 'Thaina Costa', atrasadas: 0, hoje: 4 },
    { chave: 'd', nome: 'Rafael Souza', atrasadas: 1, hoje: 0 },
    { chave: 'sem', nome: 'Sem responsável', atrasadas: 1, hoje: 0 },
  ] })).toEqual({ titulo: 'CONTRO · Equipe hoje', corpo: '5 atrasadas e 9 vencem hoje · João V 2+3, Matheus T 1+2, Thaina C 0+4 e mais 1.' }));
it('textoAvisoEquipe corta em 120 sem partir nome', ...); // nomes longos: corpo.length <= 120 e termina em "…"
it('textoResumoSecoes', () =>
  expect(textoResumoSecoes({ atrasadas: 1, hoje: 7, proximas: 43, concluidas: 2 })).toBe('1 atrasada · 7 vencem hoje · 43 próximas · 2 concluídas'));
```

Regras fixas: nome curto via `nomeCurto` ("João V"); "e mais N" conta as pessoas fora das 3 vagas, excluindo `sem`; `sem` soma nos totais. Singular/plural: "1 atrasada", "1 vence hoje", "1 próxima", "1 concluída".

- [ ] **Step 2: Rodar e ver falhar**

Run: `pnpm vitest run packages/core/src/acoes.test.ts`
Expected: FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `acoes.ts` com as assinaturas acima e exportar no `index.ts`**

`prazoPendencia` = `addDU(diaUtilAPartir(apontadaEm), cfg[criticidade])`. Corte do corpo: montar com todas as pessoas que cabem; se passar de 120, tirar a última pessoa e refazer "e mais N"; nunca fatiar string no meio de nome.

- [ ] **Step 4: Rodar e ver passar**

Run: `pnpm vitest run packages/core/src/acoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/acoes.ts packages/core/src/acoes.test.ts packages/core/src/index.ts
git commit -m "adiciona a regra de ações do dia no core (prazo da pendência, estado e textos do aviso)"
```

---

### Task 2: Hoje (`agendaDia.ts`) passa a receber ações

**Files:**
- Modify: `packages/core/src/agendaDia.ts` (tipo `'tarefa'` → `'acao'`, campo `tarefas` → `acoes`)
- Modify: `packages/core/src/agendaDia.test.ts`
- Modify: `apps/web/src/features/obras/HojeObras.tsx:8-16` (`ROTULO.acao = 'Ação'`)
- Modify: `apps/web/src/features/obras/api.ts:343-351` (chave `acoes`)
- Modify: `apps/web/src/features/boletim-auto/*` e qualquer outro consumidor de `EntradaAgenda.tarefas` (Grep `tarefas:` com `agendaDoDia`)

**Interfaces:**
- Produces: `TipoItemDia` inclui `'acao'` (sem `'tarefa'`); `EntradaAgenda.acoes: { id, texto, prazo, aberta, pessoa }[]`; `ItemDia.chave = 'acao-<id>'`.

- [ ] **Step 1: Ajustar os testes de `agendaDia.test.ts`** (renomear `tarefas` → `acoes`, `tipo: 'tarefa'` → `'acao'`, `chave 'tarefa-'` → `'acao-'`) e rodar: `pnpm vitest run packages/core/src/agendaDia.test.ts` → FAIL.
- [ ] **Step 2: Renomear no `agendaDia.ts`** (ORDEM, loop, comentário "tarefas" → "ações"). Rodar → PASS.
- [ ] **Step 3: `pnpm typecheck`** e corrigir os consumidores listados; `ROTULO.acao = 'Ação'`; em `HojeObras.detalhe`, `i.tipo === 'acao'`.
- [ ] **Step 4: `pnpm test && pnpm typecheck`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "chama de ação o item de tarefa na agenda do dia"`

---

### Task 3: Tokens, ícones e documentação do design

**Files:**
- Modify: `packages/ui/src/styles/tokens.css:8` (após `--contro-late`): `--contro-attention: #b45309;` e `--contro-late-bg: #fbeaea;`
- Modify: `packages/ui/src/components/Icon.tsx` (novos nomes: `atencao` = círculo r=9 + traço vertical 8→13 + ponto 16; `checkCirculo` = círculo r=9 + polyline `8 12 11 15 16 9`; reutilizar `alert` e `calendario`)
- Modify: `CLAUDE.md:66` (acrescentar a exceção âmbar), `CONTRO_Design_System_v1.md` §2 (mesma frase), `PRD.md` §9 Design, `SPEC.md` (tokens)

- [ ] **Step 1: Adicionar tokens e ícones.** Nenhum teste automatizado; `pnpm typecheck` deve passar (o tipo `IconName` deriva do objeto).
- [ ] **Step 2: Escrever a exceção nos quatro documentos**, texto fixo: "**Exceção aprovada (04/11/2026):** âmbar `#B45309` só para **vence hoje** (ação com prazo no dia); fundo do card atrasado `#FBEAEA`. Não use âmbar para nada mais."
- [ ] **Step 3: Commit** — `git commit -m "adiciona o âmbar de vence hoje e os ícones das seções de ações"`

---

### Task 4: Migration `acoes_do_dia` + `gerar_avisos` + pgTAP

**Files:**
- Create: `supabase/migrations/20261104100000_acoes_do_dia.sql`
- Create: `supabase/tests/acoes_avisos.test.sql`
- Modify: `supabase/tests/reuniao_avisos.test.sql` (os asserts de `resumo`/`tarefas` e `resumo_para` saem; `plan(n)` ajustado)
- Modify: `supabase/functions/enviar-avisos/index.ts:1-4` só o comentário de cabeçalho (tipos novos)

**Interfaces:**
- Produces (banco): `config_avisos.acoes_ativo boolean`, `acoes_hora time` (default 07:30), `pend_alta_du smallint default 2`, `pend_media_du smallint default 4`, `pend_baixa_du smallint default 6` (check 1–30); colunas removidas `resumo_ativo, resumo_hora, resumo_para, tarefas_ativo, tarefas_hora`; `public.contro_add_du(d date, n int) returns date` immutable; `public.contro_prazo_pendencia(criticidade text, apontada_em timestamptz, c public.config_avisos) returns date`; `aviso_disparo.tipo` aceita `'acoes'` e `'acoes_equipe'` e não aceita mais `'resumo'`/`'tarefas'`.

- [ ] **Step 1: Escrever `acoes_avisos.test.sql`** (pgTAP, seed de homologação, padrão de `reuniao_avisos.test.sql`), cobrindo:
  - `contro_add_du('2026-10-31', 2) = '2026-11-04'` (sábado → próximo dia útil antes de contar) e `contro_add_du('2026-11-02', 4) = '2026-11-06'`.
  - `contro_prazo_pendencia('alta', '2026-10-31 23:30-03'::timestamptz, c) = '2026-11-04'` e `('alta', '2026-11-02 01:00+00', c) = '2026-11-03'` (01h UTC de segunda = domingo 22h local → base segunda 02/11 → qua 04/11; ajustar expectativa ao calendário real).
  - Cenário: gestor G, equipe J (com `user_id`), pessoa P sem `user_id`; obra ativa; tarefa de J prazo ontem, tarefa de J prazo hoje, pendência alta de J apontada há 3 dias úteis (vencida), pendência sem responsável apontada hoje (alta → vence em 2 d.u., não conta), tarefa de P hoje. `gerar_avisos('<hoje> 07:40-03')`:
    - J recebe 1 `acoes` com corpo `2 atrasadas e 1 vence hoje. Toque para ver a lista.` e url `/?ir=minhas`;
    - G recebe 1 `acoes_equipe`, nenhum `acoes`; corpo começa com `2 atrasadas e 2 vencem hoje · ` e url `/?ir=tarefas`;
    - P não recebe nada; rodar de novo não duplica; `gerar_avisos` às 11:00 não cria (fora da janela de 3h); com `acoes_ativo=false` não cria.
  - RLS: `authenticated` equipe não consegue `update config_avisos`; gestor consegue alterar `pend_alta_du`; valor 0 é rejeitado pelo check.
- [ ] **Step 2: `pnpm db:reset && pnpm db:test`** → o teste novo FAIL.
- [ ] **Step 3: Escrever a migration:**
  1. `alter table config_avisos add column acoes_ativo ... ; update config_avisos set acoes_ativo = resumo_ativo or tarefas_ativo, acoes_hora = resumo_hora; alter table ... drop column resumo_ativo, resumo_hora, resumo_para, tarefas_ativo, tarefas_hora;` + colunas `pend_*_du` com check.
  2. `delete from aviso_disparo where tipo in ('resumo','tarefas');` depois trocar `aviso_disparo_tipo_check` para `('reuniao_manha','reuniao_antes','acoes','acoes_equipe','providencias','atribuicao')`.
  3. `contro_add_du` (loop em plpgsql; se `d` cair em sáb/dom, avança até segunda antes de contar; `n <= 0` devolve a base) e `contro_prazo_pendencia` (dia local São Paulo; `c.pend_<crit>_du`).
  4. `create or replace function gerar_avisos(...)`: copiar a versão de `20261103110000_notificar_atribuicao_tarefa.sql`, remover os blocos `resumo` e `tarefas`, inserir o bloco `acoes` (janela `c.acoes_hora` + 3h, seg–sex) com uma CTE `acoes` = tarefas abertas (obra ativa, `deleted_at is null`) `union all` pendências abertas (`status='aberta'`, `deleted_at is null`, obra ativa) com `prazo = contro_prazo_pendencia(...)`, `pessoa_id`, `nome` (pessoa ou `responsavel_nome` ou 'Sem responsável'). Por pessoa com `user_id` e `perfil <> 'gestor'`: `atrasadas = count(prazo < v_hoje)`, `hoje = count(prazo = v_hoje)`, inserir só se soma > 0 com o corpo no formato de `textoAvisoAcoes`. Para cada gestor com `user_id`: totais da equipe (inclui "Sem responsável") e até 3 nomes curtos (`public.contro_nome_curto` se existir; senão primeiro nome + inicial do último sobrenome não-partícula, igual a `nomeCurto`), `atrasadas desc, hoje desc, nome`, "e mais N" (sem contar 'Sem responsável'), corte em 120 chars tirando a última pessoa. `on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing`.
  5. Comentário no topo citando `core/acoes.ts` como referência do formato.
- [ ] **Step 4: `pnpm db:reset && pnpm db:test`** → PASS (novo e `reuniao_avisos` ajustado).
- [ ] **Step 5: Commit** — `git commit -m "gera o aviso de ações do dia por pessoa e da equipe para o gestor"`

---

### Task 5: Tela Avisos do gestor: "Ações do dia"

**Files:**
- Modify: `apps/web/src/features/avisos/useConfigAvisos.ts` (campos `acoesAtivo`, `acoesHora`, `pendAltaDu`, `pendMediaDu`, `pendBaixaDu`; remover `resumo*`, `tarefas*`; `SELECT`/`fromDb`/`toDb`; `PADRAO_AVISOS` com 07:30 e 2/4/6)
- Modify: `apps/web/src/features/avisos/ConfigAvisosScreen.tsx:152-168` (um só bloco `Aviso` "Ações do dia", desc "Cada um recebe as suas atrasadas e as de hoje; o gestor recebe a equipe", hora via `HoraEPara` sem `para`; abaixo, três `Opcoes` "Prazo da pendência (dias úteis)" Alta/Média/Baixa com opções 1–10)
- Modify: `apps/web/src/features/avisos/*.test.ts*` se existir (Grep `resumoAtivo`)

**Interfaces:**
- Produces: `ConfigAvisos.pendAltaDu/pendMediaDu/pendBaixaDu: number`; helper `prazosDaConfig(cfg: ConfigAvisos): PrazosPendencia` exportado de `useConfigAvisos.ts`.

- [ ] **Step 1: Ajustar tipos e mapeamento; `pnpm typecheck`** → corrigir usos de `resumo*`/`tarefas*` (Grep).
- [ ] **Step 2: Tela:** substituir os dois blocos por um; conferir no app (`pnpm dev`, perfil gestor, menu Avisos) que salvar persiste e que a equipe não vê a tela.
- [ ] **Step 3: `pnpm lint && pnpm typecheck && pnpm test`** → PASS.
- [ ] **Step 4: Commit** — `git commit -m "junta os avisos da manhã em Ações do dia com o prazo da pendência"`

---

### Task 6: Adaptador e hook de ações no web

**Files:**
- Create: `apps/web/src/features/obras/acoesObra.ts`
- Create: `apps/web/src/features/obras/acoesObra.test.ts`
- Create: `apps/web/src/features/obras/useAcoesDasObras.ts`
- Modify: `apps/web/src/features/obras/useObraPendencias.ts` (exportar `usePendenciasDasObras(obraIds: string[])` com `useQueries` sobre `['pendencias', id]` e `loadPendencias`, espelhando `useTarefasDasObras`)

**Interfaces:**
- Consumes: `TarefaObra`, `PendenciaObra`, `Acao`, `prazoPendencia`, `PrazosPendencia`, `dataLocal` de `./api` (timestamp → data local ISO).
- Produces:

```ts
export type AcaoObra =
  | (Acao & { origem: 'tarefa'; tarefa: TarefaObra })
  | (Acao & { origem: 'pendencia'; pendencia: PendenciaObra });
export function tarefaParaAcao(t: TarefaObra): AcaoObra;
export function pendenciaParaAcao(p: PendenciaObra, prazos: PrazosPendencia): AcaoObra;
/** Junta tarefas e pendências das obras; prazos vêm de useConfigAvisos (padrão se ainda carregando). */
export function useAcoesDasObras(obraIds: string[]): { acoes: AcaoObra[]; carregando: boolean };
```

- [ ] **Step 1: Testes do adaptador** (Vitest, sem React): tarefa feita → `aberta=false`, `concluidaEm=feita_em`; pendência `fechada` → `aberta=false`, `concluidaEm=resolvida_em`; pendência aberta alta apontada `'2026-11-02T14:00:00-03:00'` → `prazo '2026-11-04'`; `responsavelNome` da tarefa com nome digitado; pendência sem responsável → `responsavelId null`, `responsavelNome null`; `texto` da pendência = `titulo` (local vai no detalhe da tela, não no texto).
- [ ] **Step 2: Rodar** `pnpm vitest run apps/web/src/features/obras/acoesObra.test.ts` → FAIL.
- [ ] **Step 3: Implementar** `acoesObra.ts`, `usePendenciasDasObras`, `useAcoesDasObras` (lê `useConfigAvisos().data` e aplica `prazosDaConfig`, caindo em `PRAZOS_PENDENCIA_PADRAO`).
- [ ] **Step 4: Rodar** → PASS; `pnpm typecheck` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "adiciona o adaptador de ações (tarefa e pendência) e o hook por obras"`

---

### Task 7: Tarefas da equipe e Minhas ações com quatro seções

**Files:**
- Modify: `apps/web/src/features/obras/TarefasScreen.tsx` (lista de `AcaoObra`; chips e `classificarAcoes`; `resumo` = `${quem}: ${textoResumoSecoes(...)}`; grupos Atrasadas/Vencem hoje/Próximos dias/Concluídas com ícones `alert`/`atencao`/`calendario`/`checkCirculo`; `Linha` recebe `AcaoObra`: para tarefa mantém concluir/reabrir/editar; para pendência sem botão de check, meta `[obra, responsável, criticidade "Alta"/"Média"/"Baixa", local, "apontada ter 03/11"]`, toque chama `onAbrirPendencia(obraId, pendenciaId)`)
- Modify: `apps/web/src/features/obras/TarefasScreen.module.css` (`.gHoje`, `.venceHoje` card com `border-color: var(--contro-attention)` e textos; `.atrasada` ganha `background: var(--contro-late-bg)`; cabeçalho de grupo com ícone)
- Modify: `apps/web/src/features/obras/MinhasAcoesScreen.tsx` (sem abas; quatro seções e dentro de cada uma os grupos por obra; pendências com o mesmo card; toque na pendência → `onAbrirPendencia`; subtítulo usa `textoResumoSecoes`)
- Modify: `apps/web/src/features/obras/MinhasAcoesScreen.module.css`
- Modify: `apps/web/src/App.tsx` (prop `onAbrirPendencia` para as duas telas: `setTela('inicio')` + estado `abrirObra={{ id, aba: 'pendencias' }}` passado a `MinhasObras`)
- Modify: `apps/web/src/screens/MinhasObras.tsx` (prop `abrirObra?: { id: string; aba?: AbaObra } | null` → `setObraAberta({ id, aba })`; `ObraDetalhe` recebe `abrirAba`)
- Modify: `apps/web/src/features/obras/ObraDetalhe.tsx:56-72` (`abrirAba?: AbaObra` → `setAba`)

**Interfaces:**
- Consumes: Task 6 (`useAcoesDasObras`, `AcaoObra`), Task 1 (`classificarAcoes`, `textoResumoSecoes`, `estadoAcao`), Task 3 (ícones/tokens).
- Produces: props `onAbrirPendencia(obraId: string, pendenciaId: string): void` em `TarefasScreen` e `MinhasAcoesScreen`.

- [ ] **Step 1: Tarefas da equipe.** Trocar `useTarefasDasObras` por `useAcoesDasObras`; chips: chave `responsavelId ?? (responsavelNome ? 'nome:'+nome : 'sem')`, badge só atrasadas. Textos vazios: "Nenhuma ação ainda. Toque no + para criar uma tarefa." / "Nenhuma ação para esta pessoa."
- [ ] **Step 2: Minhas ações.** Filtro `responsavelId === pessoa.id`; seções → obras → itens; `AvancoSheet` só para tarefa.
- [ ] **Step 3: Navegação até o Check list** (App → MinhasObras → ObraDetalhe aba `pendencias`). Posicionar na pendência é opcional (deixar para quem constrói).
- [ ] **Step 4: Conferir no app** (`pnpm dev`, seed): as quatro seções com ícone e cores; card atrasado com fundo `#FBEAEA`; card de hoje âmbar; resolver uma pendência no Check list e voltar para Minhas ações sem recarregar: ela está em Concluídas (Review Focus 5).
- [ ] **Step 5: `pnpm lint && pnpm typecheck && pnpm test`** → PASS.
- [ ] **Step 6: Commit** — `git commit -m "mostra ações em quatro seções com pendências em Tarefas da equipe e Minhas ações"`

---

### Task 8: Tela inicial e cards de obra contam ações

**Files:**
- Modify: `apps/web/src/features/obras/api.ts:35-56, 81-120, 163-178, 259-260, 343-351` (`ObraResumo.acoesAbertas`, `acoesAtrasadas`, `acoesHoje` no lugar de `tarefasAbertas/tarefasAtrasadas`; `listarObras` também seleciona `pendencia` aberta `id,obra_id,titulo,criticidade,apontada_em,responsavel_id,responsavel_nome?,responsavel:pessoa!responsavel_id(nome)` e `config_avisos` `pend_alta_du,pend_media_du,pend_baixa_du`, tudo no mesmo `Promise.all`; `agenda.acoes` recebe tarefas e pendências)
- Modify: `apps/web/src/screens/MinhasObras.tsx:88-90, 172-184` (bloco "Ações da equipe": `${abertas} abertas na equipe`; linha de status `${atrasadas} atrasadas · ${hoje} vencem hoje` em vermelho se atrasadas > 0, senão "nenhuma atrasada")
- Modify: `apps/web/src/features/obras/useObras.ts` (invalidar `['obras']` nas mutações de pendência já existentes em `useObraPendencias.ts`, se ainda não faz)
- Modify: testes existentes de `api.ts`/`MinhasObras` que citem `tarefasAbertas` (Grep)

**Interfaces:**
- Consumes: Task 1 (`prazoPendencia`, `PRAZOS_PENDENCIA_PADRAO`), Task 2 (`EntradaAgenda.acoes`).
- Produces: `ObraResumo.acoesAbertas: number; acoesAtrasadas: number; acoesHoje: number`.

- [ ] **Step 1: `pnpm typecheck`** após renomear os campos → corrigir consumidores.
- [ ] **Step 2: Implementar a carga** (uma consulta a mais no `Promise.all`, sem N+1) e o bloco da tela inicial.
- [ ] **Step 3: Conferir no app:** o badge da aba Hoje e o bloco batem com Tarefas da equipe (mesmos números).
- [ ] **Step 4: `pnpm lint && pnpm typecheck && pnpm test`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "conta ações (tarefas e pendências) na tela inicial e na agenda do dia"`

---

### Task 9: Boletim com pendências em "Quem faz o quê"

**Files:**
- Modify: `apps/web/src/features/obras/BoletimView.tsx:96-103` (`tabTarefas` passa a ser construído a partir de `useAcoesDasObras([obra.id])` ou do adaptador sobre `tarefas.query.data` + `useObraPendencias(obra.id).query.data`: `{ texto, pessoa, prazo, atrasado: estadoAcao(a, hoje) === 'atrasada', concluido: !a.aberta }`)
- Modify: `packages/core/src/boletim.ts` e `apps/pdf-service/src/html.ts` só se houver texto "tarefa" visível ao leitor (Grep): trocar por "ação"
- Modify: `packages/core/src/boletim.test.ts` se o texto mudar

- [ ] **Step 1:** Grep `tarefa` em `boletim.ts`, `html.ts`, `BoletimView.tsx`; o único texto visível é "Quem faz o quê" (não muda).
- [ ] **Step 2:** Alimentar `derivarAtribuicoes` com ações (tarefas + pendências com e sem responsável).
- [ ] **Step 3:** Conferir no app o texto do WhatsApp: a pendência vencida aparece sob a pessoa com 🔴 e a data do prazo.
- [ ] **Step 4: `pnpm test && pnpm typecheck`** → PASS.
- [ ] **Step 5: Commit** — `git commit -m "inclui pendências no quem faz o quê do boletim"`

---

### Task 10: Documentação e PLAN

**Files:**
- Modify: `PRD.md:55-59` (Hoje: "ação vencida (tarefa ou pendência)"), `PRD.md:149-150` (avisos do dia: "**ações do dia** (cada um recebe as suas atrasadas e as de hoje; o gestor recebe a equipe inteira) e **providências para começar**"; tocar abre Minhas ações / Tarefas da equipe), `PRD.md:168-178` (§5.11: "Grupos: Atrasadas, Vencem hoje, Próximos dias e Concluídas; tarefas e pendências com responsável juntas como **ações**; prazo da pendência por criticidade, 2/4/6 dias úteis, configurável")
- Modify: `SPEC.md:390-393` (tipos `acoes`/`acoes_equipe`, colunas novas, `contro_add_du`, `contro_prazo_pendencia`, referência a `core/acoes.ts`), §3.6 (módulo `acoes.ts` e assinaturas), §8.1 (quem faz o quê inclui pendências)
- Modify: `PLAN.md` (nova seção "## Ações do dia (04/11/2026)" com a checklist das Tasks 1–10 marcadas, e entrada em "## Decisões": `2026-11-04 · **Ações do dia.** Um push por pessoa com atrasadas + vencem hoje e um da equipe para o gestor, no lugar de "Bom dia" e "Tarefas que vencem hoje". Tarefa e pendência viram "ação" com a mesma importância, sem etiqueta de origem; pendência ganha prazo pela criticidade (alta 2, média 4, baixa 6 d.u., configurável). Seções Atrasadas · Vencem hoje · Próximos dias · Concluídas com ícone; âmbar #B45309 só para "vence hoje" (exceção ao design system); card atrasado com fundo #FBEAEA. Tela inicial, cards e boletim contam ações. **Ata não muda** (as pendências não são itens de reunião; decisão de quem implementou, a confirmar com o usuário). · pedido do usuário · usuário`)

- [ ] **Step 1:** Editar os três documentos e o CLAUDE.md (já feito na Task 3).
- [ ] **Step 2:** `pnpm format:check` → PASS (ou `pnpm format`).
- [ ] **Step 3: Commit** — `git commit -m "documenta as ações do dia no PRD, SPEC e PLAN"`

---

### Task 11: Verificação final e PR

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm test && pnpm db:reset && pnpm db:test` → tudo PASS; colar a saída resumida no PR.
- [ ] **Step 2:** Roteiro manual no app com o seed: (a) gestor abre Avisos e vê "Ações do dia" com 07:30 e 2/4/6; (b) Tarefas da equipe mostra as quatro seções; (c) Minhas ações idem; (d) tela inicial com "Ações da equipe" e lista Hoje com "Ação"; (e) boletim WhatsApp com pendência sob a pessoa; (f) `select gerar_avisos('<hoje> 07:40-03')` no banco local cria `acoes` e `acoes_equipe` com os textos esperados.
- [ ] **Step 3:** `git push -u origin acoes-do-dia` e `gh pr create` com título "Ações do dia: aviso por pessoa e da equipe, seções por prazo" e corpo com o resumo, os links dos protótipos e a saída dos testes. Sem merge.
