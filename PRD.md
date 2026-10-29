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
| Pendências fechadas com evidência | Pendências resolvidas com foto de antes e depois | 100% |
| Reunião produtiva | Providências da semana anterior cumpridas no prazo | ≥ 70% |
| Comunicação semanal | Boletins enviados por obra por semana | 1 por obra (segunda) |
| Adoção | Engenheiros que usam o app ao menos 4 dias por semana | ≥ 80% |

## 4. Usuários e perfis

São **dois perfis de acesso** apenas:

| Perfil | Quem é | O que faz no CONTRO |
|---|---|---|
| **Gestor** | Diretoria e gestão de obras | **Tudo**: vê todas as obras, conduz a reunião e aprova a ata, e é o único que **cria, edita, duplica e exclui modelos de obra** |
| **Equipe de obra** | Engenheiro, mestre/encarregado, compras e demais da obra | O app do dia a dia, **tudo menos editar modelos**: cria obra escolhendo um modelo, conclui atividades (com ou sem foto), aponta e resolve pendências, marca lembretes, dá baixa e replaneja tarefas |

A função de cada pessoa (engenheiro, mestre, compras) é só um rótulo (`papel_texto`) para atribuições e relatórios; não muda o acesso.

Pendência fecha com a foto de depois, sem vistoria de outra pessoa (decisão de 28/10/2026).

## 5. Escopo da versão 1

### 5.1 Carteira (tela inicial)
- **Menu inferior com duas abas:** **Hoje** (abre por padrão, com o número de atrasos em vermelho) e **Minhas obras**. O cabeçalho (CONTRO, Modelos, boletins prontos e perfil) fica nas duas.
- **Hoje** (aba padrão; opção A do protótipo): "Hoje · segunda, 26/10" e um resumo ("4 atrasos e 5 coisas para hoje em 3 obras"). Um **card por obra, recolhível**, só das obras com algo no dia; **todos começam recolhidos** (o cabeçalho já mostra "2 atrasados · 2 para hoje" e a borda vermelha).
  - **Atrasado** (faixa vermelha, no topo do card): lembrete não providenciado no prazo, atividade que devia ter terminado e tarefa vencida, do mais antigo para o mais novo.
  - **Para hoje**: atividade que termina ou começa hoje, lembrete com prazo hoje e tarefa de hoje.
  - **Em andamento** (dentro do Para hoje): o corte é hoje, mas nada que ficou para trás some. Atividade (inclusive do pré-obra) que devia ter começado e ainda está no prazo aparece todo dia, "desde seg 20/10 · terminar até sex 24/10", até ser concluída; passou do fim, vai para Atrasado.
  - **Mapa de coleta** mostra para que serve o prazo: "começar hoje · pronto até qua 15/10 · Instalações elétricas começa seg 27/10". O mapa começa (antecedência + duração do mapa) dias úteis antes da atividade que libera: ex.: mapa de 5 du com antecedência de 10 du começa 15 du antes e fica pronto 10 du antes, a tempo de contratar.
  - Tocar no item abre a obra (ou as Tarefas, se for tarefa).
- Título "Minhas obras" com **ícone "+"** discreto para criar obra a partir do modelo.
- Atalhos **Reunião** (próxima reunião e status da pauta) e **Tarefas** (abertas e atrasadas da equipe).
- Card por obra: nome, fase atual, % real, barra de 6 segmentos (uma por fase), etiqueta de ritmo, data de entrega e aviso em vermelho de atividades e lembretes atrasados.
- Não há cards de XP nem de contadores gerais na tela inicial (decisão do usuário: o foco é a obra).

### 5.1b Plano de recuperação da inauguração
- A obra guarda a **inauguração planejada** (fixada na primeira abertura). A **inauguração prevista** considera que toda atividade aberta que já devia ter terminado termina hoje e empurra as seguintes.
- Quando a prevista passa da planejada, aparece **"Inauguração em risco"** no topo da trilha da obra e no card da obra na aba Hoje, com "Ver plano".
- **Plano de recuperação** (opção A): sugestões nas **próximas atividades críticas** (ainda não começadas), de dois tipos: **paralelismo** (começar até 2 dias úteis antes do fim da predecessora crítica) e **redução de prazo** (~20%, mín. 1 dia, reforçando a equipe). Cada uma mostra quanto recupera, o que precisa e o risco; o app já marca o mínimo que volta à data planejada. Nada começa antes de hoje.
- **Aplicar** grava as mudanças no cronograma da obra (com evento) e cria uma providência (tarefa) por sugestão, com prazo 2 dias úteis antes do novo início.

### 5.2 Nova obra a partir de um modelo
- Informa a unidade, o início (atalhos para as próximas 4 segundas ou **"Outra data no calendário"**, qualquer data passada ou futura; sábado ou domingo vira a segunda seguinte) e **escolhe o modelo a seguir** (lista com nome, subtítulo, atividades e dias úteis de cada modelo salvo).
- Mostra a prévia: número de atividades, número de lembretes, dias úteis, fases com datas e entrega prevista.
- Ao confirmar, gera a obra com cópia **independente** do modelo escolhido, como ele está naquele momento: atividades, prazos, conexões e lembretes. A obra pode ser editada sem alterar o modelo.

### 5.3 Obra · cabeçalho
- **Menu "⋮" no cabeçalho da obra:** "Editar nome da obra" (qualquer membro, com Desfazer) e, só para o gestor, "Apagar obra".
- **Apagar obra:** só o gestor, pelo menu "⋮"; sempre pede confirmação ("Apagar esta obra?" com Cancelar e Apagar obra). Exclusão lógica: some de Minhas obras, Hoje, reunião e boletim; o aviso logo depois tem Desfazer.
- Nome, "Dia N de M do modelo", % real, barra de avanço e **ícone discreto de Boletim da semana** à direita.
- Ritmo, fase e entrega **não** ficam em chips no cabeçalho (decisão do usuário).

### 5.4 Obra · Fases (mapa do jogo)
- **Cards livres na obra:** cada fase tem "+ Adicionar atividade" (nome, prazo em dias úteis e depois de qual atividade começa; padrão: junto com o início da fase). Na ficha, "Excluir atividade" (com Desfazer; exclusão lógica). Quem dependia da excluída passa a depender do que ela dependia. Vale só para a obra; o modelo não muda.
- Trilha vertical com o **pré-obra** e as 6 fases da obra: **Orçamento** e **Mapa de coleta** (pré-obra), Mobilização, Infraestrutura, Fechamentos, Acabamentos, Instalações finais e Entrega.
  - **Pré-obra** acontece **antes do dia 0** (início da Mobilização) e fica **fora do % e do prazo** da obra; as datas são calculadas para trás e a atividade fica vermelha se passar do fim previsto. A etiqueta da fase diz "pré-obra". **Nada do pré-obra trava**: é aviso para o usuário se programar.
  - **Orçamento** (fase 1): 3 atividades em sequência de 5 dias úteis: #1 Recebimento dos projetos → #2 Levantamento de quantitativos → #3 Montagem da EAP no Grana; terminam antes do primeiro mapa.
  - **Mapa de coleta** (fase 2): até 18 tomadas de preço (5 du cada), na ordem de quando cada contratação precisa estar fechada: cada mapa **libera uma ou mais atividades** e termina em início da mais cedo delas − antecedência da contratação. Os da 1ª onda fecham antes do dia 0; os demais seguem durante a obra.
  - O mapa é um **check**: o quadrado no card marca "pronto para decisão de contratação" (na data, sem pedir nada). Sem foto e sem pontos; não conta no avanço da obra. **"+ Quem foi contratado"** é opcional e pode ser preenchido depois (sugere nomes já usados).
- Estados de fase: concluída, em execução, planejada e com atraso (vermelho).
- Ao expandir uma fase, as atividades aparecem com estado (concluída, atrasada ou a executar, com as datas previstas e o lembrete que falta, se houver), o prestador (quando informado) sem botão de câmera no card: concluir (com ou sem foto) é pela ficha, ao tocar no item. Concluída sem foto aparece como "Concluída · sem foto". **Não existe atividade bloqueada.**
- **Avanço parcial** (28/10/2026): cada atividade tem um anel à esquerda; cada toque soma 25% (25, 50, 75) e o quarto toque conclui sem foto. O card mostra "50% feito" e uma barra fina, e o % parcial entra no avanço da fase e da obra (pelo peso da atividade). Na ficha, o rodapé **25 · 50 · 75 · Pronta · Foto** ajusta, volta (tocar no passo marcado volta um) ou conclui. Toda mudança tem Desfazer. Mapa de coleta continua só check.
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
- Rodapé fixo em toda atividade aberta (protótipo, opção D, 28/10/2026): **25% · 50% · 75% · Pronta · Foto** numa linha. Os passos vão e voltam livremente (tocar no marcado volta um), **Pronta** conclui na hora sem foto (com Desfazer) e **Foto** conclui com foto. Avançar e concluir ficam só aqui (saíram o "Marcar como resolvida" e os cards do topo); concluída sem foto, "Anexar foto". Concluída (com ou sem foto): **"Voltar para pendente"**, para qualquer pessoa da equipe, com Desfazer (que conclui de novo com a mesma foto).

### 5.6 Providências (lembretes de contratação, locação e compra)
- Cada lembrete tem só: **tipo**, **o que providenciar**, **data em que precisa estar na obra** (padrão: início da atividade, editável) e **situação** (A providenciar ou Providenciado).
- **Não tem valor nem fornecedor.** Isso fica em outro sistema (decisão do usuário).
- "Providenciar até" = início da atividade menos a antecedência do modelo, em dias úteis.
- **Duração** ("leva N dias"): quanto tempo leva para providenciar (ex.: tomada de preço de 5 du antes de contratar). "Começar" = providenciar até − duração. O Hoje avisa desde o dia de começar até o prazo ("começar hoje · providenciar até qua 29/10"); depois do prazo, vai para Atrasado. Duração 0 = avisa só no prazo. Definida no modelo (assistente, passo 4).
- Aba **Providências** da obra agrupada em Atrasados (vermelho) e A providenciar, com o botão "Marcar como providenciado".
- Lembretes avisam o que contratar, alugar ou comprar a tempo, mas **não travam** a atividade: ela pode ser concluída com lembrete pendente.

### 5.7 Check list (pendências de qualidade)
- Na obra, a aba se chama **Check list** e fica depois de Cronograma (abas: Fases, Providências, Cronograma, Check list). Um botão **"i"** explica como funciona.
- Duas abas, com as contagens: **Pendências | Resolvidos** (28/10/2026: sem fila e sem adiar).
- **Pendências:** em **Fotos** ou em **Lista**; a troca é um botão com texto na linha do contador ("Ver em lista" / "Ver em fotos"). Fotos: uma foto por vez (foto do antes, criticidade, local, atividade e quem apontou), das **altas para as baixas**, com "1 de N".
  - Deslizar para a **esquerda**, ou o botão "Resolvida", abre a câmera com a **foto do antes em transparência** (ghost) para alinhar a foto de depois. A pendência vai direto para Resolvidos (sem vistoria).
  - Deslizar para a **direita**, ou "Próxima", só passa para a próxima foto (da última volta à primeira). Nada muda na pendência.
  - Não existe adiar nem data de retorno.
  - Lista: agrupada por criticidade (Alta, Média, Baixa), com miniatura, local e atividade, etiqueta da criticidade, há quanto tempo, câmera para resolver e "⋯".
- **Resolvidos:** lista compacta (antes e depois em miniatura, "Resolvido hoje · quem"), da mais recente; tocar abre o card com **antes e depois lado a lado**.
- Em qualquer item, "⋯" tem **Ver antes e depois**, **Editar pendência** (o que, local, criticidade, atividade) e **Apagar pendência** (exclusão lógica, com Desfazer); o resolvido tem também **"Voltar para pendente"**, e quem reabre escolhe **manter ou tirar a foto do depois**. Foto errada: apagar e apontar de novo. Tocar numa foto abre **antes e depois em tela cheia, com zoom** (dois dedos ou toque duplo). A Nova pendência sempre abre vazia.
- **Apontar:** ícone de câmera; foto primeiro, descrição depois. A atividade (opcional) se escolhe por **busca** (parte do nome, sem acento, ou o número #N) numa lista agrupada por fase.

### 5.8 Cronograma
- Gantt simplificado por fase, com a linha de hoje. Cores: concluída (turquesa), a executar (preto) e atrasada (vermelho).
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

### 5.10 Reunião semanal (dia e horário do gestor; padrão segunda, 16h)
- **Reunião e avisos** (gestor, menu do perfil; 28/10/2026): escolhe o **dia** (seg a sex) e o **horário** da reunião e os avisos por push:
  - lembretes da reunião, para todos: **no dia, de manhã** (07:00, 08:00 ou 09:00) e **antes de começar** (30 min, 1 hora ou 2 horas);
  - avisos do dia, seg a sex: **resumo da manhã** (obras em andamento e tarefas atrasadas; todos ou só gestores), **tarefas que vencem hoje** (só o responsável) e **providências para começar** (todos ou só gestores; vem desligado). Cada aviso liga/desliga e tem horário.
  - Cada pessoa liga o push no seu celular em **"Avisos neste celular"** (menu do perfil). No iPhone, só com o app instalado na tela inicial. Tocar no aviso abre a reunião, as tarefas ou a tela inicial.
- **Pauta por obra** (decisão do usuário, 29/10/2026): escolhe-se a obra no topo (✓ no chip quando tudo foi respondido) e passa-se por **4 passos**, com "Continuar" e "Voltar" no rodapé e o contador "N de M respondidos nesta obra". **Toda resposta fica gravada** e cada card respondido mostra **"Na ata: …"**, dizendo para onde o item foi.
  1. **Cobrança:** as ações de reuniões anteriores (abertas ou feitas desde a reunião passada) recebem **Feita** (conclui, com Desfazer) ou **Não feita**, que abre "Remarcar ação" (quem, nova data, observação; conta como replanejamento). O card já mostra o avanço e o comentário que o responsável informou na semana.
  2. **Semana passada:** cada card tem a etiqueta **TERMINAR** (o fim previsto caiu na semana passada) ou **COMEÇAR** (o início previsto caiu na semana passada) e uma pergunta só.
     - **Terminou** conclui a atividade na hora, sem foto (com Desfazer); já concluída aparece como "Concluída no app". Vai para "Planejado e aconteceu".
     - **Não terminou** abre a ação para recuperar: **quanto andou** (0/25/50/75%, gravado como avanço da atividade), o **impacto no cronograma só simulado**, o que fazer, **quem cuida (obrigatório)**, até quando e observação. Vai para "Planejado e não aconteceu" e para as Tarefas da pessoa.
     - **Começou** fica gravado e pode marcar quanto já andou (só começou, 25%, 50%). Com avanço no app, já vem respondido. **Não começou** abre a mesma ação, sem "quanto andou".
  3. **Esta semana:** atividades recebem **Segue o plano** (gravado; sai na ata com o prestador) ou **Precisa de ação** (quem e até quando). Contratar, alugar e comprar recebem **Já providenciado** (marca o lembrete como feito) ou **Precisa de ação**.
  4. **Fechamento:** observações livres, os itens **sem resposta** com atalho "Responder" (não trava), outras ações da obra ("+ Nova ação") e a **prévia de como a obra sai na ata**.
- **Quem cuida é obrigatório** em toda ação da reunião: pessoas do app ou nome digitado ("+ Outro nome", que vira sugestão). **Datas**: atalhos (próximos 5 dias úteis) e **Outra data**, que abre o calendário do mês (sábado e domingo em cinza, mas podem ser escolhidos). O mesmo calendário vale para o prazo de tarefa e para remarcar.
- Toda ação vira **tarefa** do responsável e volta na **Cobrança** da reunião seguinte.
- **Gerar ata** (na última obra): mostra a pauta com os respondidos de cada obra; só o gestor gera. A ata traz, por obra (faixa cinza): **1 · Planejado e aconteceu**, **2 · Planejado e não aconteceu** (com a ação: quem, até quando), **3 · Próxima semana** (segue o plano ou com ação), **Providências**, **4 · Cobrança da reunião anterior** e Observações; no topo, os totais (aconteceram, não aconteceram, ações novas, cobrança); no fim, **Quem faz o quê** por pessoa. Item sem resposta sai como "sem resposta".
- **Minhas ações** (sistema colaborativo): quem tem ações abertas vê na ata o botão **"Minhas ações · N"** e o próprio nome destacado. A tela lista as ações da pessoa em todas as obras, por obra, com o anel de avanço; ela informa **0/25/50/75% ou Feita**, um comentário e pode mudar o prazo (calendário livre; conta como replanejamento). Também abre por Tarefas → "Minhas". O gestor vê o avanço nas Tarefas e na Cobrança.
- **WhatsApp** no mesmo formato da ata. **Baixar PDF** pergunta o formato: **Resumo em tabela + ata** (padrão, A4 paisagem: linhas = obras; colunas = cumprido, não cumprido → ação, próxima semana, providências, cobrança; depois a ata) ou **Só a ata**. A tabela só existe no PDF.

### 5.11 Tarefas (providências da equipe)
- Filtro por pessoa, com o número de atrasadas em cada uma. Na v1 começa com **nomes fictícios**; não há cadastro prévio obrigatório.
- **Cadastro pelo uso:** ao digitar um responsável ou um prestador novo, o nome é salvo e passa a ser **sugerido** nos próximos lançamentos (autocompletar). Os nomes podem ser editados ou unificados depois.
- Grupos: Atrasadas, Abertas e Concluídas.
- **Concluir** em um toque, com "Desfazer". O vínculo produz efeito na obra:
  - **Lembrete:** marca como providenciado e pode liberar a atividade.
  - **Atividade:** abre a câmera de conclusão.
- **Reabrir** qualquer tarefa concluída. Se ela tinha marcado um lembrete como providenciado, o lembrete volta para "a providenciar".
- **Editar tudo:** texto, responsável, prazo (atalhos ou "Outra data" no calendário do mês), situação, e excluir (com "Desfazer").
- Cada tarefa mostra o **avanço e o comentário** informados por quem cuida (Minhas ações).
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
3. **Não existe atividade bloqueada:** qualquer atividade aberta pode ser concluída; dependências só montam o cronograma e lembretes só avisam. Concluir uma atividade com subitens marca os subitens abertos.
4. Atividade é **concluída com ou sem foto**; sem foto fica marcada e pode receber a foto depois.
5. Atividade **atrasada** = não concluída e término previsto já passou.
6. Lembrete **atrasado** = não providenciado e "providenciar até" já passou.
7. Pendência só fecha com **foto de depois**.
8. Pendência resolvida vai direto para Resolvidos, com antes e depois.
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
| Q2 | Peso do % de avanço | Decidido (28/10/2026): peso pela duração do modelo com **% parcial** por atividade (25/50/75; 100% conclui, com ou sem foto) |
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
