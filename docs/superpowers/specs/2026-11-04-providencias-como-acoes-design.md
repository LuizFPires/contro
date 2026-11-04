# Providências como ações: "Sem responsável" e atribuição pelo gestor

Data: 04/11/2026 · Estado: aprovado pelo usuário em 04/11/2026 · Continua o desenho de `2026-11-04-acoes-do-dia-design.md` (PR #111)

## Intenção e por quê

Depois das Ações do dia, a tela Hoje mostra "4 atrasados" no CDC Fall's (lembretes de contratação vencidos) enquanto Tarefas da equipe mostra "0 atrasadas". O usuário quer (04/11/2026):

- colocar as providências atrasadas **em evidência** na mesma lista de ações;
- poder **atribuir um responsável** a cada providência, inclusive **a partir da lista Tarefas da equipe**, para o gestor distribuir o trabalho na segunda de manhã e ver a lista "Sem responsável" esvaziar;
- atribuir pede só **nome e prazo**, mas o gestor pode **editar o texto da ação**.

## Decisões do usuário (04/11/2026)

1. Providência pendente sem dono aparece em Tarefas da equipe, no grupo **"Sem responsável"**, como ação (atrasada / vence hoje / próximos dias).
2. Atribuir = escolher quem cuida (pessoa do app ou nome digitado) e o prazo; o texto da ação vem preenchido e pode ser editado.
3. Depois de atribuída, a providência sai de "Sem responsável" e passa a ser uma ação da pessoa.

## Como funciona (mecanismo existente)

O CONTRO já tem **tarefa vinculada a providência** (`tarefa.vinculo_tipo = 'providencia'`, `vinculo_id`): concluir a tarefa marca a providência como providenciada; reabrir desfaz. A ata da reunião usa isso. **Atribuir responsável a uma providência é criar essa tarefa vinculada.** Nenhum campo novo em `obra_providencia` (regra 4 do CLAUDE.md: lembrete não ganha cadastro).

## Objetivos

- Providência pendente **sem tarefa vinculada aberta** vira uma `Acao` de origem `'providencia'`, sem responsável, com `prazo = providenciarAte(inicio, es, antecedência)` (já no core), texto `"<Tipo>: <descrição>"` ("Contratação: Pinturas") e detalhe com obra e atividade.
- Em Tarefas da equipe, o chip **"Sem responsável"** lista essas providências junto com tarefas/pendências sem dono, nas quatro seções.
- Tocar numa providência sem dono abre a folha de tarefa (a mesma `TarefaSheet`) em modo **Atribuir**: obra fixa, texto preenchido e editável, responsável obrigatório, prazo preenchido com a data de providenciar. Salvar cria a tarefa vinculada (com Desfazer = excluir a tarefa). A pessoa recebe o push "Tarefa atribuída" que já existe.
- A providência com tarefa vinculada aberta **não** aparece em "Sem responsável": ela está representada pela tarefa no chip da pessoa (texto, prazo e conclusão vêm da tarefa).
- A tela inicial ("Ações da equipe", lista Hoje) e Minhas ações continuam coerentes: Hoje já lista providências; o bloco "Ações da equipe" passa a contar as providências sem dono; Minhas ações não muda (só ações com `responsavelId`).

## Não objetivos

- Não cria responsável em `obra_providencia` nem valor/fornecedor (regra 4).
- Não muda a aba Providências da obra, a não ser mostrar "Quem cuida: Nome" quando houver tarefa vinculada aberta (**minha escolha**, só leitura).
- Não muda a ata, o Check list, o boletim (o "Quem faz o quê" já lista a tarefa vinculada pela pessoa).
- Não reabre a regra "não existe atividade bloqueada".

## Anti-objetivos

- A mesma providência aparecer duas vezes (sem dono e como tarefa da pessoa).
- A lista "Sem responsável" misturar providência de obra pausada/concluída.
- Atribuir exigir mais toques do que escolher a pessoa e confirmar.

## O push do gestor ("Equipe hoje") e as providências

O prazo da providência depende do cronograma (`es` da atividade), que hoje é calculado **só no cliente** (core `schedule.ts`); o SQL de `gerar_avisos` não sabe calcular. Para o push do gestor não divergir da tela:

**Minha escolha:** persistir a data calculada. `obra_providencia` ganha a coluna `providenciar_ate date` (derivada, não editável), e o app grava via RPC `atualizar_prazos_providencias(p_obra_id, p_prazos jsonb)` sempre que `listarObras` recalcula o cronograma (idempotente; só escreve se mudou). `gerar_avisos` conta, no total da equipe e no grupo "Sem responsável", as providências pendentes sem tarefa vinculada aberta com `providenciar_ate < hoje` (atrasadas) ou `= hoje`. Fica registrado no SPEC que o valor pode estar defasado até alguém abrir o app depois de mudar o cronograma; o gestor abre o app todo dia.

Alternativa rejeitada: push ignorar providências (voltaria a divergência que motivou este pedido).

## Como fica

### 1. Core (`packages/core/src/acoes.ts`)
- `OrigemAcao` ganha `'providencia'`. Helper `providenciaParaAcaoBase({ id, obraId, tipo, descricao, prazo })` → `Acao` com `aberta: true`, `responsavelId: null`, `responsavelNome: null`, `texto: "${rótulo do tipo}: ${descricao}"` (Contratação/Locação/Compra). Testes.
- `classificarAcoes`, `resumoEquipeDia`, `textoAvisoEquipe` já tratam `sem`.

### 2. Dados (web)
- `listarObras` (`api.ts`) já calcula `providenciarAte` por providência para a agenda; passa a expor em `ObraResumo` a lista `providenciasSemDono: { id, obraId, tipo, descricao, prazo, atividadeNome }[]` (pendentes, atividade não concluída, sem tarefa vinculada aberta) e a usar nos contadores `acoesAbertas/acoesAtrasadas/acoesHoje`.
- `useAcoesDasObras` recebe também essas providências (de `useObras()`), convertidas por `providenciaParaAcao` em `AcaoObra` com `origem: 'providencia'` e o objeto original.
- A tarefa vinculada aberta é identificada por `tarefa.vinculo_tipo === 'providencia' && vinculo_id === providencia.id && status === 'aberta'` (as tarefas já estão carregadas em `listarObras`).
- Gravação do prazo: `atualizar_prazos_providencias` chamada em `listarObras` após o cálculo (fire-and-forget, sem bloquear a tela; offline, ignora).

### 3. Tarefas da equipe
- Card de providência: mesmo `CardAcao`, sem check; detalhe `obra · atividade · "providenciar até <data>"`; estado por seção como os demais. `aria-label` "…: atribuir responsável".
- Toque → `TarefaSheet` em modo **Atribuir** (título "Atribuir providência"), com `texto` preenchido, `obra` fixa, `prazo = providenciar até`, `vinculo_tipo = 'providencia'`, `vinculo_id`, `origem_texto = "Providência da obra"`. Botão "Atribuir". Salvar → `salvar_tarefa` existente; toast "Providência atribuída a <nome>" com Desfazer (exclui a tarefa).
- Depois de salvar, a providência some de "Sem responsável" e a tarefa aparece no chip da pessoa (otimista: patch em `['tarefas', obraId]` e invalidação de `['obras']`).
- Chip "Sem responsável" mostra o badge vermelho com atrasadas, como os demais.

### 4. Tela inicial
- "Ações da equipe": `abertas/atrasadas/vencem hoje` incluem as providências sem dono. A lista Hoje não muda (já lista providências com o rótulo do tipo).

### 5. Banco (`supabase/migrations/20261104200000_providencia_prazo.sql`)
- `alter table obra_providencia add column providenciar_ate date;`
- RPC `atualizar_prazos_providencias(p_obra_id uuid, p_prazos jsonb)` (security definer, membro da instalação via `contro_e_membro()`; `jsonb` = `[{id, ate}]`; atualiza só quando diferente).
- `gerar_avisos`: CTE `acoes` ganha `union all` das providências pendentes sem tarefa vinculada aberta, com `prazo = providenciar_ate` (ignora as com `providenciar_ate null`), chave `'sem'`.
- pgTAP: RPC só para membro; cenário com providência atrasada entra no total do gestor e não ocupa vaga de nome.

### 6. Documentação
- PRD §5.6 e §5.11, SPEC (coluna derivada, RPC, `gerar_avisos`), PLAN (checklist + Decisões).

## Escolhas minhas após a revisão de quem constrói

- **Lista Hoje sem duplicar.** A providência sem dono continua na agenda só como item de providência (rótulo Contratação/Locação/Compra), não entra em `agenda.acoes`. Os contadores "Ações da equipe" somam `providenciasSemDono` à parte. Depois de atribuída, a agenda **esconde** o item de providência que tem tarefa vinculada aberta (a tarefa, com a pessoa, já representa o item): `agendaDoDia` recebe `providencias` já filtradas pelo cliente.
- **Push "Providências" existente** (vem desligado, "Confira o que contratar…") fica como está; quem ligar os dois recebe os dois. Não funde.
- **`providenciar_ate` nasce nula** nas providências existentes e vai sendo preenchida conforme o app recalcula (sem backfill: o cronograma só existe no cliente). `gerar_avisos` ignora as nulas e filtra obra ativa, atividade não concluída e não excluída, como o cliente. A defasagem fica documentada no SPEC. A RPC se justifica por gravar em lote e só quando muda.
- **Estado da providência** = `estadoAcao` sobre `providenciarAte` (`prazo < hoje` atrasada, `= hoje` vence hoje). A janela "começar até prazo" da agenda Hoje não muda.

## O que fica para quem constrói
- Como `TarefaSheet` recebe o modo Atribuir (prop `modo: 'atribuir'`) sem quebrar os usos atuais.
- Onde chamar a RPC de prazos sem duplicar escrita quando várias telas recalculam.
- Textos das fixtures e dos testes.
