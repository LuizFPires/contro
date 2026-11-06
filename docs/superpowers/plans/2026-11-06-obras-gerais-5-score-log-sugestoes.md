# Obras gerais · Etapa 5: Score e Log por participação, menu completo e sugestões por ambiente · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fechar Obras gerais: **Score** e **Log** das obras gerais (cada pessoa vê as obras em que participa; Administradores, todas), itens **Score** e **Log** no menu de baixo (Hoje · Obra(s) · Score · Log), **Vida do item** nas fichas gerais, e **sugestões de autocompletar separadas por ambiente** (prestador e nomes), com **nome livre de responsável em tarefa** de obra geral.

**Architecture:** Banco: `sugestao.ambiente` e `score_diario.ambiente` (padrão `'contorno'`, a Contorno não muda), RLS por ambiente, funções que gravam sugestão passam o ambiente da obra. Core: o Score da equipe aceita atividade (responsável direto) e conta replanejamento por eventos; o Log entende os eventos das atividades gerais. Web: carregador de Log/Score por ambiente (sem cronograma para geral), telas Score e Log recebem o menu por prop, casca das Obras gerais ganha as abas.

**Spec:** `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` (Score e Log; "Escolhas minhas": atividade com responsável é ação; sugestões por ambiente).

## Decisões desta etapa (rulings do controlador; registrar em PLAN "Decisões")

1. **Sugestões por ambiente, não por obra:** quem tem papel em Obras gerais vê as sugestões de Obras gerais (todas as obras gerais); a Contorno vê só as da Contorno. Excluir sugestão de prestador em Obras gerais = quem planeja alguma obra geral (Coordenador ou Administrador).
2. **Nome livre de responsável só em tarefa** de obra geral (atividade e pendência continuam com pessoa da obra ou Administrador). O nome digitado vira sugestão de Obras gerais.
3. **Score em Obras gerais:** itens = atividades de topo com responsável (prazo = data prevista efetiva; original = `prazoOriginalAtividadeGeral`), tarefas e pendências com responsável, das obras que a pessoa vê. Replanejamento = eventos `replanejada` não desfeitos (sem `data_desfeita` apontando para eles) na janela; o contador da coluna não é usado.
4. **Histórico do Score (gráfico) em Obras gerais:** gravado só quando quem abre o Score é Administrador (visão de todas as obras gerais); Coordenador e Membro veem o gráfico dessa visão e o número atual da própria visão. Assim o histórico não oscila conforme quem abre.
5. **Log em Obras gerais:** as mesmas linhas da Contorno, com os eventos das atividades gerais: "concluiu" com "responsável: X" quando quem concluiu não era o responsável, "mudou a data" (de → para) e "trocou o responsável"; data desfeita aparece como "desfez a mudança de data". Sem "início ajustado".
6. **Menu:** Hoje · Obra (ou Obras) · Score · Log para todos em Obras gerais; Score e Log abrem na própria casca, com o mesmo menu.

## Global Constraints

- **A Contorno não muda:** `sugestao` e `score_diario` existentes ficam `'contorno'`; funções da Contorno passam `'contorno'`; Score, Log, Vida do item, TarefaSheet e CampoPrestador da Contorno com o mesmo resultado (props novas opcionais com o padrão de hoje).
- Padrão de RPC: cópia literal da versão mais recente + mudanças pontuais; `security definer`, `search_path=''`, grants.
- Todo `on conflict (tipo, texto)` que existir vira `on conflict (ambiente, tipo, texto)` (com o novo índice único).
- Regra 1 (core com teste), migrations com pgTAP, design system CONTRO, pt-BR, toque ≥ 44 px.
- Commits pt-BR imperativo; branch `obras-gerais-5`; migrations `20261106400000_obras_gerais_sugestoes.sql`, `20261106410000_obras_gerais_score_diario.sql`.

---

### Task 1: Banco: sugestões por ambiente e nome livre em tarefa geral
- `sugestao.ambiente text not null default 'contorno' check (ambiente in ('contorno','geral'))`; trocar `unique(tipo, texto)` por `unique(ambiente, tipo, texto)`.
- RLS: select/insert/update = `(ambiente='contorno' and contro_e_membro()) or (ambiente='geral' and (contro_e_admin() or contro_tem_papel_geral()))`.
- Recriar (cópia literal + ambiente): `contro_sugestao_prestador` (obra geral passa a gravar com `'geral'`), `contro_normalizar_prestador_atividade` (obra geral passa a padronizar pela grafia das sugestões `'geral'`), `contro_nome_prestador` (Contorno: `'contorno'`), `excluir_sugestao_prestador(p_nome text, p_ambiente text default 'contorno')` (geral: quem planeja alguma obra geral), `salvar_tarefa` (obra geral aceita `p_responsavel_nome` e grava sugestão `'pessoa'` com `'geral'`; Contorno igual).
- pgTAP novo `obras_gerais_sugestoes.test.sql` + ajustar os testes que afirmavam o comportamento antigo (sugestao_prestador, excluir_sugestao_prestador, rls_cadastros, obras_gerais_planejamento, tarefa_obs_nome, log_score, obras_gerais_tarefas_pendencias). Cobrir: mesmo nome nos dois ambientes coexiste; pessoa só da Contorno não lê sugestão geral e vice-versa; tarefa geral com nome livre ok e vira sugestão geral; Contorno igual.
- Commit `separa as sugestões por ambiente e libera nome livre em tarefa geral`.

### Task 2: Banco: histórico do Score por ambiente
- `score_diario.ambiente text not null default 'contorno'`; PK `(ambiente, aba, chave, dia)`; RLS select: Contorno `contro_e_membro()`, geral `contro_tem_acesso()` com papel geral ou admin; `gravar_score_diario(p_linhas jsonb, p_ambiente text default 'contorno')` (cópia literal + ambiente; geral: só Administrador grava, decisão 4).
- pgTAP: Contorno igual; Admin grava geral; Membro geral lê e não grava; mesma chave nos dois ambientes coexiste.
- Commit `separa o histórico do score por ambiente`.

### Task 3: Core: Score e Log das obras gerais
- `score.ts`: `ItemEquipe.origem` aceita `'atividade'`; replanejamentos e "piores" tratam atividade como tarefa (Contorno: sem itens de atividade, resultado igual).
- Nova função `replanejamentosPorEventos(eventos: { id: string; itemId: string; tipo: string; depois: unknown }[]): Record<string, number>` (replanejada sem data_desfeita apontando para ela).
- `log.ts`: datas `data ?? prazo` nos eventos; evento `responsavel` de atividade como troca de responsável; `concluida` com `depois.responsavel_id` ≠ quem concluiu → "responsável: {nome}" (os nomes vêm de fora); `data_definida`/`data_desfeita` com textos da decisão 5.
- Funções para montar `ItemLog`/`ItemEquipe` de atividade geral a partir de `AtividadeGeral` + eventos (em `obraGeralLog.ts`, com testes).
- Testes: Contorno inalterada (testes existentes passam), atividade geral entra no Score com origem atividade, replanejamento desfeito não conta, textos do Log.
- Commit `adiciona o score e o log das obras gerais no core`.

### Task 4: Web: dados do Log e do Score por ambiente e Vida do item
- `loadDadosLogScore(desde, ambiente = 'contorno')`: Contorno igual; geral lê obras `ambiente='geral'`, atividades com as colunas de `AtividadeGeral`, tarefas, pendências (prazo pela config da obra, como em `resumoObrasGerais`), eventos e nomes (embed de pessoa); usa as funções da Task 3. Chave `['log-score', ambiente, desde]` (invalidação por prefixo `['log-score']` continua).
- `useVidaDoItem(itemId, ambiente)` e `VidaDoItem({itemId, ambiente?})`; telas gerais passam `'geral'`.
- `scoreDiario.ts` com ambiente (lê e grava conforme decisão 4).
- Teste do carregador geral com supabase simulado.
- Commit `carrega o log e o score das obras gerais`.

### Task 5: Web: menu Hoje · Obra · Score · Log e telas
- `AbaGeral` com `'score' | 'log'`; `NavGeral` com 4 itens (mesmo visual; CSS 4 colunas); `ScoreScreen`, `ScoreDetalhe` e `LogScreen` recebem `ambiente` e o menu por prop (Contorno continua passando o `NavInferior` de hoje); textos: Score em Obras gerais "Você vê quem participa das suas obras" (Administrador: "Todas as obras gerais"); chaves `useLembrado` com prefixo do ambiente.
- Deep links `?ir=geral-score` e `?ir=geral-log` (opcionais, mesmos padrões).
- Verificar no navegador: Coordenador vê só as obras dele no Log e no Score; Administrador vê todas; Contorno igual.
- Commit `adiciona score e log ao menu das obras gerais`.

### Task 6: Web: sugestões por ambiente, nome livre e documentação
- `useNomesSugeridos(ambiente = 'contorno')`, `CampoPrestador` com `ambiente` (chaves `['sugestao', tipo, ambiente]`; exclusão com `p_ambiente`); `FichaAtividadeGeral` usa `CampoPrestador` (`'geral'`) para quem planeja; `TarefaSheet` com `ambiente` e nome livre ligado nas telas gerais.
- PRD, SPEC, PLAN ("Obras gerais · Etapa 5" com itens 1–6 e decisões 1–6; marcar Obras gerais como concluída; pendências que ficaram) e CLAUDE.md ("O que é": Obras gerais entregue).
- Commit `separa as sugestões por ambiente na tela e documenta a etapa 5`.
