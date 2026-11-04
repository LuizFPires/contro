# Atividades como ações: "Sem responsável" e atribuição pelo gestor

Data: 04/11/2026 · Estado: aprovado pelo usuário em 04/11/2026 · Continua `2026-11-04-providencias-como-acoes-design.md` (PR #113)

## Intenção e por quê

A tela Hoje mostra atividades atrasadas (ex.: 2 no CDC Paquetá), mas Tarefas da equipe não as lista: o desenho das Ações do dia deixou atividades de fora por não terem responsável. O usuário quer (04/11/2026) que **qualquer atividade atrasada, mesmo sem responsável, vá para Tarefas**, para o gestor vincular alguém. Aprovou também incluir as de hoje e as dos próximos 5 dias.

## Decisões do usuário (04/11/2026)
1. Atividade sem tarefa vinculada aberta entra em Tarefas da equipe no chip "Sem responsável": atrasada, vence hoje e próximos 5 dias.
2. Atribuir = quem cuida + prazo (pré-preenchido com o fim previsto) + texto editável; cria a **tarefa vinculada à atividade** (mecanismo existente: concluir a tarefa abre a câmera e conclui a atividade).
3. Depois de atribuída, a atividade sai de "Sem responsável" e vira ação da pessoa; Desfazer devolve.

## Como funciona (mesmo molde das providências)
- **Atividade sem dono** = `obra_atividade` de topo (`pai_id null`), não concluída, não excluída, de fase **não preliminar**, de obra ativa, com `fim_previsto` no cronograma, e **sem tarefa aberta** com `vinculo_tipo='atividade'` e `vinculo_id = atividade.id`. Texto da ação: `"Atividade: <nome>"`; detalhe: obra · fase · prestador (quando houver) · "fim previsto <data>". Prazo = `fim_previsto` do cronograma vigente (o mesmo que marca "atrasada").
- `Acao.origem` ganha `'atividade'`; `AcaoObra` ganha a variante `{ origem: 'atividade'; atividade: AtividadeSemDono }`.
- Tarefas da equipe: card sem check; toque abre `TarefaSheet` modo atribuir com `vinculoTipo:'atividade'`, `vinculoId`, `origemTexto:'Atividade da obra'`, prazo = fim previsto; toast "Atividade atribuída a <nome>" com Desfazer. `useAcoesDasObras` esconde a atividade assim que existe tarefa vinculada aberta no cache otimista (como `semTarefaAberta`).
- Ficha da atividade mostra "Quem cuida: <nome> · até <data>" quando há tarefa vinculada aberta.
- Tela inicial: "Ações da equipe" conta as atividades sem dono; a lista Hoje **esconde** o item de atividade ("Concluir"/"Em andamento") quando ela tem tarefa vinculada aberta (a tarefa, com a pessoa, já aparece). Sem duplicata.
- Push do gestor ("Equipe hoje"): conta atividades sem dono atrasadas/de hoje. Como o cronograma só existe no cliente, `obra_atividade` ganha a coluna derivada `fim_previsto_calc date`, gravada pela RPC `atualizar_prazos_atividades(p_obra_id, p_prazos jsonb [{id, ate}])` quando `listarObras` recalcula (só o que mudou; fire-and-forget), e `gerar_avisos` soma na CTE `acoes` as atividades sem dono com `fim_previsto_calc` não nulo (grupo "Sem responsável"). Defasagem documentada como nas providências.
- Minhas ações não muda (atividade sem dono nunca tem `responsavelId`).

## Não objetivos
- Subitens não viram ação (o prazo é do topo). Pré-obra (Orçamento, Mapa) fora.
- Não cria responsável em `obra_atividade`; "prestador" continua texto informativo.
- Boletim e ata não mudam.

## Anti-objetivos
- A mesma atividade duas vezes (sem dono e como tarefa da pessoa), em Tarefas ou em Hoje.
- Atividade de obra pausada/concluída na lista.

## Escolhas minhas
- Atividade em andamento e no prazo entra em "Próximos 5 dias" quando o fim previsto cai na janela (recomendação aceita).
- Subitens: a atividade-mãe é a ação; concluir a tarefa vinculada conclui a mãe (e os subitens abertos, regra 3), como hoje.
- "Quem cuida" na ficha é só leitura.
