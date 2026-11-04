# Score e Log · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Duas telas novas no menu inferior, para todos: **Log** (linha do tempo das mudanças de estado dos itens, por dia, com filtros, e a "Vida do item" nas fichas) e **Score** (score 0–100 por nome, equipe e prestadores, 30/90 dias, com detalhe), mais o motivo opcional ao replanejar tarefa.

**Architecture:** Regras puras em `packages/core` (`log.ts`, `score.ts`) sobre os eventos que o app já grava (`tarefa_evento`, `pendencia_evento`, `obra_atividade_evento`) e os dados que `listarObras`/`loadObraDetalhe` já carregam. O web adiciona um carregador de eventos por obra (janela de 90 dias, cache por obra) e as telas. Banco: índices por `em` e `p_motivo` em `salvar_tarefa`.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Supabase (Postgres, pgTAP), Vitest, CSS Modules, tokens em `packages/ui`.

**Spec:** `docs/superpowers/specs/2026-11-04-score-e-log-design.md`

## Global Constraints

- Regra de domínio só em `packages/core`, com teste (regra 1). Dias úteis seg–sex (regra 2). Nada se apaga; eventos são só lidos (regra 7). Nenhuma escrita nova além de `p_motivo`.
- Menu inferior: **Hoje · Obras · Score · Log**, ícones `calendario`/`obras`/`score` (novo)/`relogio`, 56 px de altura, cantos 14 px, texto 13 px, gap 8 px; ativo com fundo `--contro-black` e ícone/texto `--contro-white`; badge vermelho de atrasos no Hoje.
- Cores: vermelho só atraso/vencida, âmbar só replanejada/início ajustado/"regular", `#2a7f7b` para ok; estados com texto e ícone; pt-BR; sem emoji; toque ≥ 44 px.
- Score: janela 30/90 dias corridos até hoje; só itens concluídos ou vencidos na janela; mínimo 5 itens; pesos e fórmulas exatamente como o spec (§3); faixas ≥ 75 Resolutivo/Resolutiva (equipe) · Em dia (prestador), 50–74 Regular, < 50 Atenção; tendência 30 × 90 com diferença ≥ 5.
- Prazo de referência: tarefa `prazo_original ?? prazo`; pendência `prazoPendencia(criticidade, apontada local)`; atividade `fim_previsto` do cronograma vigente (`calcularCronograma`), só atividades de topo; obras ativas e concluídas; itens excluídos fora; prestador em branco fora; chave do prestador = nome normalizado (trim, minúsculas, sem acento).
- Log: últimos 90 dias; linhas derivadas "vencida" no dia seguinte ao prazo se o item ainda estava aberto; tipos/cores do spec §2; filtros obra / Replanejadas / Atividades / Tarefas / Pendências / Eu; "Replanejadas" mostra por item (Vida do item).
- Deep links `?ir=score` e `?ir=log` em `App.tsx`.
- Commits pt-BR no imperativo; migration com pgTAP; PRD/SPEC/PLAN/CLAUDE.md no mesmo PR. Branch `score-e-log` a partir de `main`.

## Review Focus

1. Tarefa replanejada 2× e concluída no 3º prazo: Pontualidade conta como **atrasada** (prazo original), Conclusão do dia conta só se concluída no dia do prazo vigente, Resposta ao atraso mede do prazo original. Teste em Task 2.
2. Item que vence no sábado (prazo manual num fim de semana) e é concluído na segunda: a linha "vencida" do Log cai no domingo? Regra: "vencida" aparece no primeiro dia **útil** após o prazo; concluído nesse dia conta como 1 d.u. de atraso. Teste em Task 1 e Task 2.
3. Pessoa com 4 itens: "sem score ainda · mín. 5", nunca ordenada entre as pontuadas. Teste em Task 2.
4. Atividade concluída sem foto e depois com foto anexada: "Com foto" conta a partir do evento `foto_anexada`. Teste em Task 2.
5. Motivo com 120+ caracteres ou vazio: a RPC corta/ignora sem erro; o Log mostra "—" quando não há motivo. Teste em Task 3 (pgTAP) e Task 1 (texto).

---

### Task 1: Core `log.ts`

**Files:**
- Create: `packages/core/src/log.ts`, `packages/core/src/log.test.ts`
- Modify: `packages/core/src/index.ts` (`export * from './log'`)

**Interfaces:**
- Consumes: `DataISO`, `addDU`, `diaUtilAPartir`, `duEntre` de `./calendar`; `prazoPendencia` de `./acoes`; `nomeCurto`.
- Produces:
```ts
export type TipoLinhaLog = 'criada'|'atribuida'|'replanejada'|'inicio_ajustado'|'avanco'|'concluida'|'resolvida'|'reaberta'|'vencida'|'excluida'|'restaurada'|'apontada';
export type OrigemLog = 'atividade'|'tarefa'|'pendencia'|'providencia';
export type CorLog = 'neutra'|'ok'|'atencao'|'atraso';
export interface LinhaLog { id: string; em: string; dia: DataISO; tipo: TipoLinhaLog; origem: OrigemLog; itemId: string; itemTexto: string; obraId: string; obraNome: string; pessoa: string|null; detalhe: string; cor: CorLog }
export interface EventoBruto { id: string; itemId: string; tipo: string; por: string|null; porNome: string|null; em: string; antes: Record<string,unknown>|null; depois: Record<string,unknown>|null }
export interface ItemLog { origem: OrigemLog; id: string; obraId: string; obraNome: string; texto: string; prazo: DataISO|null; prazoOriginal: DataISO|null; aberta: boolean; concluidaEm: string|null; responsavelNome: string|null; excluida: boolean; vinculoProvidencia?: boolean }
export interface EntradaLog { itens: ItemLog[]; eventos: { origem: OrigemLog; evento: EventoBruto }[]; hoje: DataISO; formatarData: (d: DataISO) => string }
export function montarLog(e: EntradaLog): LinhaLog[]; // em desc
export function agruparPorDia(linhas: LinhaLog[], formatarDiaCompleto: (d: DataISO) => string): { dia: DataISO; rotulo: string; linhas: LinhaLog[] }[];
export type FiltroLog = { obraId?: string; tipo?: 'replanejadas'|'atividades'|'tarefas'|'pendencias'; pessoaNome?: string };
export function filtrarLog(linhas: LinhaLog[], f: FiltroLog): LinhaLog[];
export interface PassoVida { em: string; rotulo: string; detalhe: string; cor: CorLog }
export function vidaDoItem(item: ItemLog, eventos: EventoBruto[], hoje: DataISO, formatarData: (d: DataISO) => string): { passos: PassoVida[]; resumo: string };
```
- Textos fixos: replanejada → `de <antes> para <depois> · <n>ª vez` + ` · "<motivo>"` quando houver; concluída de atividade → `<n> d.u. depois do fim previsto` ou `no prazo` + ` · com foto`; vencida → `prazo era <data>`; resumo da vida → `<n> d.u. além do prazo original · <n> replanejamentos · <n> dias aberta` (singulares "1 replanejamento", "1 dia").

- [ ] **Step 1: Testes (falham):** tarefa com `criada`, `replanejada` ×2 (`antes.prazo`/`depois.prazo`, 2ª com `depois.motivo`), `concluida` → 4 linhas com cores `neutra, atencao, atencao, ok` e detalhes exatos; `vencida` derivada no primeiro dia útil após o prazo quando aberta; `agruparPorDia` rotula "Quarta, 04/11"; `filtrarLog` "replanejadas" só mantém `replanejada`/`inicio_ajustado`; `vidaDoItem` devolve o resumo `4 d.u. além do prazo original · 2 replanejamentos · 8 dias aberta`.
- [ ] **Step 2:** `pnpm vitest run packages/core/src/log.test.ts` → FAIL. **Step 3:** implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `adiciona o log de mudanças dos itens no core`

---

### Task 2: Core `score.ts`

**Files:**
- Create: `packages/core/src/score.ts`, `packages/core/src/score.test.ts`
- Modify: `packages/core/src/index.ts`; `packages/core/src/nomes.ts` (`normalizarNome(nome): string` trim/minúsculas/sem acento, com teste)

**Interfaces:**
- Produces:
```ts
export type Janela = 30 | 90;
export type Faixa = 'resolutivo'|'em_dia'|'regular'|'atencao'|'sem_score';
export interface ItemEquipe { id: string; origem: 'tarefa'|'pendencia'; obraId: string; obraNome: string; texto: string; chavePessoa: string; nomePessoa: string; prazo: DataISO; prazoOriginal: DataISO; concluidaEm: string|null; replanejamentos: number; excluida: boolean }
export interface ItemPrestador { id: string; obraId: string; obraNome: string; texto: string; prestador: string; fimPrevisto: DataISO; concluidaEm: string|null; comFoto: boolean; excluida: boolean }
export interface IndicadoresEquipe { pontualidade: number|null; conclusaoDoDia: number|null; respostaAtraso: number|null; replanejamentos: number|null; pendencias: number|null }
export interface IndicadoresPrestador { noFimPrevisto: number|null; atrasoMedio: number|null; comFoto: number|null }
export interface LinhaScore<I> { chave: string; nome: string; itens: number; score: number|null; faixa: Faixa; indicadores: I; piores: { id: string; texto: string; obraNome: string; detalhe: string }[] }
export function calcularScoreEquipe(itens: ItemEquipe[], janela: Janela, hoje: DataISO): LinhaScore<IndicadoresEquipe>[];
export function calcularScorePrestadores(itens: ItemPrestador[], janela: Janela, hoje: DataISO): LinhaScore<IndicadoresPrestador>[];
export function tendencia(score30: number|null, score90: number|null): 'melhorando'|'estavel'|'piorando'|null;
export function rotuloFaixa(f: Faixa, genero?: 'f'|'m'): string; // Resolutiva/Resolutivo · Em dia · Regular · Atenção · Sem score ainda
export const PESOS_EQUIPE = { pontualidade: 35, conclusaoDoDia: 20, respostaAtraso: 20, replanejamentos: 15, pendencias: 10 } as const;
export const PESOS_PRESTADOR = { noFimPrevisto: 45, atrasoMedio: 30, comFoto: 25 } as const;
export const MINIMO_ITENS = 5;
```
- Regras: item entra se `concluidaEm` dentro da janela **ou** (aberto e `prazo < hoje` com prazo dentro da janela); indicador sem base (ex.: ninguém atrasou) fica `null` e o peso é redistribuído proporcionalmente entre os demais; Resposta ao atraso = mediana de `duEntre(prazoOriginal, dataLocal(concluidaEm))` dos atrasados concluídos (abertos vencidos contam `duEntre(prazoOriginal, hoje)`); `piores` = 3 itens com maior atraso em d.u.

- [ ] **Step 1: Testes (falham)** cobrindo o Review Focus 1–4, o mínimo de 5, a redistribuição de peso, a ordenação (score desc, sem score por último), `tendencia(41, 37) === 'estavel'`, `tendencia(60, 50) === 'melhorando'`, `rotuloFaixa('resolutivo','f') === 'Resolutiva'`, `normalizarNome(' Pinturas Sílva ') === 'pinturas silva'`.
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS; `pnpm test && pnpm typecheck && pnpm lint`.
- [ ] **Step 5: Commit** — `adiciona o score por nome da equipe e dos prestadores no core`

---

### Task 3: Banco — índices e motivo do replanejamento

**Files:**
- Create: `supabase/migrations/20261104300000_log_score.sql`, `supabase/tests/log_score.test.sql`
- Modify: `apps/web/src/features/obras/campo.ts` (`EntradaTarefa.motivoReplanejamento?: string|null`; `salvarTarefa` envia `p_motivo`), `apps/web/src/lib/sync.ts` só se a op `salvar_tarefa` precisar do campo novo no payload (conferir)

**Interfaces:**
- Produces: índices `tarefa_evento (em desc)`, `pendencia_evento (em desc)`, `obra_atividade_evento (em desc)`; `salvar_tarefa(... , p_motivo text default null)` (nova versão com todos os parâmetros atuais de `20261026110000_tarefa_obs_responsavel_nome.sql` mais `p_motivo`; quando o prazo muda, `depois = jsonb_build_object('prazo', p_prazo, 'motivo', nullif(left(btrim(p_motivo), 120), ''))`).

- [ ] **Step 1: pgTAP (falha):** replanejar com motivo grava `depois->>'motivo'`; sem motivo grava null; motivo com 200 caracteres fica com 120; chamada sem `p_motivo` (assinatura antiga) continua funcionando; os três índices existem (`pg_indexes`).
- [ ] **Step 2:** `npx supabase@2.122.1 db reset && npx supabase@2.122.1 test db` → FAIL. **Step 3:** migration. **Step 4:** PASS.
- [ ] **Step 5: Commit** — `grava o motivo do replanejamento e indexa os eventos por data`

---

### Task 4: Web — carga de eventos e adaptadores

**Files:**
- Create: `apps/web/src/features/log/eventosObra.ts` (`loadEventosObra(obraId, desde: DataISO)` → `{ tarefas: EventoBruto[]; pendencias: EventoBruto[]; atividades: EventoBruto[] }` em três consultas com `em >= desde`, `por:pessoa!por(nome)`), `apps/web/src/features/log/useEventosDasObras.ts` (`useQueries` chave `['eventos', obraId, desde]`), `apps/web/src/features/log/itensLog.ts` (adaptadores puros: `ObraResumo` + tarefas + pendências + atividades do detalhe → `ItemLog[]`, `ItemEquipe[]`, `ItemPrestador[]`), `apps/web/src/features/log/itensLog.test.ts`
- Modify: `apps/web/src/features/obras/api.ts` só se `ObraResumo` precisar expor `status` e as atividades de topo com `fim_previsto`, `concluida_em`, `prestador`, `foto_conclusao_id` (hoje `listarObras` já tem `cron` e as atividades; expor `atividadesTopo: { id, nome, fimPrevisto, concluidaEm, prestador, comFoto, excluida }[]`), e carregar também obras `concluida` (hoje só `ativa`) com um campo `status`.

**Interfaces:**
- Consumes: Task 1/2 tipos; `useAcoesDasObras` (tarefas e pendências já carregadas, com `prazo`, `prazoOriginal`, `responsavelNome`).
- Produces: `useLogDados(janelaDias)` → `{ linhas: LinhaLog[]; itens: ItemLog[]; eventosPorItem: Map<string, EventoBruto[]>; carregando }`; `useScoreDados()` → `{ equipe: ItemEquipe[]; prestadores: ItemPrestador[]; carregando }`.

- [ ] **Step 1: Testes dos adaptadores** (sem React): tarefa → `ItemEquipe` com `prazoOriginal = prazo_original ?? prazo`; pendência → prazo por criticidade; atividade de topo com foto → `comFoto true`; obra pausada excluída; prestador vazio excluído.
- [ ] **Step 2:** FAIL → implementar → PASS; `pnpm lint && pnpm typecheck && pnpm test`.
- [ ] **Step 3: Commit** — `carrega os eventos das obras e prepara os itens do log e do score`

---

### Task 5: Menu inferior e telas Log e Score

**Files:**
- Modify: `packages/ui/src/components/Icon.tsx` (ícone `score`: três barras verticais + base), `apps/web/src/screens/MinhasObras.tsx` + `.module.css` (4 itens; `.navAtivo` preto/branco; `aba` passa a `'hoje'|'obras'`; Score e Log navegam por `onIr('score'|'log')`), `apps/web/src/App.tsx` (telas `'score'`, `'log'`, deep links)
- Create: `apps/web/src/features/log/LogScreen.tsx` + `.module.css` (chips, lista por dia, cards com ícone/cor, modo "por item" no filtro Replanejadas, toque abre o item reaproveitando `abrirObra`/`abrirPendencia`/folha da tarefa), `apps/web/src/features/log/VidaDoItem.tsx` (bloco reutilizável), `apps/web/src/features/score/ScoreScreen.tsx` + `.module.css` (segmentos Equipe/Prestadores e 30/90; cards por nome; "você"; sem score), `apps/web/src/features/score/ScoreDetalhe.tsx` (indicadores com barra, tendência, "Ações que mais pesaram")
- Modify: `apps/web/src/features/obras/ObraDetalhe.tsx` (ícone relógio no cabeçalho → Log filtrado pela obra), `TarefaSheet.tsx` e `FichaAtividade.tsx` e `PendenciaDeck.tsx`/`PendenciasAba.tsx` (bloco `VidaDoItem`), `TarefaSheet.tsx` + `MinhasAcoesScreen.tsx` `AvancoSheet` (campo "Motivo (opcional)" quando o prazo muda; 120 caracteres)

- [ ] **Step 1:** Menu + rotas + ícone. **Step 2:** LogScreen + VidaDoItem. **Step 3:** ScoreScreen + ScoreDetalhe. **Step 4:** Motivo ao replanejar nas duas folhas.
- [ ] **Step 5:** Conferir no app (seed + dados de teste): menu com 4 itens e ativo preto; Log por dia com cores; filtro Replanejadas por item; Vida do item nas três fichas; Score com "você", sem score com < 5, detalhe; motivo gravado e exibido.
- [ ] **Step 6:** `pnpm lint && pnpm typecheck && pnpm test` → PASS.
- [ ] **Step 7: Commits** — `adiciona o menu inferior com Score e Log`, `mostra o log das mudanças por dia e a vida do item`, `mostra o score por nome da equipe e dos prestadores`, `pede o motivo opcional ao replanejar a tarefa`

---

### Task 6: Documentação

- Modify: `PRD.md` (§ novo "5.13 Score e Log" + menu inferior em §5.1/Decisões de layout), `SPEC.md` (módulos `log.ts`/`score.ts`, fórmulas e pesos, consultas de eventos, `p_motivo`), `PLAN.md` (seção "## Score e Log (04/11/2026)" com Tasks 1–7 e entrada em Decisões: `2026-11-04 · **Score e Log.** Menu inferior Hoje · Obras · Score · Log (ativo preto/branco), para todos os perfis. Log = eventos já gravados (90 dias), com "vencida" derivada e Vida do item nas fichas; motivo opcional ao replanejar tarefa (p_motivo). Score 0–100 por nome: equipe (pontualidade 35, conclusão do dia 20, resposta ao atraso 20, replanejamentos 15, pendências 10) e prestadores (no fim previsto 45, atraso médio 30, com foto 25), mínimo 5 itens, faixas ≥75/50–74/<50; "empurrou a fase" descartado (sem início real da sucessora); prazo da atividade = cronograma vigente. · pedido do usuário · usuário`), `CLAUDE.md` (decisão de layout: menu inferior com quatro itens, ativo preto).
- [ ] **Step 1:** editar; `pnpm exec prettier --check` nos quatro. **Step 2: Commit** — `documenta Score e Log no PRD, SPEC, PLAN e CLAUDE`

---

### Task 7: Verificação final e PR

- [ ] **Step 1:** `pnpm lint && pnpm typecheck && pnpm test`; `npx supabase@2.122.1 db reset && npx supabase@2.122.1 test db`; prettier nos arquivos da branch.
- [ ] **Step 2:** Roteiro manual: (a) menu com 4 itens, ativo preto; (b) Log de todas as obras por dia, com replanejada em âmbar, vencida em vermelho, concluída com check, e o motivo; (c) filtro Replanejadas por item; (d) ícone na obra abre o Log filtrado; (e) Vida do item em tarefa, atividade e pendência; (f) Score Equipe 30/90 com "você", sem score com < 5, detalhe com indicadores e piores; (g) Score Prestadores; (h) replanejar com motivo pela folha da tarefa e por Minhas ações; (i) deep links `?ir=log` e `?ir=score`; (j) Log abre em < 1,5 s com o seed.
- [ ] **Step 3:** `git push -u origin score-e-log` e `gh pr create` ("Score e Log: histórico das mudanças e score por nome"); corpo com resumo, nota de `db push` antes do merge, testes. Sem merge.
