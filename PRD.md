# PRD — CONTRO · obras da contorno

Versão 1.1 · 24/10/2026 · base: protótipo navegável "Obras CDC — protótipo" (app de campo + modelos de obra no celular)

---

## 1. Visão

O **CONTRO** é o app de planejamento rápido e acompanhamento rápido das obras de reforma das unidades **Contorno do Corpo**.

As obras são muito parecidas: mesma sequência, mesmo escopo e os mesmos encadeamentos. Por isso cada nova obra nasce no primeiro dia com o cronograma pronto, puxado de um **modelo de obra** escolhido entre os modelos salvos pelo gestor (ex.: "Modelo 1 · CDC completo", "Modelo 2 · CDC sem vestiários"), com atividades, prazos médios, conexões e lembretes de providência.

A partir daí o app conduz a obra como um **jogo de fases**. A equipe avança de fase conforme conclui atividades (com foto sempre que possível), resolve pendências arrastando cards e se organiza toda semana por um **boletim** e por uma **reunião com ata** gerada pelo próprio app.

Frase-guia: *planejar em um minuto, acompanhar em um olhar, provar com foto.*

## 2. Problema

- O cronograma de cada unidade é refeito à mão, embora as obras se repitam quase idênticas.
- O que precisa estar na obra antes de cada atividade (contratar, alugar, comprar) é lembrado tarde e trava a sequência.
- Pendências de qualidade se perdem em fotos soltas no celular e em conversas de WhatsApp, sem prova de antes e depois.
- A reunião semanal não tem pauta padronizada nem registro de quem ficou de fazer o quê. As providências somem até a semana seguinte.
- O grupo de WhatsApp da obra recebe informação dispersa, sem um resumo da semana.

## 3. Objetivos e métricas de sucesso

| Objetivo | Métrica | Meta no piloto |
|---|---|---|
| Planejar rápido | Tempo para criar uma obra a partir do modelo | < 2 minutos |
| Liberar a sequência sem travas | Atividades que começam atrasadas por falta de providência | redução de 50% em relação à linha de base |
| Prova de execução | Atividades concluídas com foto (a foto é opcional; as sem foto ficam marcadas e podem recebê-la depois) | ≥ 90% |
| Pendências fechadas com evidência | Pendências fechadas com antes e depois vistoriado | 100% |
| Reunião produtiva | Providências da semana anterior cumpridas no prazo | ≥ 70% |
| Comunicação semanal | Boletins enviados por obra por semana | 1 por obra (segunda) |
| Adoção | Engenheiros que usam o app ao menos 4 dias por semana | ≥ 80% |

## 4. Usuários e perfis

São **dois perfis de acesso** apenas:

| Perfil | Quem é | O que faz no CONTRO |
|---|---|---|
| **Gestor** | Diretoria e gestão de obras | **Tudo**: vê todas as obras, conduz a reunião e aprova a ata, e é o único que **cria, edita, duplica e exclui modelos de obra** |
| **Equipe de obra** | Engenheiro, mestre/encarregado, compras e demais da obra | O app do dia a dia, **tudo menos editar modelos**: cria obra escolhendo um modelo, conclui atividades (com ou sem foto), aponta, resolve e vistoria pendências, marca lembretes, dá baixa e replaneja tarefas |

A função de cada pessoa (engenheiro, mestre, compras) é só um rótulo (`papel_texto`) para atribuições e relatórios; não muda o acesso.

Regra de vistoria: quem vistoria a pendência (aprova o antes e depois) **não pode ser** quem enviou a foto de depois.

## 5. Escopo da versão 1

### 5.1 Carteira (tela inicial)
- Título "Minhas obras" com **ícone "+"** discreto para criar obra a partir do modelo.
- Atalhos **Reunião** (próxima reunião e status da pauta) e **Tarefas** (abertas e atrasadas da equipe).
- Card por obra: nome, fase atual, % real, barra de 6 segmentos (uma por fase), etiqueta de ritmo, data de entrega e aviso em vermelho de atividades e lembretes atrasados.
- Não há cards de XP nem de contadores gerais na tela inicial (decisão do usuário: o foco é a obra).

### 5.2 Nova obra a partir de um modelo
- Informa a unidade, a segunda-feira de início e **escolhe o modelo a seguir** (lista com nome, subtítulo, atividades e dias úteis de cada modelo salvo).
- Mostra a prévia: número de atividades, número de lembretes, dias úteis, fases com datas e entrega prevista.
- Ao confirmar, gera a obra com cópia **independente** do modelo escolhido, como ele está naquele momento: atividades, prazos, conexões e lembretes. A obra pode ser editada sem alterar o modelo.

### 5.3 Obra · cabeçalho
- Nome, "Dia N de M do modelo", % real, barra de avanço e **ícone discreto de Boletim da semana** à direita.
- Ritmo, fase e entrega **não** ficam em chips no cabeçalho (decisão do usuário).

### 5.4 Obra · Fases (mapa do jogo)
- Trilha vertical com as 6 fases: Mobilização, Infraestrutura, Fechamentos, Acabamentos, Instalações finais e Entrega.
- Estados de fase: concluída, em execução, planejada e com atraso (vermelho).
- Ao expandir uma fase, as atividades aparecem com estado (concluída, liberada, aguardando providência, planejada ou atrasada), o prestador (quando informado) e um botão de câmera para **concluir** quando liberada (com foto ou, na própria câmera, "Concluir sem foto"). Concluída sem foto aparece como "Concluída · sem foto".
- Tocar na atividade abre a **ficha da atividade** (5.5).
- Ao concluir a última atividade de uma fase: **celebração** de fase concluída com a lista do que foi liberado.
- No fim da trilha, **tarja preta da Inauguração** com a data por extenso, os dias úteis restantes e, se houver atraso, quanto o ritmo atual atrasa.

### 5.5 Ficha da atividade
- Situação, datas previstas e duração.
- **Subitens** (quando a atividade tem): checklist com o prazo de cada um.
  - Marcar um subitem não exige foto (é opcional).
  - A atividade só pode ser concluída depois de todos os subitens marcados (com ou sem foto).
- **Ajustar início (manual):** empurra a atividade para uma data posterior, por exemplo por feriado, chuva ou liberação do shopping.
  - As sucessoras se deslocam junto.
  - O ajuste fica registrado na atividade: "início ajustado manualmente de dd/mm para dd/mm".
- **Prestador da atividade:** campo de texto opcional com o nome de quem executa. Não tem valor nem vínculo com compras.
- Lista **"Para começar"**: os lembretes da atividade, com o botão "+ Contratação / + Locação / + Compra".
- Depende de / Libera.
- Botões "Concluir com foto" e "Concluir sem foto" quando liberada; concluída sem foto, "Anexar foto"; caso contrário, o motivo do bloqueio.

### 5.6 Providências (lembretes de contratação, locação e compra)
- Cada lembrete tem só: **tipo**, **o que providenciar**, **data em que precisa estar na obra** (padrão: início da atividade, editável) e **situação** (A providenciar ou Providenciado).
- **Não tem valor nem fornecedor.** Isso fica em outro sistema (decisão do usuário).
- "Providenciar até" = início da atividade menos a antecedência do modelo, em dias úteis.
- Aba **Providências** da obra agrupada em Atrasados (vermelho) e A providenciar, com o botão "Marcar como providenciado".
- A atividade só é liberada quando as predecessoras estão concluídas **e** todos os seus lembretes estão providenciados.

### 5.7 Pendências (qualidade)
- Alternância **Fila | Lista completa**, com as contagens.
- **Fila:** pilha de cards com a foto do antes, criticidade, local, atividade e quem apontou.
  - Arrastar para a direita, ou o botão "Resolvida", abre a câmera com a **foto do antes em transparência** (ghost) para alinhar a foto de depois. A pendência vai para "Em vistoria".
  - Arrastar para a esquerda, ou o botão "Adiar", pede **data de retorno** e **motivo** (aguardando material, aguardando outra equipe, local sem acesso ou outro). A pendência sai da fila e volta sozinha na data escolhida. O aviso traz "Desfazer".
- **Lista completa:** Na fila (com "Resolver agora"), Adiadas (data de volta, motivo e "Trazer para a fila"), Em vistoria ("Vistoriar") e Concluídas.
- **Apontar:** ícone de câmera; foto primeiro, descrição depois.
- **Vistoria:** antes e depois lado a lado, com "Aprovar e fechar" ou "Reabrir".

### 5.8 Cronograma
- Gantt simplificado por fase, com a linha de hoje. Cores: concluída (turquesa), liberada (preto), atrasada (vermelho) e planejada (cinza).
- Tocar na linha mostra situação, prestador, lembretes (n de m providenciados), depende de e libera.

### 5.9 Boletim da semana
- Um por obra, gerado toda segunda às 7h, com edição de fechamento na sexta.
- Conteúdo:
  - avanço real, % previsto até sexta, ritmo e número de atrasos;
  - bloco **Atenção** em vermelho;
  - **Quem faz o quê nesta semana** (atribuições por pessoa, com data, origem e situação);
  - o que concluir e o que começar na semana;
  - o que providenciar;
  - fases e qualidade;
  - campo em branco de encaminhamentos.
- **Envio sem integração:** o botão "WhatsApp" abre o WhatsApp (`wa.me/?text=`) com o texto pronto, e o usuário escolhe o grupo da obra.
- **PDF** A4 bem formatado no padrão CONTRO, para levar à reunião.

### 5.10 Reunião semanal (segunda, 16h)
- **Pauta guiada** (opção A do protótipo de reunião): escolhe-se a obra no topo e passa-se por **4 etapas**, com "Continuar" e "Voltar" no rodapé. O cabeçalho é baixo e o rodapé só tem os botões.
  1. **Semana passada:** cada atividade prevista recebe **Feito** ou **Não feito**.
     - **Feito** numa atividade liberada conclui na hora, sem foto (com Desfazer); já concluída aparece como "Concluída no app".
     - **Não feito** abre uma tela por cima da pauta: a atividade aparece **atrasada**, com o **impacto no cronograma só simulado** (nova conclusão e nova inauguração, sem alterar nada; para mudar de verdade usa-se "Ajustar prazo") e a **providência para recuperar**: o que fazer, responsável, data da providência e observação livre.
  2. **Esta semana:** cada item a concluir, começar ou providenciar recebe **Segue o plano** ou **Providência** (mesma tela de providência). Lembrete vencido aparece em vermelho.
  3. **Providências:** as da **reunião anterior** recebem **Feita** (com Desfazer) ou **Não feita**, que abre "Remarcar providência" (novo responsável, data e observação; conta como replanejamento). As **criadas nesta reunião** aparecem com a origem e "Editar"; "+ Nova providência" cria uma solta.
  4. **Observações:** texto livre da obra e um resumo antes de fechar (feitos, não feitos, anteriores em aberto e providências novas por pessoa).
- **Responsável** é escolhido entre as pessoas do app ou digitado ("+ Outro nome"); o nome digitado vira sugestão. **Data** em atalhos (próximos 5 dias úteis) ou "Outra data".
- Toda providência vira **tarefa** do responsável. Na reunião seguinte ela volta em "Providências da reunião anterior"; se a data cai na semana seguinte, o aviso já diz isso.
- **Gerar ata** (gestor, na última obra): documento obra a obra com seções em faixa cinza (Semana passada com ✓/✕ e a providência de recuperação, Esta semana, Providências da reunião anterior com ✓ feita ou relógio vermelho de atraso, Novas providências, Observações) e **Quem faz o quê** por responsável, com WhatsApp e PDF. Sem os cards de contagem no topo.

### 5.11 Tarefas (providências da equipe)
- Filtro por pessoa, com o número de atrasadas em cada uma. Na v1 começa com **nomes fictícios**; não há cadastro prévio obrigatório.
- **Cadastro pelo uso:** ao digitar um responsável ou um prestador novo, o nome é salvo e passa a ser **sugerido** nos próximos lançamentos (autocompletar). Os nomes podem ser editados ou unificados depois.
- Grupos: Atrasadas, Abertas e Concluídas.
- **Concluir** em um toque, com "Desfazer". O vínculo produz efeito na obra:
  - **Lembrete:** marca como providenciado e pode liberar a atividade.
  - **Atividade:** abre a câmera de conclusão.
- **Reabrir** qualquer tarefa concluída. Se ela tinha marcado um lembrete como providenciado, o lembrete volta para "a providenciar".
- **Editar tudo:** texto, responsável, prazo (atalhos ou qualquer data dd/mm), situação, e excluir (com "Desfazer").
- **Replanejamento rastreado:** mudar o prazo de uma tarefa aberta conta como replanejamento (contador e prazo original). Isso aparece na lista e na ata, para o replanejamento não esconder o atraso.

### 5.12 Modelos de obra (gestor, mobile first)
- **Vários modelos salvos**, cada um com **nome** e **subtítulo** editáveis (ex.: "Modelo 1 · CDC completo · reforma pesada", "Modelo 2 · CDC sem vestiários", "Modelo 3 · Retrofit leve").
- Lista de modelos com dias úteis, atividades e quantas obras já usaram cada um. Criar modelo: **cópia de um existente** ou **em branco** (só as fases). Também "Duplicar como novo modelo" dentro do modelo. Excluir modelo pede confirmação e tem "Desfazer"; precisa restar ao menos um.
- **Sem versões e sem "publicar":** alterações são salvas no modelo na hora. Obras já iniciadas nunca mudam.
- **Lançar atividade no celular** em assistente de 5 passos, uma pergunta por tela: (1) nome, com sugestões já usadas que preenchem prazo e lembretes; (2) dias úteis, com − / + grandes, atalhos 1–10 e "Dividir em subitens"; (3) **começa depois de quê**, com abas por fase e busca em todas as fases; (4) providências (contratação, locação, compra; pode pular); (5) revisão com prévia D início–D fim e folga/caminho crítico. Editar abre direto na revisão, com "Alterar" por item.
- **Fases editáveis:** renomear (clique no nome), criar fase nova e excluir fase. A exclusão pede confirmação, mostrando quantas atividades saem junto, e tem "Desfazer".
- **Atividades:** incluir em qualquer fase, renomear e remover (com "Desfazer").
- **Subitens:** qualquer atividade pode ficar como está ou receber subitens. Exemplo: Demolições e retiradas → demolição de alvenaria, de forro e de piso.
  - Cada subitem tem nome, prazo e modo: **em sequência** (depois do anterior) ou **em paralelo** (no início da atividade).
  - Com subitens, o prazo da atividade passa a ser **calculado** pelo vão dos subitens.
- Tabela por fase: nome, prazo médio (− / +, ou calculado pelos subitens), predecessoras e **providências padrão** (tipo, descrição e antecedência).
- Gantt com o caminho crítico em turquesa. Ao selecionar uma atividade, as predecessoras aparecem em preto e as sucessoras em preto hachurado.
- Incluir e remover atividades; ligar e desligar predecessoras de **qualquer fase** (anterior ou posterior), desde que não forme ciclo: a lista esconde quem já depende da atividade; incluir e remover providências padrão.
- Versão desktop (tabela + Gantt) é complementar; o fluxo principal é o celular.

### 5.13 Gamificação
- Mapa de fases, celebração de fase concluída e conquistas da obra (por exemplo "Canteiro em 2 dias", "Foto em 100% das etapas").
- **XP da equipe** registrado (concluir atividade, resolver pendência, vistoriar, concluir tarefa), mas **sem card de XP na tela inicial**.
- Sem ranking entre pessoas: a comparação é sempre com o modelo.

## 6. Fora de escopo da v1

- **Maquete 3D da obra**: é uma melhoria futura, fora do plano principal (ver §11).

- Valor, orçamento e fornecedor de contratações, locações e compras (outro sistema).
- API oficial do WhatsApp (Cloud API / Groups API) e gateways não oficiais. A v1 usa o link `wa.me`.
- Instagram.
- Custos, medições financeiras e notas fiscais.
- Integração com o WARBRA ou o ioo. Previsto como conector futuro (v2).
- Apontamento de % parcial livre. Na v1, a atividade sem subitens é binária (conclui com ou sem foto); com subitens, o avanço parcial vem dos subitens marcados.
- Calendário de feriados (decisão: ajuste manual).

## 7. Regras de negócio (resumo; detalhe no SPEC)

1. Toda obra é cópia do **modelo escolhido** ao criá-la. Editar a obra não altera o modelo, e editar o modelo não altera obras já criadas. Só o perfil **Gestor** edita modelos.
2. Cronograma em **dias úteis de segunda a sexta, sem cadastro de feriados**. Feriado ou imprevisto se resolve com **ajuste manual** da data de início da atividade, e as sucessoras acompanham.
3. Atividade **liberada** = predecessoras concluídas **e** lembretes providenciados.
4. Atividade é **concluída com ou sem foto**; sem foto fica marcada e pode receber a foto depois.
5. Atividade **atrasada** = não concluída e término previsto já passou.
6. Lembrete **atrasado** = não providenciado e "providenciar até" já passou.
7. Pendência só fecha com **foto de depois aprovada por outra pessoa**.
8. Pendência adiada sai da fila e volta sozinha na data escolhida.
9. Tarefa tem responsável e prazo; mudar o prazo de tarefa aberta conta como replanejamento.
10. Vermelho só para atraso real; todo o resto usa turquesa, preto e branco.

## 8. Requisitos não funcionais

- **Mobile first** (PWA instalável em iPhone e Android), inclusive a edição de modelos pelo gestor; a visão desktop do modelo (tabela + Gantt) é complementar.
- **Offline em campo:** concluir atividade, apontar e resolver pendência, marcar lembrete e concluir tarefa funcionam sem sinal e sincronizam depois.
- **Performance:**
  - toda ação de toque responde visualmente em < 100 ms (UI otimista);
  - carregamento da obra < 1,5 s em 4G;
  - nenhuma ação do usuário espera o servidor para dar feedback.
  - Lição do sistema "Obra": evitar segundos de espera a cada clique.
- **Fotos:** compressão no aparelho (lado maior até 1600 px, JPEG ~0,75), com data, hora e autor; envio em segundo plano.
- **Auditoria:** quem fez o quê e quando em atividades, lembretes, pendências e tarefas. Nada é apagado de fato (exclusão lógica).
- **Acessibilidade:** contraste AA, alvos ≥ 44 px e estados com texto e ícone, não só cor.
- **Idioma e formatos:** pt-BR; datas "qua 21/10"; valores (se um dia aparecerem) no padrão brasileiro 1.234,56.

## 9. Design

- Design system **CONTRO**: turquesa #54B4B0, preto #181818, branco e opacidades dessas três cores; Nunito Sans.
- **Exceção aprovada:** vermelho #C62828 **somente** para atraso (atividades, lembretes, providências vencidas, ritmo atrasado).
- Botão primário turquesa com texto preto; secundário preto com texto branco.
- Marca "CONTRO" sempre em maiúsculas. O símbolo definitivo é o vetor aprovado que está na pasta do projeto CONTRO.

## 10. Questões em aberto

| # | Questão | Proposta |
|---|---|---|
| Q1 | ~~Feriados~~ | **Decidido:** sem feriados no sistema; ajuste manual da data pelo usuário |
| Q2 | Peso do % de avanço | v1: peso pela duração do modelo. Avaliar peso por custo-padrão da unidade ou % parcial (25/50/75) com foto |
| Q3 | ~~Equipe real~~ | **Decidido:** começa com nomes fictícios; nomes digitados viram sugestões e o cadastro se forma com o uso |
| Q4 | Prestador da atividade | Mantido como campo opcional; confirmar se fica |
| Q5 | ~~Vetor do símbolo~~ | **Resolvido:** o vetor aprovado está na pasta do projeto CONTRO |
| Q6 | Prazos médios reais | Substituir os 28 prazos do protótipo pelo histórico das obras CDC antes do piloto |
| Q7 | Quem pode editar o cronograma de uma obra | Gestor e equipe de obra (só a edição de **modelos** é exclusiva do gestor) |
| Q8 | ~~Versões do modelo~~ | **Decidido:** sem versões nem publicação; vários modelos salvos com nome e subtítulo, escolhidos na criação da obra |
| Q9 | ~~Perfis~~ | **Decidido:** só dois perfis, Gestor (tudo) e Equipe de obra (tudo menos editar modelos) |

## 11. Melhorias futuras (fora do plano principal)

Ideias aprovadas como direção, mas que **não entram no desenvolvimento da v1**. Cada uma só começa depois de um estudo de viabilidade aprovado pelo usuário.

### E1 · Maquete 3D da obra
- Cada obra tem uma **maquete 3D da unidade Contorno do Corpo**, aberta pelo ícone de cubo no cabeçalho da obra e pelo card "Maquete 3D" na trilha de fases.
- **Começa cinza:** terreno, casca existente e pilares sólidos em cinza; tudo o que ainda será feito aparece como **peça prevista**, cinza translúcida com contorno tracejado.
- **Cada atividade é uma peça.** Ao concluir com foto, a peça cresce na maquete com animação e ganha cor e material reais: demolição faz as paredes antigas sumirem, contrapiso vira vinílico amadeirado, borracha preta e pista vermelha, fachada ganha a moldura turquesa e o letreiro, os LEDs acendem etc. Peças com etapas mudam de aparência a cada etapa (alvenaria → massa → pintura).
- A câmera vai até a peça recém-montada; +50 XP por peça e +200 XP por fase completa, com celebração. Na entrega, a maquete entra em **modo noite com as luzes acesas** ("Unidade inaugurada").
- Toque numa peça: mostra a atividade, a fase, o status (executada, liberada ou aguardando quem) e a quantidade vinda do executivo; se liberada, "Concluir com foto" direto dali.
- **Linha do tempo:** um controle desliza de "Terreno" a "Inauguração" para ver a unidade evoluindo (prévia; não altera dados). "Voltar para hoje" retorna ao real.
- Vista "Completa" ou "Só térreo" (esconde mezanino, forro e instalações altas), girar automático e recentrar. Gestos: arrastar gira, pinça aproxima.
- **Planta base:** a maquete nasce de um **modelo padrão** construído a partir do projeto executivo CDC (layout, demolição/construção, paginação de piso, forro, mapa de pintura, eixos, luminotécnica, detalhes e fachada). O gestor pode **enviar o PDF do executivo** de uma unidade: o sistema lê as pranchas, propõe ambientes, materiais e quantidades e liga cada elemento a uma atividade; o gestor **confere antes de liberar**.

**Antes de decidir, o estudo precisa responder:**
- **Precisa de IA?** A maquete em si (desenho 3D, animação, cores) roda no celular e não usa IA. IA só entraria na **leitura do PDF do executivo** para montar a maquete de cada unidade.
- **Alternativa sem IA:** uma maquete padrão por modelo de obra (CDC completo, sem vestiários, retrofit leve), montada uma vez e reaproveitada em todas as obras daquele modelo. Custo recorrente zero; perde a fidelidade à planta de cada unidade.
- **Custo com IA:** custo por PDF importado (número de pranchas, resolução e quantas chamadas de visão), custo de armazenamento e tempo de conferência do gestor por unidade.
- **Custo de desenvolvimento:** esforço do editor de peças, da biblioteca de materiais e do motor 3D; impacto no tamanho do app e no desempenho em celulares mais simples.
- **Fonte melhor que PDF:** verificar se os projetistas (ex.: MEP Obras Especiais) entregam DWG ou IFC, que dispensam boa parte da leitura por IA.
- **Valor:** medir no piloto se a maquete aumenta a adesão da equipe (fotos e conclusões no prazo) o suficiente para justificar o custo.

O protótipo já tem a tela navegável (`prototipo/Maquete.dc.html`) para guiar o estudo.
