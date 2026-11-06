# Obras gerais · Etapa 3: Hoje, menu, Ações da equipe, avisos e "% no prazo" · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar às Obras gerais o dia a dia da Contorno: aba **Hoje** com o que está atrasado e o que é para hoje, **menu de baixo**, bloco e tela **Ações da equipe** por obra, **avisos por push** (atividade atribuída, data mudada, alguém saiu da obra, ações do dia, equipe do dia para Coordenador e Administradores) e a eficiência **"% no prazo"** da obra.

**Architecture:** Na obra geral, a **ação** é a própria atividade de topo aberta com responsável e data prevista (escolha registrada no spec: a atividade não aparece duas vezes). O core ganha as funções que transformam atividades gerais em itens do Hoje, em ações e em eficiência. O web ganha um carregador de resumo das obras gerais (uma consulta por tabela, sem N+1), uma casca de Obras gerais com menu de baixo e as telas Hoje e Ações da equipe, reaproveitando `HojeObras`, `CardAcao` e `secoesAcoes`. O banco ganha gatilhos de aviso imediato e uma rotina `gerar_avisos_gerais` com tarefa própria no pg_cron, sem tocar no `gerar_avisos` da Contorno.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Supabase (Postgres, pg_cron, pgTAP), Edge Function `enviar-avisos` (sem mudança), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` (Hoje, Reunião e Ações da equipe, Avisos, mapa A3/A14/C0/C1/J0/J1/J2).

## Roteiro

1–2 feitas. **3 (este plano).** 4: reunião, ata, pendências (Check list), boletim e **Reunião e avisos por obra** (horários dos avisos por obra; nesta etapa os avisos gerais usam os horários da configuração atual `config_avisos`). 5: Score e Log por participação (inclusive os itens Score e Log no menu de Obras gerais), sugestões por ambiente.

**Decisões desta etapa (rulings do controlador, registrar em PLAN "Decisões"):**
- Menu de baixo das Obras gerais nesta etapa: **Hoje · Obra** (Coordenador e Membro) e **Hoje · Obras** (Administrador). Score e Log entram na etapa 5, junto com os dados deles; menu com abas vazias seria pior.
- Ações da equipe em Obras gerais = atividades de topo abertas (com ou sem responsável). Tarefas de reunião entram na etapa 4.
- Horários dos avisos gerais: os de `config_avisos` (`acoes_ativo`, `acoes_hora`) até a etapa 4 trazer a configuração por obra.

## Global Constraints

- **A Contorno não muda.** `gerar_avisos`, `HojeObras` para obra Contorno, `NavInferior` da Contorno, `useObras`, Tarefas e Minhas ações ficam com o mesmo resultado. Mudanças em componentes compartilhados só podem acrescentar caminho novo, nunca alterar o da Contorno.
- Prazo da ação geral = `prazoAtividadeGeral` (último subitem com data, senão a da atividade). Atraso por `atrasoDU` (mínimo 1 d.u. depois do prazo). Atividade sem data não entra no Hoje nem nos avisos; entra em Ações da equipe só na seção que já existe para "sem prazo" se houver — senão fica fora (não inventar seção).
- **Textos (pt-BR, exatos):**
  - Linha do Hoje (atividade geral): atrasada `"{quem} · devia terminar {diaCurto}"`; para hoje `"{quem} · previsto concluir hoje"`; `quem` = "Você" para a própria pessoa, nome, ou "Sem responsável"; tipo exibido "Concluir".
  - Bloco Ações da equipe na obra: Coordenador/Administrador `"{n} abertas na obra"` + `"{k} atrasada(s)"`; Membro `"{n} suas abertas"` + `"{k} vence(m) hoje"` ou atrasadas (usar `textoStatusAcoes` se existir com a mesma forma; senão função nova no core).
  - Eficiência: `"{pct}% no prazo"`; sem nenhuma atividade vencida ou concluída: sem texto.
  - Push atribuição: título `"CONTRO · {obra}"`, corpo `"Nova atividade para você: {nome} · até {dd/mm}"` (sem data: sem o trecho " · até").
  - Push data mudada (replanejamento): título `"CONTRO · {obra}"`, corpo `"Nova data: {nome} · {dd/mm antiga} → {dd/mm nova}"`.
  - Push saída da obra (para Coordenadores da obra e Administradores): título `"CONTRO · {obra}"`, corpo `"{pessoa} saiu da obra. {n} atividade(s) ficaram sem responsável."` (só quando n > 0).
  - Push do dia por pessoa: título `"CONTRO · Obras gerais"`, corpo `contro_totais_acoes(atr, hoje) || '. Toque para ver a lista.'`.
  - Push do dia da equipe (Coordenadores e Administradores, obras que veem): título `"CONTRO · Obras gerais · equipe"`, corpo `contro_texto_equipe(...)`.
  - Deep link de todos esses avisos: `/?ir=geral-hoje`.
- Regra 1: textos e regras no core com teste; o SQL espelha os textos do core (comentar no SQL qual função do core espelha).
- Migrations com teste pgTAP; `aviso_disparo` ganha os tipos `acoes_geral` e `equipe_geral` (recriar a constraint de tipo). Atribuição/data/saída usam o tipo `atribuicao` (envio imediato já existe).
- Design system CONTRO, toque ≥ 44 px, sem emoji, pt-BR.
- Commits pt-BR no imperativo; branch `obras-gerais-3` (worktree `../16 OBDC-obras-gerais-2`); CLI `npx -y supabase@2`.
- Migrations: `20261106200000_obras_gerais_avisos.sql`.

## Review Focus

1. **Pessoa só da Contorno** nunca recebe aviso geral e **pessoa só de Obras gerais** nunca recebe aviso da Contorno; Administrador recebe os dois sem que um some no total do outro. Teste na Task 2.
2. **Coordenador de duas obras** recebe um só "equipe do dia" com as duas obras somadas (sem colidir no índice único). Teste na Task 2.
3. **Atividade sem data ou concluída** nunca aparece no Hoje nem no push do dia. Teste na Task 1 e 2.
4. **Trocar o responsável para null** ou atribuir em obra Contorno (que não usa `responsavel_id`) não gera push. Teste na Task 2.
5. **Abrir pelo push** (`?ir=geral-hoje`) leva ao Hoje de Obras gerais mesmo para quem estava na Contorno. Verificação manual na Task 4.

---

### Task 1: Core: Hoje, ações e eficiência da obra geral

**Files:** Modify `packages/core/src/obraGeral.ts`, `packages/core/src/obraGeral.test.ts`.

**Interfaces:**
- Consumes: `AtividadeGeral`, `prazoAtividadeGeral`, `statusAtividadeGeral`, `diaCurto` (etapa 2); `ItemDia`, `AgendaObra` de `agendaDia.ts`; `Acao` de `acoes.ts`; `atrasoDU`, `diaLocal` de `datas.ts`.
- Produces:
  - `agendaObraGeral(e: { atividades: AtividadeGeral[]; hoje: DataISO; pessoaId: string | null; nomes: Record<string, string> }): AgendaObra` — só atividades de topo abertas com prazo; atrasada → `atrasados`, prazo = hoje → `hoje`; `ItemDia` com `tipo: 'concluir'`, `chave: 'geral:' + id`, `nome`, `data: prazo`, `atraso: boolean`, `pessoa: quem` (regra do `quem` das Global Constraints). Ordem: atrasados por prazo crescente e nome; hoje por nome.
  - `detalheItemGeral(i: ItemDia): string` — os dois textos de linha do Hoje.
  - `acoesDaObraGeral(atividades: AtividadeGeral[], obraId: string, obraNome: string, nomes: Record<string, string>): Acao[]` — uma `Acao` por atividade de topo não excluída: `origem: 'atividade'`, `id`, `obraId`, `texto: nome`, `prazo: prazoAtividadeGeral(...)` (pode ser `null` se o tipo `Acao` permitir; se não permitir, atividades sem prazo ficam fora), `aberta: concluida_em === null`, `responsavelId`, `responsavelNome: nomes[id] ?? null`, `concluidaEm`.
  - `eficienciaObraGeral(atividades: AtividadeGeral[], hoje: DataISO): { noPrazo: number; total: number; pct: number | null }` — considera atividades de topo: concluídas com prazo original (`data_prevista_original ?? data_prevista`, ou o prazo derivado dos subitens quando não há data própria) e abertas já atrasadas. `noPrazo` = concluídas com `atrasoDU(prazoOriginal, diaLocal(concluida_em)) === 0`; `total` = concluídas com prazo + abertas atrasadas; `pct = round(100 * noPrazo / total)` ou `null` quando `total === 0`. **`AtividadeGeral` ganha `data_prevista_original: DataISO | null`** (atualizar os testes e `carregarObraGeral` na Task 3).
  - `textoEficiencia(e): string | null` — `"{pct}% no prazo"` ou `null`.
  - `textoAcoesBloco(acoes: Acao[], hoje: DataISO, pessoaId: string | null, soDaPessoa: boolean): { principal: string; detalhe: string | null; atrasadas: number }` — textos do bloco Ações da equipe (Global Constraints).
- [ ] **Step 1: Testes** (hoje = `'2026-11-05'`): agenda com atividade atrasada de Carlos (`'Carlos · devia terminar qua 04/11'`), da pessoa vencendo hoje (`'Você · previsto concluir hoje'`), sem responsável hoje (`'Sem responsável · previsto concluir hoje'`), sem data (fora), concluída (fora), atividade com subitens usa o último subitem; `acoesDaObraGeral` com aberta/concluída; eficiência: 3 concluídas (2 no prazo original, 1 com 2 d.u. de atraso) + 1 aberta atrasada + 1 aberta no prazo → `{noPrazo: 2, total: 4, pct: 50}`; replanejada concluída na nova data mas depois da original conta fora do prazo; sem nada vencido → `pct: null` e `textoEficiencia` null; `textoAcoesBloco` nos dois modos, singular e plural.
- [ ] **Step 2: Ver falhar** (`pnpm exec vitest run packages/core/src/obraGeral.test.ts`). **Step 3: Implementar. Step 4: Ver passar + typecheck. Step 5: Commit** `adiciona o hoje, as ações e a eficiência da obra geral no core`.

---

### Task 2: Banco: avisos das Obras gerais

**Files:** Create `supabase/migrations/20261106200000_obras_gerais_avisos.sql`, `supabase/tests/obras_gerais_avisos.test.sql`.

**Interfaces:**
- Consumes: `aviso_disparo` (tipos, índice único parcial `(tipo,dia,user_id) where tipo <> 'atribuicao'`), `enviar_atribuicao_imediata` (gatilho que envia `atribuicao` na hora), `config_avisos.acoes_ativo/acoes_hora`, `contro_totais_acoes`, `contro_texto_equipe`, `obra_participante`, `pessoa.administrador/papel_geral/ativo/user_id`.
- Produces:
  - constraint de tipo de `aviso_disparo` com `acoes_geral` e `equipe_geral` a mais (mantendo todos os atuais);
  - gatilho `obra_atividade_avisa_geral` (after update of `responsavel_id, data_prevista` e after insert) só para obra geral, atividade não excluída e aberta: novo responsável não nulo e diferente do anterior → aviso `atribuicao` para ele (texto de atribuição); `data_prevista` mudou de uma data para outra (replanejamento) e há responsável → aviso `atribuicao` para o responsável (texto "Nova data"); não avisa quem fez a mudança a si mesmo;
  - no gatilho de saída `obra_participante_sai` (etapa 2), quando zerou n > 0 responsáveis, aviso `atribuicao` para cada Coordenador participante da obra e cada Administrador ativo (exceto quem fez a ação), com o texto de saída;
  - `gerar_avisos_gerais(p_agora timestamptz default now()) returns int` (security definer, `search_path = ''`, revogada de public/anon/authenticated): seg a sex, com `config_avisos.acoes_ativo` e dentro da janela de 3 h após `acoes_hora` (mesma regra de janela do `gerar_avisos`), conta por pessoa as atividades de topo abertas de obras gerais ativas não excluídas, com prazo (regra do último subitem) ≤ hoje: atrasadas (`prazo < hoje`) e hoje; insere `acoes_geral` para cada responsável com user_id ativo; para cada Coordenador participante e cada Administrador ativo, soma as obras gerais que ele vê e insere `equipe_geral` (texto com `contro_texto_equipe`, pessoas ordenadas como no `gerar_avisos`, "Sem responsável" só nos totais); `on conflict (tipo, dia, user_id) where tipo <> 'atribuicao' do nothing`; devolve quantos inseriu;
  - `cron.schedule('avisos-gerais', '*/5 * * * *', 'select public.gerar_avisos_gerais()')` (idempotente: desagendar se existir).
- Regras: não tocar em `gerar_avisos`. Copiar do `gerar_avisos` atual (`20261105230000_obras_gerais_rotinas.sql`) a forma da janela de horário e o formato do JSON de pessoas para `contro_texto_equipe`. URL de todos: `/?ir=geral-hoje`.
- [ ] **Step 1: pgTAP**: atribuir pelo `definir_responsavel_atividade` gera 1 `atribuicao` para o responsável com o texto exato; trocar para null não gera; atribuir a si mesmo não gera; `definir_data_prevista` com data antiga → aviso "Nova data"; primeira data não gera "Nova data"; atividade Contorno com update de nome não gera nada; remover Membro com atividade aberta avisa Coordenador e Administradores; `gerar_avisos_gerais` num dia útil na janela: Membro com 1 atrasada + 1 hoje recebe `acoes_geral` "1 atrasada e 1 vence hoje. Toque para ver a lista."; Coordenador de 2 obras recebe 1 `equipe_geral` somando as duas; pessoa só da Contorno não recebe; rodar 2× não duplica; fim de semana e fora da janela → 0; atividade sem data/concluída/excluída não conta; o `gerar_avisos` da Contorno no mesmo cenário não conta atividades gerais.
- [ ] **Step 2–4:** ver falhar, migration, suíte inteira passando. **Step 5: Commit** `adiciona os avisos das obras gerais`.

---

### Task 3: Web: resumo das obras gerais

**Files:** Create `apps/web/src/features/obras-gerais/resumoObrasGerais.ts` (+ test), `useResumoObrasGerais.ts`; Modify `obraGeral.ts` (selecionar `data_prevista_original`).

**Interfaces:**
- Consumes: Task 1 (`agendaObraGeral`, `acoesDaObraGeral`, `eficienciaObraGeral`), padrão de `carregarObraGeral`.
- Produces:
  - `interface ResumoObraGeral { id: string; nome: string; cidade: string | null; papel: 'administrador' | 'coordenador' | 'membro'; agenda: AgendaObra; acoes: Acao[]; eficiencia: { noPrazo: number; total: number; pct: number | null }; pessoas: number }`
  - `carregarResumoObrasGerais(pessoa: { id: string; administrador: boolean; papelGeral: PapelGeral | null }, hoje: DataISO): Promise<ResumoObraGeral[]>` — `Promise.all` com: obras gerais ativas não excluídas que a pessoa vê (RLS), atividades não excluídas dessas obras (`obra!inner(ambiente)` = geral; colunas de `AtividadeGeral`), participantes com `pessoa(id,nome,ativo,deleted_at)` e Administradores ativos (nomes). Lança erro em falha de consulta. Sem N+1.
  - `useResumoObrasGerais()` — queryKey `['obras-gerais', 'resumo']`; a fila offline e as mutações de planejamento invalidam também essa chave (acrescentar onde `['obra', id]` é invalidado para obra geral).
- [ ] **Step 1: Teste** com supabase simulado: duas obras, nomes por participantes e admins, agenda/ações/eficiência montadas, erro de consulta lança. **Step 2: Implementar. Step 3:** `pnpm lint && pnpm typecheck && pnpm test`. **Step 4: Commit** `carrega o resumo das obras gerais`.

---

### Task 4: Web: menu, Hoje e aviso que abre o Hoje

**Files:** Create `apps/web/src/features/obras-gerais/ObrasGeraisCasca.tsx` (+ css), `NavGeral.tsx`, `HojeGeral.tsx`; Modify `ObrasGeraisInicio.tsx`, `ObraGeralDetalhe.tsx`, `apps/web/src/App.tsx`, `apps/web/src/features/obras/HojeObras.tsx` (só se precisar aceitar item geral; Contorno sem mudança).

**Comportamento:**
- **Casca de Obras gerais** (substitui a renderização direta de `ObrasGeraisInicio` no `App` quando o ambiente é geral): cabeçalho atual (marca, nome do ambiente quando há troca, perfil) + conteúdo da aba + `NavGeral`.
- **`NavGeral`**: mesmo visual do `NavInferior` (ativo fundo preto e ícone branco). Itens: **Hoje** e **Obra** (Coordenador e Membro) ou **Obras** (Administrador). Badge no Hoje = atrasados + hoje somados das obras, vermelho quando há atraso, preto quando não (mesma regra da Contorno). Aba lembrada em `useLembrado('obrasgerais:aba', 'hoje')`. O app abre no Hoje.
- **Hoje (A3/C0/J0)**: igual ao `HojeObras`: título "Hoje · {dia da semana}, dd/mm", linha de resumo (`resumoDoDia`), um card por obra recolhido com atrasados e para hoje; linha com tipo "Concluir", nome e `detalheItemGeral`; tocar na linha abre a obra na ficha da atividade. Reaproveitar `HojeObras` se ele aceitar os dados com um adaptador sem mudar a Contorno; senão `HojeGeral` reaproveitando seus estilos. Sem obras: "Nenhuma obra geral ainda.".
- **Aba Obra/Obras**: para Administrador, a lista atual (com o bloco Ações da equipe da Task 5); para Coordenador/Membro com uma obra, a própria obra; com mais de uma, a última aberta (o seletor do nome troca), e a lista quando nenhuma foi aberta.
- **`ObraGeralDetalhe`** ganha a prop `abrirAtividadeId?: string` (abre a ficha ao montar; o Hoje usa) e um estado de erro: se a carga falhar sem dados em cache, mostrar "Sem conexão. Tente de novo." com botão "Tentar de novo" (refetch) — pendência da etapa 2.
- **Aviso**: `?ir=geral-hoje` no `App` muda o ambiente para geral (se a pessoa tiver), abre a aba Hoje de Obras gerais. Só depois do perfil carregado (mesma regra da etapa 1).
- [ ] **Step 1: Implementar. Step 2:** `pnpm lint && pnpm typecheck && pnpm test`; no navegador (390 px, Supabase local): Membro e Coordenador abrem no Hoje com badge; tocar na linha abre a ficha; Administrador vê Hoje · Obras; `/?ir=geral-hoje` abre o Hoje geral estando na Contorno; Contorno sem mudança (Hoje, badge e menu). Prints. **Step 3: Commit** `adiciona o menu e o hoje das obras gerais`.

---

### Task 5: Web: Ações da equipe e "% no prazo"

**Files:** Create `apps/web/src/features/obras-gerais/AcoesObraGeral.tsx` (+ css), `BlocoAcoesGeral.tsx`; Modify `ObraGeralDetalhe.tsx`, `ObrasGeraisInicio.tsx` (cards e bloco do Administrador).

**Comportamento (C1, J2, A13):**
- **Bloco "Ações da equipe"** no topo da obra (abaixo do cabeçalho, acima das fases) com `textoAcoesBloco` (Membro: só as dele; Coordenador/Administrador: a obra). Toque abre `AcoesObraGeral` daquela obra. Para o Administrador, na lista de obras, um bloco que junta todas as obras gerais e abre `AcoesObraGeral` com todas.
- **`AcoesObraGeral`**: título "Ações da equipe" (+ nome da obra quando é uma só); chips como em Tarefas (Sem responsável primeiro quando houver, Todos, pessoas; `seloChipResponsavel`); seções `secoesAcoes` (Atrasadas · Vencem hoje · Próximos 5 dias · Concluídas) com `CardAcao`; tocar no card abre a ficha da atividade (`ObraGeralDetalhe` com `abrirAtividadeId`); Membro abre com o chip da própria pessoa selecionado. Sem botão de nova tarefa nesta etapa.
- **Eficiência**: `textoEficiencia` no card da obra (lista) ao lado da cidade e na linha de resumo do cabeçalho da obra (`"Fase 2 de 4 · 82% no prazo"`); sem texto quando `null`.
- [ ] **Step 1: Implementar. Step 2:** `pnpm lint && pnpm typecheck && pnpm test`; navegador: Coordenador vê "N abertas na obra", abre a tela, chips e seções corretos, card abre a ficha; Membro vê "N suas abertas"; eficiência aparece depois de concluir uma atividade vencida. Prints. **Step 3: Commit** `adiciona as ações da equipe e a eficiência das obras gerais`.

---

### Task 6: Documentação

- [ ] PRD, SPEC (funções do core, `gerar_avisos_gerais`, tipos `acoes_geral`/`equipe_geral`, gatilho de aviso, `?ir=geral-hoje`, telas), PLAN ("Obras gerais · Etapa 3" com itens marcados e as decisões do Roteiro; próximas etapas). Commit `documenta o hoje, as ações e os avisos das obras gerais`.
