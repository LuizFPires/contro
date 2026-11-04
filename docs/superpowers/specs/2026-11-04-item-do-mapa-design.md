# Adicionar item do Mapa de coleta

Data: 04/11/2026 · Estado: aprovado pelo usuário em 04/11/2026

## Intenção e por quê
O botão "Adicionar atividade" existe nas seis fases da obra, mas é escondido nas duas fases do pré-obra. O usuário quer (04/11/2026) poder **adicionar itens na fase Mapa de coleta** direto na obra.

## Como um item do mapa funciona hoje (fonte: `core/preObra.ts`, `obra_mapa_libera`, `obra_atividade.mapa_antecedencia_du`)
Um item do mapa é uma `obra_atividade` da fase preliminar "Mapa de coleta" com `mapa_antecedencia_du` (antecedência da contratação) e uma ou mais atividades da obra que ele **libera** (`obra_mapa_libera`). O prazo dele é derivado: fecha até (início previsto da mais cedo das atividades que libera) − antecedência; começa (duração) dias úteis antes disso. Conclusão é só check (sem foto, sem avanço parcial).

## Decisões do usuário
1. Botão na fase Mapa de coleta para adicionar itens.

## Como fica
- Na trilha da obra, a fase **Mapa de coleta** mostra o botão **"Adicionar item do mapa"** (mesmo visual de "Adicionar atividade"). A fase Orçamento continua sem botão.
- Folha **"Novo item do mapa"**: nome (com sugestões dos nomes já usados em mapas, `sugestao` tipo `mapa`), duração em dias úteis (padrão 5, − / +), antecedência da contratação em dias úteis (padrão 10, − / +), e **"Libera as atividades"**: lista das atividades de topo da obra (não concluídas, de fases não preliminares) com busca por nome ou #N e seleção múltipla (reaproveita o padrão do `AtividadePicker`). Pelo menos uma atividade é obrigatória.
- Salvar: RPC nova `adicionar_mapa_obra(p_obra_id, p_nome, p_duracao_du, p_antecedencia_du, p_libera uuid[], p_id)` (security definer, membro; valida fase preliminar "Mapa de coleta", alvos da mesma obra, de topo, não preliminares; insere a atividade com `mapa_antecedencia_du` e as linhas de `obra_mapa_libera`; evento `criada`; idempotente por `p_id`). Otimista e offline pela fila (`client_op_id`), como `adicionar_atividade_obra`.
- Toast "Item do mapa adicionado" com Desfazer (`excluir_atividade_obra`, que já existe).
- O prazo aparece na hora: o cliente recalcula o pré-obra com `cronogramaPreObra` já com o item novo (otimista).
- Editar depois: pela ficha do item, como as atividades (nome, duração; antecedência e alvos ficam para um PR seguinte, salvo se for barato: campo na ficha).

## Não objetivos
- Não muda o modelo de obra (o item nasce só na obra; regra 6).
- Não cria item no Orçamento.
- Não muda a regra de prazo do mapa.

## O que fica para quem constrói
- Nome do tipo de sugestão e onde fica o botão no componente da fase.
- Como validar "pelo menos uma atividade" na folha.
