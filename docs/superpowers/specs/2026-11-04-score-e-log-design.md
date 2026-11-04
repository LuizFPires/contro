# Score e Log: histórico das mudanças e score por nome

Data: 04/11/2026 · Estado: aprovado pelo usuário em 04/11/2026 (protótipo https://claude.ai/artifact/HgoM2xGsNiw1eWYnragKSt)

## Intenção e por quê

O gestor quer (04/11/2026):

- ver de forma rápida e direta **como os itens da obra mudaram de estado**: concluída, replanejada no dia x, no dia y…, com quem mudou;
- **metrificar o engajamento e a qualidade da mão de obra**: quem cumpre o que vence hoje, quanto tempo leva para responder a um atraso, quem replaneja toda vez; um **score nominal** para a equipe e para os prestadores de serviço.

Ambos devem ser **visíveis para todo mundo** ("é bom que as pessoas vejam a classificação e se motivem"), no menu inferior da tela inicial: **Hoje · Obras · Score · Log**, cada um com ícone, e o item ativo com fundo preto e ícone branco.

## Decisões do usuário (04/11/2026)

1. Score para os dois: **equipe** (responsáveis por tarefas e pendências) e **prestadores** (quem executa as atividades), sempre **por nome**.
2. Log e Score para **todos os perfis**, no menu inferior, com ícones; altura e espaçamento do menu como hoje (56 px, cantos 14 px); ativo com fundo preto e ícone/texto brancos.
3. Nomes dos itens: **Score** e **Log**.
4. O Log mostra os itens mudando de status: concluída, replanejada (dia e de → para), reaberta, resolvida, atribuída, início ajustado, vencida sem concluir.
5. **Motivo opcional ao replanejar** (04/11/2026): ao mudar o prazo de uma tarefa aberta, campo "Motivo (opcional)" gravado no evento `replanejada` (`depois.motivo`) e mostrado no Log e na Vida do item.

## Fonte dos dados (já existe; nada novo a gravar)

- `tarefa_evento` (`criada`, `editada`, `replanejada` com `antes.prazo` / `depois.prazo`, `concluida`, `reaberta`, `excluida`, `restaurada`), `tarefa.prazo_original`, `replanejamentos`, `feita_em`. Não existe motivo de replanejamento nem evento de troca de responsável na tarefa.
- `pendencia_evento` (`apontada`, `resolvida`, `reaberta`, `editada`, `responsavel_alterado`, `excluida`, `restaurada`; `adiada`/`trazida` antigos), `pendencia.apontada_em`, `resolvida_em`, criticidade → prazo (`prazoPendencia`).
- `obra_atividade_evento` (`criada`, `concluida` com `foto_id`, `reaberta`, `avanco`, `foto_anexada`, `inicio_ajustado`, `plano_recuperacao`, `subitem`, `excluida`, `restaurada`; `antes`/`depois` jsonb), `obra_atividade.prestador` (texto), `concluida_em`, cronograma (`fim_previsto` do core).
- Providência: a "atribuição" é a `tarefa_evento.criada` de uma tarefa com `vinculo_tipo='providencia'`; "providenciada" é a `tarefa_evento.concluida` dessa tarefa (ou `obra_providencia.feito_em`).
- "Venceu sem concluir" não é evento: é derivado (prazo < dia e item ainda aberto naquele dia). No Log aparece como linha no dia seguinte ao prazo.
- RLS: as três tabelas de evento já têm política de select para membro (conferido). Falta só índice por `em` para a janela de 90 dias.

## Objetivos

- **Log**: uma linha do tempo de todas as obras (e a mesma, filtrada, dentro da obra), agrupada por dia, com uma linha por mudança: tipo (com ícone), item, obra, quem, detalhe. Filtros por obra, por tipo (Replanejadas, Atividades, Tarefas, Pendências) e "Eu". Tocar numa linha abre o item. Bloco **"Vida do item"** na folha da tarefa, na ficha da atividade e na pendência: criada → replanejada 1x (de → para, motivo) → … → concluída, com o resumo "N d.u. além do prazo original · N replanejamentos · N dias aberta".
- **Score**: tela com abas **Equipe** e **Prestadores** e janela **30 / 90 dias**; lista por nome com score 0–100, faixa em texto e os dois números principais; a própria pessoa destacada com "você"; sem score abaixo de **5 itens** no período ("sem score ainda · mín. 5"). Detalhe por nome: os indicadores com barra, tendência 30 × 90 dias e "ações que mais pesaram".
- Toda regra (classificar eventos, compor a linha do tempo, calcular indicadores e score) em `packages/core`, com teste. Telas só desenham.

## Não objetivos

- Não grava evento novo. A única mudança de RPC é o `p_motivo` opcional em `salvar_tarefa` (gravado em `depois.motivo` do evento `replanejada`). O Log lê o que existe; itens anteriores à existência de um evento simplesmente não aparecem.
- Não há configuração de pesos pelo gestor nesta versão (pesos fixos no core, documentados).
- Não há comparação entre obras nem gráfico de evolução; só os números e a tendência 30 × 90.
- Não exporta PDF nem WhatsApp.
- Não muda a tela inicial além do menu inferior.

## Anti-objetivos

- Score com amostra pequena virar "nota" (por isso o mínimo de 5).
- Replanejar "limpar" o atraso (o atraso conta sempre do **prazo original**).
- Linha do Log que não diga quem mudou e de onde para onde.
- Vermelho fora de atraso, âmbar fora de "vence hoje"/replanejamento.

## Como fica

### 1. Menu inferior (tela inicial)
- Quatro itens: Hoje (ícone casa, já existe `home`), Obras (`obras`), Score (novo ícone de barras `score`), Log (relógio `relogio`, já existe). Texto 13 px, 56 px de altura, cantos 14 px, gap 8 px, como hoje.
- Ativo: fundo `--contro-black`, ícone e texto `--contro-white` (substitui o turquesa a 22 % que é o ativo de hoje). Badge vermelho de atrasos continua no Hoje.
- `tela` no `App.tsx` ganha `'score'` e `'log'`; `?ir=score` e `?ir=log` nos deep links.

### 2. Log (core `log.ts`)
- `LinhaLog { id, em, dia, tipo: 'concluida'|'replanejada'|'reaberta'|'resolvida'|'apontada'|'atribuida'|'inicio_ajustado'|'vencida'|'criada'|'excluida'|'restaurada'|'avanco', origem: 'atividade'|'tarefa'|'pendencia'|'providencia', itemId, itemTexto, obraId, obraNome, pessoa: string|null, detalhe: string, cor: 'neutra'|'ok'|'atencao'|'atraso' }`.
- `montarLog({ eventosTarefa, eventosPendencia, eventosAtividade, tarefas, pendencias, atividades, cronogramas, hoje, obras })` → `LinhaLog[]` ordenado por `em` desc, com as linhas derivadas "vencida" (uma por item, no dia seguinte ao prazo, só se ainda estava aberto nesse dia). Detalhes com data curta: "de ter 03/11 para sex 06/11 · 2ª vez", "1 d.u. depois do fim previsto", "no prazo", "com foto".
- `agruparPorDia(linhas)` → `{ dia, rotulo: 'Quarta, 04/11', linhas }[]`.
- `vidaDoItem(origem, item, eventos, hoje)` → `{ passos: { em, rotulo, detalhe, cor }[], resumo: 'N d.u. além do prazo original · N replanejamentos · N dias aberta' }`.
- Cores: replanejada e início ajustado = atenção (âmbar); vencida = atraso (vermelho); concluída/resolvida = ok (check preto); demais neutras.
- Filtros (`filtrarLog(linhas, { obraId?, tipo?: 'replanejadas'|'atividades'|'tarefas'|'pendencias', pessoaId? })`). Com o filtro "Replanejadas" a tela mostra **por item** (cards com a vida do item), não por evento.
- Janela de carga: últimos **90 dias** de eventos, paginados por obra (uma consulta por tabela de evento com `em >= hoje - 90`), `useQueries` por obra como as demais listas. Dentro da obra, o ícone de relógio no cabeçalho abre o Log já filtrado.

### 3. Score (core `score.ts`)
Janela J (30 ou 90 dias corridos, terminando hoje). Só entram itens **concluídos ou vencidos** dentro da janela; itens abertos e ainda no prazo não contam. Mínimo **5 itens** para pontuar.

**Equipe** (por `pessoa.id`; nome digitado sem login também vira linha, pela chave `nome:`). Itens = tarefas e pendências com responsável.

| Indicador | Cálculo | Peso |
|---|---|---|
| Pontualidade | % concluídas até o **prazo original** (`prazo_original ?? prazo`; pendência: prazo por criticidade) | 35 |
| Conclusão do dia | % dos itens que venciam num dia D e foram concluídos em D (dia local) | 20 |
| Resposta ao atraso | mediana de d.u. entre vencer e concluir, só dos que atrasaram; nota = `max(0, 1 − mediana/5)` | 20 |
| Replanejamentos | média por tarefa; nota = `max(0, 1 − média/2)` | 15 |
| Pendências | % resolvidas dentro do prazo da criticidade | 10 |

**Prestadores** (por nome normalizado de `obra_atividade.prestador`: trim, minúsculas, sem acento; exibe o nome mais frequente). Itens = atividades de topo concluídas ou vencidas na janela, de obras ativas ou concluídas.

| Indicador | Cálculo | Peso |
|---|---|---|
| No fim previsto | % concluídas até `fim_previsto` do cronograma vigente | 45 |
| Atraso médio | média de d.u. de atraso (0 para as no prazo); nota = `max(0, 1 − média/5)` | 30 |
| Com foto | % concluídas com foto | 25 |

- `score = round(Σ peso × nota)`; faixas: **≥ 75 Resolutivo/Resolutiva (equipe) · Em dia (prestador)**, **50–74 Regular**, **< 50 Atenção**. Faixa em texto ao lado do número; cor: ok (turquesa escuro `#2a7f7b`, já usado em "ok" da tela inicial), regular âmbar, atenção vermelho.
- **Minha escolha:** na lista pública, a faixa "Atenção" aparece em vermelho (o usuário pediu classificação visível a todos como motivação); o detalhe de cada nome mostra os indicadores e as 3 ações que mais pesaram.
- Tendência: score 30 dias vs 90 dias → "melhorando" / "estável" / "piorando" (diferença ≥ 5 pontos).
- `calcularScoreEquipe(entrada, janela, hoje)` e `calcularScorePrestadores(entrada, janela, hoje)` → `{ linhas: { chave, nome, score|null, faixa, itens, indicadores: {...}, piores: LinhaLog[] }[] }` ordenado por score desc, sem score por último.

### 4. Telas
- **Log**: cabeçalho "Log · o que mudou e quem mudou", chips (Todas as obras, uma por obra, Replanejadas, Atividades, Tarefas, Pendências, Eu), lista por dia; linha com ícone por tipo (check, seta de replanejar, triângulo de vencida, mais para criada/atribuída), card com borda âmbar/vermelha quando for o caso. Toque abre o item (tarefa → folha; pendência → Check list nela; atividade → ficha).
- **Score**: segmentos Equipe/Prestadores e 30/90 dias; cards por nome com avatar de iniciais, nome, "você" para o próprio, dois números e o score com a faixa; "sem score ainda · mín. 5" apagado. Detalhe: seis cartões de indicador com barra, tendência e "Ações que mais pesaram".
- **Vida do item**: bloco nas três folhas/fichas, abaixo do prazo.
- Desempenho: Log e Score calculam no cliente a partir de consultas paginadas por obra (90 dias); abrir cada tela em < 1,5 s em 4G com até 10 obras ativas.

### 5. Banco
- Migration: índices por `em` nas três tabelas de evento; `salvar_tarefa` ganha `p_motivo text default null`, gravado em `depois.motivo` do evento `replanejada` quando o prazo muda (e ignorado nos outros casos). pgTAP: motivo gravado; sem motivo continua funcionando; índices existem.
- Folha da tarefa (`TarefaSheet`, modo editar) e `AvancoSheet` (Minhas ações): quando o prazo escolhido difere do atual, aparece "Motivo (opcional)" (texto curto, até 120 caracteres), enviado em `EntradaTarefa.motivoReplanejamento`.

### 6. Documentação
- PRD (§ novo "Score e Log", menu inferior), SPEC (módulos `log.ts` e `score.ts`, fórmulas e pesos, consultas), PLAN (checklist + Decisões), CLAUDE.md (layout: menu inferior com 4 itens; ativo preto).

## Escolhas minhas após a revisão de quem constrói

- **Referência de prazo da atividade** = `fim_previsto` do cronograma **vigente** (o mesmo que o app usa para marcar "atrasada"). O fim previsto de uma atividade só se move se uma predecessora atrasar ou alguém ajustar o início; o próprio atraso da atividade não o move, porque a duração é fixa. Aceito a distorção quando há `inicio_ajustado` depois do fato. Sem snapshot nem campo novo.
- **"Empurrou a fase" sai** do score do prestador (não há registro de início real da sucessora; qualquer fórmula seria chute). Pesos: no fim previsto 45 · atraso médio 30 · com foto 25.
- **Vida do item** lê `antes`/`depois` dos eventos; "atribuída" é a `criada` (tarefa) ou o `responsavel_alterado` (pendência); troca de responsável de tarefa não aparece (não há evento). O motivo do replanejamento vem de `depois.motivo` (decisão 5).
- **Responsável** = o atual do item (tarefa e pendência). Reatribuir leva o histórico junto; aceito.
- **Obras**: ativas e concluídas, para Log e Score. Itens excluídos logicamente ficam fora de tudo. Atividade com subitens usa o prazo derivado do topo. Tarefas criadas por plano de recuperação contam como qualquer tarefa.
- **Prestador** em branco fica fora; nome é o atual; sem fusão além de trim/minúsculas/acento.
- **Desempenho**: índice por `em` nas três tabelas de evento; consulta por tabela com `em >= hoje − 90`, uma por obra, cache por obra.

## O que fica para quem constrói
- Desenho do ícone `score` (barras) no padrão do `Icon.tsx`.
- Como paginar/limitar os 90 dias nas consultas e cachear por obra.
- Normalização do nome do prestador (função no core, com teste).
- Textos exatos de detalhe de cada tipo de linha (seguir o protótipo).
