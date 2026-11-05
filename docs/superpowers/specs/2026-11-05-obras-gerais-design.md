# Obras gerais: um segundo ambiente no CONTRO

Data: 05/11/2026 · Estado: revisado; aguarda aprovação final do usuário

Protótipo navegável (mapa de fluxos, uma faixa por perfil, setas do toque até a tela de destino): [`2026-11-05-obras-gerais-mapa.html`](2026-11-05-obras-gerais-mapa.html). Os códigos de tela citados aqui (A3, C4, J5…) são os do mapa.

## Intenção e por quê

O CONTRO nasceu para as reformas das unidades Contorno do Corpo, um escopo fechado e bem organizado em modelos de obra. O usuário quer usar a mesma base nas **outras obras da empresa** (ex.: galpão da SMS), aproveitando o que já funciona: fases e atividades, check list de pendências, avisos por push, atrasos, reunião com ata, ações da equipe, Score e Log.

Essas obras têm outra dinâmica e outras pessoas:

- não há modelo nem cronograma calculado: o engenheiro de campo vai lançando fases e atividades e **digita a data prevista** de cada uma, e o app cobra, avisa e mede a agilidade em cima dessas datas;
- a equipe é de cada obra (engenheiro de campo, auxiliar, estagiário, comprador), diferente da equipe da Contorno, e **não pode ver as obras da Contorno**, nem a equipe da Contorno pode ver essas obras;
- só Luiz Felipe, Rafael e Rodrigo enxergam as duas frentes por padrão (e quem receber papel nos dois ambientes).

A referência do nível de acompanhamento é o checklist da contenção do galpão SMS (receber projeto, comprar aço, contratar empreiteiro com subitens, mobilizar topógrafo, contratar concreteira, alugar formas etc.), cada linha com dono e data.

## Regra de ouro: a Contorno não muda

Nada do que existe hoje na Contorno muda: telas, fluxos, permissões, menus, modelos, cronograma, reunião, boletim. Quem usa a Contorno hoje (inclusive o Matheus, que é Gestor) entra e usa exatamente como antes e **não vê nada de Obras gerais**.

Únicas exceções, aprovadas pelo usuário:

1. O item do perfil **"Aprovar membros" passa a se chamar "Pessoas e acessos"**, com a mesma função na Contorno.
2. Para Luiz Felipe, Rafael e Rodrigo aparecem a **troca de ambiente** no perfil e o **nome do ambiente** ao lado da marca.

Se alguma decisão abaixo parecer exigir mudança visível na Contorno, a decisão está errada: pare e pergunte.

## Objetivos

- Um segundo ambiente, **Obras gerais**, dentro do mesmo app, separado da Contorno por permissão (RLS), não só pela tela.
- A obra geral usa a **mesma estrutura e as mesmas telas** da obra Contorno, com o mínimo de diferenças (listadas abaixo).
- Acesso por obra: cada pessoa de Obras gerais é ligada a uma ou mais obras gerais e só vê essas.
- Os mesmos recursos de acompanhamento: Hoje, push, atraso e vence hoje, reunião semanal com ata, ações da equipe, pendências com antes e depois, boletim, Score e Log.

## Não objetivos

- Mudar qualquer coisa da Contorno além das duas exceções acima.
- Modelos de obra para Obras gerais (a obra geral não nasce de modelo).
- Cálculo de cronograma em Obras gerais (sem dias úteis calculados, sem dependências que movem datas, sem caminho crítico, sem "inauguração em risco").
- Pedido de ingresso: em Obras gerais ninguém pede para entrar; só entra quem recebe acesso.
- Cadastro de função ou WhatsApp das pessoas.

## Anti-objetivos (seria fracasso mesmo funcionando)

- Alguém da Contorno ver uma obra geral, ou alguém de Obras gerais ver uma obra da Contorno (inclusive por Score, Log, Hoje, avisos, boletim ou busca).
- A equipe da Contorno perceber qualquer diferença no dia a dia.
- Duplicar telas inteiras para Obras gerais em vez de reaproveitar as da Contorno com variações pontuais.

## Ambientes e perfis

**Ambientes:** `Contorno` (o que existe) e `Obras gerais` (novo). Toda obra pertence a um ambiente, definido na criação pelo ambiente em que a pessoa está. Não há escolha de tipo.

**Perfis:**

| Perfil | Quem | Vê | Pode |
|---|---|---|---|
| **Administrador** | Luiz Felipe, Rafael, Rodrigo | Contorno inteira (como Gestor) e todas as obras gerais | Tudo nos dois ambientes; cria obra geral; Pessoas e acessos de Obras gerais |
| Gestor e Equipe Contorno | Matheus e equipe atual | Só a Contorno, como hoje | Como hoje |
| **Coordenador** (Obras gerais) | ex.: Carlos, engenheiro de campo | Só as obras gerais em que está | Tudo dentro dessas obras: fases, atividades, datas, responsáveis, adicionar membros, reunião e avisos da obra |
| **Membro** (Obras gerais) | ex.: Júlia (compradora), Ana (estagiária) | Só as obras gerais em que está | Concluir atividades e subitens (de qualquer pessoa da obra), avanço, fotos, pendências, participar da reunião |

- Cada pessoa de Obras gerais tem **um papel só** (Coordenador ou Membro), que vale em todas as obras dela. Ela é ligada a **uma ou mais** obras gerais.
- **A mesma pessoa pode estar nos dois ambientes** (ex.: alguém da equipe Contorno que vira Membro de uma obra geral). Nesse caso ela ganha a **troca de ambiente** no perfil, como os Administradores. Na Contorno continua com o perfil de hoje; em Obras gerais vê só as obras gerais em que foi colocada.
- O Administrador é um Gestor da Contorno com acesso a Obras gerais. O Matheus continua Gestor e não vira Administrador.
- Só Administradores criam obra geral. Só Administradores tornam alguém Coordenador.

## Navegação

- **Troca de ambiente:** para Administradores e para quem tem papel nos dois ambientes, no topo do perfil (Contorno | Obras gerais). Não há tela de pouso. O app abre no **último ambiente usado**; no primeiro acesso, na Contorno. Ao lado da marca aparece o nome do ambiente atual (só para Administradores).
- **Administrador em Obras gerais:** menu de baixo igual ao da Contorno (Hoje · Obras · Score · Log).
- **Coordenador e Membro:** caem direto em Obras gerais, sem troca e sem nome de ambiente. Menu de baixo **Hoje · Obra · Score · Log**. O app abre no Hoje. Na aba Obra, o **nome da obra no topo** é o seletor entre as obras dela (com uma obra só, sem setinha).

## Perfil (menu do avatar)

Três blocos (faixa "Perfil por ambiente" no mapa):

1. **Ambiente** (só Administradores).
2. **Bloco do ambiente**, os mesmos três itens nos dois ambientes: **Reunião e avisos**, **Boletim automático**, **Pessoas e acessos**. O conteúdo de cada tela é o do ambiente atual. Na Contorno, Pessoas e acessos é o "Aprovar membros" de hoje, com o mesmo selo de quantos aguardam.
   - Coordenador: **Reunião e avisos** (só das obras dele) e **Pessoas da obra**.
   - Membro: sem esse bloco.
3. **Sua conta**, igual para todos e em qualquer ambiente: Editar meu nome, Avisos neste celular, Trocar senha, Atualizar o app, Sair.

Modelos de obra continua onde está hoje (botão na tela de obras da Contorno).

## Pessoas e acessos (Obras gerais)

- **Lista (A7):** todas as pessoas de Obras gerais, com papel, e-mail e as obras de cada uma; quem está sem obra aparece como tal.
- **Ficha (A8):** papel único (Coordenador | Membro) e uma chave por obra geral. Desligar tira o acesso na hora; as atividades abertas dela ficam sem responsável e o coordenador da obra é avisado.
- **Nova pessoa (A9):** só **Nome** (como aparece no app), **E-mail** (login), **Papel** e **Obras**. Botão "Dar acesso". Se a pessoa ainda não tem conta, ao se cadastrar com esse e-mail ela já entra nas obras marcadas, sem passar por aprovação.
- **Pessoas da obra (C6, C7), para o Coordenador:** quem está na obra e "Adicionar membro": busca quem já existe ou cadastra nome e e-mail, sempre como **Membro** e só nas obras dele.
- Sem "aguardando" e sem aprovação em Obras gerais.

## A obra geral

**Criar (A6):** gaveta de baixo para cima com **Nome da obra** e **Cidade**. Sem cliente, sem coordenador, sem modelo, sem fase. A obra abre vazia.

**Estrutura igual à da Contorno (C1, C9):**

- Trilha de fases (todas iguais, **sem pré-obra separado**) e a tarja preta de **Entrega da obra** no fim (no lugar de "Inauguração").
- **Sem % de avanço físico da obra.** As atividades entram aos poucos e não existe o total da obra, então não há como calcular avanço. Nada de barra de %, "N de M fases" como avanço, ou previsão de entrega calculada. O indicador da obra é a **eficiência**: quanto das atividades já lançadas foi concluído no prazo (o Score), mostrado no card da obra (ex.: "82% no prazo").
- **Nova fase (C8):** só o nome. Entra no fim da trilha, antes da entrega.
- Tocar na fase **abre na própria trilha** (acordeão, como na Contorno), com as atividades em ordem, anel de avanço, responsável e data, subitens embaixo e "+ Adicionar atividade" no fim. Sem filtros.
- No topo da obra, os blocos **Reunião** e **Ações da equipe** da obra (ver Reunião).
- Coordenador e Administrador veem "+ fase" e "+ Adicionar atividade"; o Membro não.

**Atividade:**

- **Nova atividade (C3):** nome, responsável (pessoas da obra) e **data prevista**: atalhos (Hoje, Amanhã, próximos dias) ou **Calendário (C10)** para qualquer dia. Opcionais: "Dividir em subitens", lembrete de providência, nota.
- **Sem cálculo de cronograma:** a data prevista é digitada pelo coordenador. Não há prazo em dias úteis, dependências que movem datas, caminho crítico nem inauguração em risco. Atraso, vence hoje, push, replanejamento, Score e Log usam essa data.
- **Ficha da atividade (C4):** igual à da Contorno. Linhas próprias para **Data prevista** (com "Mudar", abre o calendário) e **Responsável** (com "Trocar"); empresa ou prestador (opcional); subitens; "⋯" com editar nome e excluir; **rodapé fixo 25% · 50% · 75% · Pronta · Foto** (Pronta conclui sem foto; Foto conclui com foto; foto pode ser anexada depois).
- **Ficha para o Membro (J4):** a mesma, sem "Mudar" e "Trocar"; data e responsável só para leitura. Se o prazo não vai dar, o membro **conversa com o coordenador**, que ajusta (o app não tem pedido de nova data).
- **Avanço da atividade igual ao da Contorno:** tocar no anel avança 25% por toque e o quarto conclui; Desfazer por 5 s. O avanço é só da atividade: não soma em % da obra.
- **Qualquer pessoa da obra conclui qualquer atividade aberta** (como na Contorno). O **Log registra quem concluiu e de quem era a atividade** (J5).
- Mudar a data de atividade aberta é replanejamento rastreado: guarda a data original e conta replanejamentos (como a regra 8 das tarefas); o responsável recebe push.

**Subitens:**

- Na criação, a chave **"Dividir em subitens" (C11)**, a mesma do assistente de modelos: cada subitem tem nome e data; sem data, aparece o **ícone de calendário**. "+ subitem" inclui mais.
- Na ficha, **"+ Adicionar subitem"**. A **caixinha marca**; tocar no **texto abre "Editar subitem" (C12)**: texto, data (atalhos ou calendário), Salvar com Desfazer e Excluir.
- A data da atividade é a do **último subitem**. Um nível só. Concluir a atividade marca os subitens abertos (como na Contorno).
- Coordenador e Administradores editam subitens; o Membro só marca.

**Lembretes de providência** (contratação, locação, compra) continuam como na Contorno, sem valor e sem fornecedor, com a data informada à mão.

**Pendências (Check list), boletim, Log da obra:** os mesmos da Contorno.

## Hoje (A3, A14, C0, J0)

Igual ao Hoje da Contorno (`HojeObras`): título com a data, resumo do dia, **um card por obra recolhido**; ao tocar, abre **Atrasado** (vermelho, no topo) e **Para hoje**, com tipo (Concluir, Locação…), nome, responsável e detalhe. Tocar numa linha abre a obra ou a ficha. Cada pessoa vê as obras gerais em que participa; o conteúdo do card é o mesmo para todos da obra. O Hoje de Obras gerais nunca mistura obras da Contorno.

## Reunião e Ações da equipe (A13, A15, C1, C13)

- Os mesmos blocos **Reunião** e **Ações da equipe** da aba Obras da Contorno.
- Em Obras gerais, **cada obra tem a sua reunião** (dia, hora, pauta, preparar e atas) e as suas ações da equipe. A reunião usa o mesmo fluxo da Contorno.
- Administradores: na aba Obras, os blocos juntam as obras gerais; a tela **Reuniões (A15)** lista uma por obra.
- Coordenador e Membro: os blocos aparecem no topo da obra.
- **Reunião e avisos da obra (C13):** a mesma tela da Contorno (reunião semanal: dia e hora; lembretes da reunião: de manhã e antes de começar; avisos do dia: ações do dia, prazo da pendência, providências para começar), aplicada a uma obra geral. O **Coordenador configura as obras dele**; Administradores configuram qualquer obra geral.

## Avisos (push)

- Mesmos tipos de aviso da Contorno, por obra geral, com os horários da configuração da obra.
- Cada pessoa recebe as ações dela. O **Coordenador e os Administradores recebem as da obra inteira** (como o gestor recebe hoje na Contorno).
- Quem está só em Obras gerais nunca recebe aviso da Contorno, e vice-versa. Administradores recebem dos dois.

## Score e Log

- Os mesmos da Contorno.
- Em Obras gerais, **Coordenador e Membro veem só as obras em que participam** (todas as pessoas dessas obras). Administradores veem todas as obras gerais.
- A Contorno continua como está.

## Restrições técnicas que o builder precisa saber

- **Regras de domínio só no `packages/core`**, com teste (CLAUDE.md, regra 1). O tratamento de "obra sem cronograma, com data prevista digitada" precisa estar no core (estados, atraso, eficiência no lugar do % da obra, agenda do dia, ações, score, log), não espalhado pelas telas.
- **Hoje o modelo de permissão é global**: `pessoa.perfil` é `gestor | equipe`, a equipe lê e escreve **todas** as obras, e a RLS usa `contro_perfil()` / `contro_e_membro()`. Obras gerais exigem permissão **por obra e por ambiente** em todas as tabelas que pendem de obra (atividade, fase, pendência, providência, tarefa, reunião, boletim, fotos no Storage, eventos, score diário). Essa é a parte de maior risco: a separação tem que valer na RLS e ser testada com pgTAP (regra de migrations com RLS e teste de política no mesmo PR). Para os usuários da Contorno, o resultado das políticas não pode mudar.
- **Reunião e avisos hoje são globais**: `config_avisos` é linha única e a reunião não pertence a uma obra (`reuniao` + `reuniao_obra`). Obras gerais precisam de configuração e reunião **por obra**, sem alterar o comportamento da reunião única da Contorno.
- **Cronograma:** `obra_atividade` hoje deriva datas de `duracao_du`, dependências e `inicio_manual`. A obra geral precisa de data prevista direta (na atividade e no subitem) e de rastrear replanejamento dessa data.
- **Obra:** hoje tem `unidade_id` (unidade Contorno) e `modelo_id`. A obra geral não tem unidade nem modelo; tem nome e cidade.
- **Cadastro:** hoje a pessoa se cadastra e espera aprovação. Em Obras gerais, o e-mail liberado por um Administrador ou Coordenador entra direto. O fluxo de aprovação da Contorno não muda.
- Offline, otimista, Desfazer, exclusão lógica e tabela de eventos valem igual (regras 7, 9 e 10).
- Design system CONTRO sem mudança (cores, vermelho só para atraso, âmbar só para vence hoje).

## Decisões tomadas pelo usuário (05/11/2026)

1. Dois ambientes no mesmo app; a Contorno não muda (só as duas exceções).
2. Administradores: Luiz Felipe, Rafael, Rodrigo. Matheus continua Gestor da Contorno, sem acesso a Obras gerais.
3. Sem tela de pouso; troca de ambiente pelo perfil; abre no último ambiente usado.
4. Obras gerais: papéis Coordenador e Membro; um papel por pessoa; ligada a 1 ou N obras.
5. Só Administradores criam obra geral; criar herda o ambiente; gaveta com nome e cidade.
6. Mesma estrutura da obra Contorno: fases, atividades, subitens, providências (sem pré-obra separado, ver 19).
7. Data prevista digitada pelo coordenador, com atalhos e calendário; sem cálculo de cronograma.
8. Nova fase: só o nome.
9. Membro não cria atividade, não muda data, não atribui; conversa com o coordenador.
10. Membro conclui atividade de qualquer pessoa; o Log registra quem concluiu e de quem era.
11. Avanço igual à Contorno (anel e rodapé 25/50/75/Pronta/Foto).
12. Reunião com ata, pendências e boletim também em Obras gerais, no mesmo fluxo; reunião e ações da equipe por obra.
13. Coordenador muda dia e hora da reunião e configura os avisos da obra dele.
14. Coordenador e Administradores recebem os avisos da obra inteira.
15. Hoje igual à Contorno, também para Coordenador e Membro (menu Hoje · Obra · Score · Log).
16. Score e Log limitados às obras em que a pessoa participa.
17. Nova pessoa: nome, e-mail de login, papel e obras; sem função e sem WhatsApp; só por convite, sem aprovação.
18. "Aprovar membros" passa a se chamar "Pessoas e acessos", nos dois ambientes.
19. Obra geral **sem % de avanço físico** e sem pré-obra separado; o indicador é a eficiência (no prazo), pelo Score.
20. Quem tem papel nos dois ambientes ganha a troca de ambiente.

## Escolhas minhas (o usuário pode revisar)

- **Atividade com responsável é ação dessa pessoa.** Em Obras gerais, a atividade tem responsável direto e a data prevista é o prazo. Ela entra em Ações da equipe, no push "Ações do dia", no Hoje e no **Score da pessoa** (pontualidade contra a data prevista original, replanejamentos), porque o objetivo do usuário é "medir o cara na agilidade". No Log, "de quem era" é esse responsável. Como o builder modela isso (tarefa vinculada automática ou ação de origem "atividade" com responsável próprio) fica com ele, desde que a atividade não apareça duas vezes.
- **Uma data só: a data prevista é o prazo final.** Não há data de início. Adaptações:
  - no Hoje, a atividade aparece só como "previsto concluir hoje" ou atrasada (sem "começar hoje" nem "em andamento");
  - a antecedência do lembrete de providência conta a partir da data prevista da atividade;
  - o aviso "Providências para começar" usa essas datas;
  - o boletim mostra previsto x realizado pelas datas previstas, sem ritmo em dias úteis;
  - a tarja "Entrega da obra" não tem data obrigatória nem "em risco".
- **Boletim automático por obra**, como a reunião: Administradores configuram qualquer obra geral; destinatários iguais aos da Contorno para aquela obra (coordenador e administradores). O Coordenador não configura boletim.
- **Responsável livre e sugestões:** como na Contorno, tarefa e atividade aceitam pessoa da obra ou um nome digitado (prestador, por exemplo). As sugestões de autocompletar (`sugestao`) ficam **separadas por ambiente**, para nenhum nome da Contorno aparecer em Obras gerais e vice-versa.
- **Datas no fim de semana:** o calendário deixa escolher qualquer dia (a data é digitada pelo coordenador). Atraso continua em dias úteis pela regra do core que já existe (`atrasoDU`, mínimo 1 d.u. depois do prazo).
- **Administradores** são as contas de Luiz Felipe, Rafael e Rodrigo, que já são Gestores. A marcação é feita por migration de dados, não pela interface; o teste pgTAP cobre que só Administrador cria obra geral e torna alguém Coordenador.
- No primeiro acesso, o Administrador abre na Contorno.
- A tarja do fim da trilha em Obras gerais diz "Entrega da obra" (não "Inauguração"), sem data obrigatória.
- Subitens criados na Nova atividade (chave) e na ficha ("+ Adicionar subitem"); editar subitem por "Editar subitem" (C12). Na Contorno, isso não muda: lá subitem continua só marcável e excluível na obra.
- Pessoa sem conta liberada por e-mail entra direto ao se cadastrar com ele.
- Ao tirar alguém de uma obra, as atividades abertas dela ficam sem responsável e o coordenador é avisado.

## Deixado para o builder

- Modelo de dados exato (colunas, tabelas novas, enums) e a estratégia de RLS por obra e por ambiente, desde que atendam às restrições acima e sejam testadas.
- Como o core distingue obra com cronograma de obra com data digitada (tipos, funções), desde que telas e SQL não recalculem regra.
- Divisão em milestones no PLAN.md e ordem de entrega (sugestão: permissões e ambiente primeiro, depois obra e atividades, depois Hoje, depois reunião e avisos por obra, depois Score e Log).
- Atualizar PRD, SPEC e "Decisões" do PLAN no mesmo PR de cada mudança de regra.
