# PLAN — CONTRO · plano de implementação por milestones

Versão 1.1 · 24/10/2026 · referência: PRD.md, SPEC.md, CLAUDE.md, protótipo aprovado.

Cada milestone entrega algo **utilizável e testável**. Só avance quando os critérios de aceite estiverem verdes. Marque `[x]` ao concluir e registre desvios em **Decisões** (fim do arquivo).

| Milestone | Entrega | Depende de |
|---|---|---|
| M0 | Fundação: repo, stack, design system, login, deploy | — |
| M1 | Modelos de obra (celular, só gestor) e motor de cronograma | M0 |
| M2 | Obra: criar a partir do modelo, carteira, fases e conclusão com foto | M1 |
| M3 | Lembretes de providência e liberação de atividades | M2 |
| M4 | Pendências: fila, adiar, lista e vistoria antes/depois | M2 |
| M5 | Cronograma (Gantt), indicadores e inauguração | M3 |
| M6 | Tarefas: criar, concluir, reabrir, editar e replanejar | M3 |
| M7 | Reunião semanal e ata | M5, M6 |
| M8 | Boletim semanal: WhatsApp e PDF | M5, M6 |
| M9 | Offline completo, gamificação e endurecimento | M2–M8 |
| M10 | Piloto em uma obra e ajustes | M9 |

Melhorias fora do plano principal (só começam com aprovação do usuário): **E1 · Maquete 3D gamificada**.

---

## M0 · Fundação
**Objetivo:** projeto rodando ponta a ponta com login e o visual CONTRO.

- [x] Monorepo pnpm (`apps/web`, `apps/pdf-service`, `packages/core`, `packages/ui`, `supabase`)
- [x] Vite + React + TS + PWA (manifest, ícone provisório CONTRO, service worker)
- [x] Tokens CONTRO em `packages/ui` (cores, raios, Nunito Sans self-hosted, vermelho só como `--contro-late`)
- [x] Componentes base: Botão (primário, secundário, terciário), Chip, Card, BottomSheet, Toast com "Desfazer", TabBar, Input, Segmented
- [x] Supabase: projeto criado e **Auth e-mail/senha validado de ponta a ponta** (login logado e logout funcionando com o projeto `oaslrtizvfornxjuxpgp`). Falta só o 2º projeto (homologação)
- [x] Tabelas `pessoa` (perfil gestor | equipe), `unidade`, `sugestao` + RLS — migration, políticas, seed e teste pgTAP **aplicados no projeto**
- [x] CI: lint, typecheck, vitest, build — **verde** (GitHub Actions; repo tornado público). Deploy de preview por PR ainda requer ligar a Vercel
- [~] Sentry no web — código pronto (inerte sem DSN); falta o usuário fornecer o DSN
- [x] Importar o símbolo vetorial aprovado da pasta do projeto CONTRO (ícone do app, favicon, cabeçalho)

**Aceite:** login no celular, PWA instalável, tela vazia "Minhas obras" no padrão CONTRO, CI verde.

> **Aceite do M0 validado em 24/10/2026:** login logado de ponta a ponta no app contra o Supabase real, tela "Minhas obras" no padrão CONTRO, logout, CI verde. Migrations + RLS + seed aplicados; usuário de teste `engenheiro@contro.dev` (gestor).
>
> **Ainda pendente (não bloqueia o M0):** 2º projeto Supabase (homologação), ligar a Vercel ao repo para preview por PR, e DSN do Sentry.
>
> **Débitos técnicos do M0 (resolver antes do M1):**
> - Rodar o teste de RLS (pgTAP) no CI — exige subir o Supabase local (Docker) na pipeline; por ora o teste roda localmente com `supabase test db`.
> - BottomSheet: focus-trap completo (hoje há foco inicial, retorno e trava de scroll; falta prender o Tab dentro do sheet).
> - Vetorizar o símbolo aprovado (hoje é raster embutido em SVG) e unificar a fonte dos assets de marca.

## M1 · Modelos de obra e motor de cronograma
**Objetivo:** o gestor mantém vários modelos de obra, e o core calcula o cronograma de qualquer obra.

- [x] `core/calendar.ts`: `addDU`, `duEntre` em dias úteis de segunda a sexta (**sem feriados**)
- [x] `core/schedule.ts`: forward pass (ES/EF), backward pass (LS, folga, crítico), datas a partir do início e entrega
- [x] Subitens: `dur()` pelo vão (sequência ou paralelo) e `inicio_manual` no forward pass
- [x] Testes: Modelo 1 (28 atividades, total 54 du), Modelo 2 e Modelo 3 derivados, ciclo rejeitado, subitens de Demolições (5 du), início manual empurrando as sucessoras, dependência múltipla
- [x] Migrations `modelo`, `modelo_fase`, `modelo_atividade`, `modelo_dependencia`, `modelo_providencia` + RLS (só gestor escreve; equipe lê)
- [x] `core/schedule.ts` por ordenação topológica (dependência entre quaisquer fases) e detecção de ciclo
- [x] Seed dos modelos 1 (CDC completo), 2 (CDC sem vestiários) e 3 (Retrofit leve) a partir do Anexo A
- [x] Tela **Modelos** (celular, só gestor): lista com nome, subtítulo, dias e uso; novo (cópia ou em branco), duplicar, renomear nome/subtítulo, excluir com Desfazer
- [x] **Assistente de atividade** em 5 passos (nome com sugestões, prazo, começa depois de com abas por fase e busca, providências, revisão); editar abre na revisão
- [~] Tela `/modelo` (desktop, complementar): tabela por fase com Gantt e caminho crítico, aberta por "Ver tabela completa com Gantt" na tela do modelo; criar/renomear fase, duração − / +, ligar/desligar predecessora e excluir atividade na tabela; subitens, providências padrão e excluir fase pelo fluxo do celular (assistente e folha da fase):
  - tabela por fase;
  - **fases:** renomear (clique no nome), criar e excluir (confirmação com a contagem de atividades + "Desfazer");
  - **subitens:** incluir, renomear, prazo − / +, em sequência ou em paralelo, remover; prazo do pai calculado;
  - duração − / +;
  - ligar e desligar predecessora (qualquer fase, sem ciclo);
  - incluir e remover atividade;
  - providências padrão (incluir, remover, antecedência);
  - Gantt com caminho crítico;
  - destaque de predecessoras e sucessoras
- [ ] Substituir os prazos provisórios pelo histórico real (Q6); o usuário ajusta direto no editor do Modelo

**Aceite:** no celular, o gestor duplica o Modelo 1 como "Modelo 4 · CDC sem vestiários", inclui uma atividade com 3 subitens ligada a uma atividade de outra fase e vê prazo, total e folga recalcularem na hora. A lista de predecessoras não oferece quem depende da atividade. Uma obra criada antes continua igual. No perfil Equipe de obra, a tela Modelos não aparece e a escrita é recusada pela RLS.

> **Marcado em 26/10/2026 (arrumação do PLAN):** os itens do M1 já estavam implementados e testados (motor em `packages/core`, `anexoA.test.ts`, migrations e seed dos Modelos 1–3), só não tinham sido marcados. Segue aberto o Q6 (prazos reais).

## M2 · Obra: criar, carteira, fases e conclusão com foto
**Objetivo:** o engenheiro cria a obra em < 2 min e conclui atividades com foto.

- [x] Migrations `obra`, `obra_atividade`, `obra_dependencia`, `foto` + RLS por perfil e vínculo
- [x] `gerar_obra` (Edge Function, transacional): copia o modelo escolhido e grava `modelo_rotulo`
- [x] Tela **Nova obra**: unidade, segundas disponíveis, **escolha do modelo** e prévia (atividades, lembretes, dias úteis, fases com datas, entrega)
- [x] **Carteira:**
  - título com ícone "+";
  - atalhos Reunião e Tarefas (placeholders até M6/M7);
  - card da obra (fase, %, 6 segmentos, ritmo, entrega, aviso de atraso)
- [x] **Cabeçalho da obra:** nome, "Dia N de M", %, barra e ícone de boletim (placeholder até M8)
- [x] **Fases:**
  - trilha com 6 fases e estados;
  - expandir fase;
  - itens com estado e motivo de bloqueio
- [x] **Ficha da atividade** (bottom sheet): situação, datas, prestador (texto opcional, com sugestões), depende de / libera
- [x] **Subitens** na ficha: checklist com prazo; marcar sem foto obrigatória; a atividade só conclui com todos marcados
- [x] **Ajustar início** (manual): escolher a nova data; as sucessoras recalculam; o evento é registrado
- [x] Câmera de conclusão (captura, compressão, upload em segundo plano) → `concluir_atividade` (exige liberada)
- [x] Celebração de fase concluída com o que foi liberado
- [x] Toast "liberou X" ao concluir

**Aceite:** criar a obra "CDC Sete Lagoas", concluir Mobilização com 3 fotos, ver a celebração e a Fase 2 liberada. O tempo de criação da obra fica abaixo de 2 minutos.

> **M2 validado (24/10/2026):** criei "CDC Sete Lagoas" do Modelo 1 em segundos; a Carteira e a tela da obra mostram fase/%/ritmo via core; na ficha, marcar a providência liberou a atividade e habilitou "Concluir com foto"; upload de foto como gestor retornou 200; `concluir_atividade` testado no servidor (exige liberada + foto, +XP, evento). **Decisão:** `gerar_obra` e os RPCs de campo são funções Postgres (não Edge Function). **Lacunas:** a captura da câmera não é testável no navegador automatizado (precisa de aparelho); a celebração de fase é um toast (pode virar tela depois).

## M3 · Lembretes de providência e liberação
**Objetivo:** nada trava por falta de contratação, locação ou compra.

- [x] Migration `obra_providencia` + RLS (compras pode alterar o status)
- [x] `core/providencias.ts`: limite, providenciar até, na obra em, atrasada
- [x] Liberação = predecessoras + providências (`core`), com testes
- [x] Aba **Providências:** grupos Atrasados (vermelho) e A providenciar, "Marcar como providenciado" e o contador de já providenciados
- [x] Na ficha da atividade: lista "Para começar" com + Contratação / + Locação / + Compra
- [x] Formulário do lembrete: tipo, o que, precisa estar na obra em (padrão: início da atividade), situação. **Sem valor e sem fornecedor**
- [x] Badge vermelho de lembretes atrasados na aba

**Aceite:** marcar "Porcelanato e argamassa" como providenciado libera "Revestimento cerâmico" na hora, com o toast "liberou…". Um lembrete vencido aparece em vermelho com "era para providenciar até…".

> **M3 concluído e mergeado em 24/10/2026 (PR #4).** Revisão independente aplicada: helper único `classificarProvidencias` (aba + badge), "Desfazer" ao remover lembrete (regra 10), ícone SVG no remover. Fix de segurança: `obra_providencia.manual` imutável (trigger) — impede flipar `manual` e deletar bloqueio do modelo. Scope extra do M3 (`+ lembrete` / remover na ficha) é previsto no próprio checklist. CI verde.

## M4 · Pendências
**Objetivo:** pendência registrada com foto, resolvida com antes e depois, sem nada se perder.

- [x] Migrations `pendencia`, `pendencia_evento` + RLS
- [x] Apontar (ícone de câmera): foto → título, local, criticidade e atividade
- [x] **Fila:** deck com swipe (limiar de 100 px, rotação, selos RESOLVIDA/ADIAR) e botões equivalentes
- [x] **Resolver:** câmera com o **ghost do antes** (40%) → em vistoria
- [x] **Adiar:** sheet com data de retorno (4 opções) e motivo (4 opções) → sai da fila; toast com "Desfazer"
- [x] **Lista completa:** Na fila ("Resolver agora"), Adiadas ("Trazer para a fila"), Em vistoria, Concluídas
- [x] **Vistoria:** antes e depois lado a lado, Aprovar / Reabrir; bloquear quando o vistoriador é quem resolveu
- [x] Cron diário: devolver adiadas vencidas à fila

**Aceite:** adiar até ter 27/10 com "aguardando material" → a pendência some da fila e aparece em Adiadas; Desfazer devolve. Quem resolveu não consegue aprovar a própria vistoria.

> **M4 concluído e mergeado em 24/10/2026 (PR #6).** Escrita só por RPC (regra 5 no servidor), core/pendencias testado, UI completa (deck de swipe, câmera com ghost + fallback, adiar com Desfazer, vistoria). Revisão independente: sem achados críticos/altos; aplicados ajustes baixos (valida atividade da obra, limpa motivo stale, reseta motivo na vistoria). Desvio aceito: ações não-otimistas (otimismo/offline no M9). Débito: paginar "Concluídas"; E2E real da câmera; aplicar a migration no Supabase. CI verde.

## M5 · Cronograma, indicadores e inauguração
**Objetivo:** ler a saúde da obra num olhar.

- [x] `core/indicadores.ts`: real, previsto hoje e sexta, ritmo em dias, atrasos (atividades e lembretes); `peso()` isolado (Q2)
- [x] Testes com os casos do protótipo (Eldorado 47%, 53%, −3 dias; Pampulha; Betim)
- [x] Aba **Cronograma:** Gantt por fase, linha de hoje, cores por estado, detalhe ao tocar (situação, prestador, lembretes, depende de, libera)
- [x] Carteira e cabeçalho com os indicadores reais
- [x] **Tarja Inauguração** no fim da trilha de fases: data por extenso, dias úteis restantes e atraso do ritmo
- [x] Editar o cronograma da obra (duração e predecessoras da cópia), gestor e equipe de obra

**Aceite:** os números batem com os casos de teste; a tarja mostra a data correta e acompanha os ajustes manuais de início.

> **M5 concluído e mergeado em 24/10/2026 (PR #7).** As fórmulas já estavam no core (M2); adicionado `core/indicadores.ts` (texto do ritmo, dias úteis restantes) e os casos do protótipo (Eldorado 47/53/−3 exatos). Gantt por fase com linha de hoje; tarja de Inauguração enriquecida; editar duração/predecessoras na ficha + trigger anti-ciclo em `obra_dependencia`. Revisão: sem críticos/altos; aplicados ajustes (token `--contro-bg-app`, 44px e a11y no Gantt, duração só sem subitens, coerência de obra). Desfazer em edições fica p/ M9. CI verde.

## M6 · Tarefas
**Objetivo:** quem faz o quê, até quando, com baixa ao longo da semana.

- [x] Migrations `tarefa`, `tarefa_evento` + RLS (o responsável conclui e edita o texto; qualquer perfil pode trocar o responsável, com evento registrado)
- [x] Tela **Tarefas:**
  - filtro por pessoa com o contador de atrasadas;
  - grupos Atrasadas, Abertas e Concluídas;
  - vínculo exibido
- [x] **Concluir** (um toque) com "Desfazer". Efeitos do vínculo:
  - lembrete → providenciado (grava o efeito);
  - atividade → câmera
- [x] **Reabrir** (botão e toque no check). Desfaz o efeito no lembrete se a atividade não foi concluída
- [x] **Editar** (sheet): texto, responsável, prazo (atalhos ou dd/mm com validação), situação; excluir com "Desfazer"
- [x] **Replanejamento:** `prazo_original` e `replanejamentos`; exibir "Replanejada Nx · prazo original…"
- [x] Atalho Tarefas na carteira com abertas e atrasadas

**Aceite:** concluir "Garantir porcelanato…" libera o revestimento; reabrir faz o lembrete voltar para "a providenciar"; mudar o prazo de 21/10 para 03/11 mostra "Replanejada 1x · prazo original qua 21/10".

> **M6 concluído e mergeado em 25/10/2026 (PR #8).** core/tarefas testado; escrita só por RPC (replanejamento regra 8, efeitos de vínculo com guard de obra); tela de Tarefas (filtro por pessoa, grupos, concluir/reabrir com Desfazer, câmera no vínculo de atividade, editar/excluir com Desfazer) + atalho na carteira. Revisão: sem críticos/altos; aplicados ajustes (44px no check, regra 1 na contagem, erro no salvar). Desfazer em edição fica p/ M9. CI verde.

## M7 · Reunião semanal e ata
**Objetivo:** a reunião de segunda às 16h acontece dentro do app e gera a ata.

- [x] Migrations `reuniao`, `reuniao_obra` + cron (segunda 15:30 cria a pauta)
- [x] `core/semana.ts`: semana passada previsto x realizado (com motivo), esta semana (concluir, começar, providenciar)
- [x] Tela **Reunião:** KPIs. Card por obra com:
  - faixa **cinza #4A4A4A**;
  - semana passada;
  - ~~providências anteriores~~ (débito: precisa da reunião anterior);
  - esta semana;
  - observações;
  - novas providências
- [x] **Nova providência:** sugestões automáticas da obra (lembretes atrasados e da semana, atividades atrasadas) com vínculo; responsável; prazo; editar e excluir pelas mesmas regras do M6
- [x] **Fechar reunião** → snapshot por obra → **Ata** (obra a obra + compilado por responsável)
- [x] Ata no WhatsApp (`wa.me`) e ~~PDF (pdf-service)~~ → **PDF via HTML imprimível** (decisão do usuário; pdf-service como débito de infra)

**Aceite:** com 3 obras, a pauta abre pronta; registrar 6 providências em menos de 15 minutos; fechar gera a ata em PDF idêntica ao modelo aprovado (cinza na faixa, vermelho só no que está atrasado).

> **M7 concluído e mergeado em 25/10/2026 (PR #9).** core/semana + core/atribuicoes + core/ata (76 testes). Reunião (abrir/observação/fechar só gestor → snapshot), nova providência/tarefa com sugestões e vínculo, ata HTML imprimível + WhatsApp + "Quem faz o quê" por responsável. Revisão: sem críticos/altos; 4 rounds de segurança na migration (reunião fechada imutável, FOR UPDATE/TOCTOU, abrir_reuniao idempotente e sem mutar ata fechada). Débitos: pdf-service Playwright; "providências anteriores" (reunião anterior). CI verde.

## M8 · Boletim semanal
**Objetivo:** todo grupo de obra recebe o resumo da semana em um toque.

- [x] `core/atribuicoes.ts` (SPEC 4.7, feito no M7) e `core/boletim.ts` (texto do WhatsApp, SPEC 8.1), com testes
- [x] Tela **Boletim** (ícone no cabeçalho da obra):
  - Atenção;
  - Quem faz o quê;
  - prévia da mensagem;
  - botões **WhatsApp** e **Baixar PDF** (imprimir do navegador)
- [ ] ~~pdf-service: template do boletim (SPEC 8.2)~~ → **débito** (HTML imprimível por ora, decisão do M7)
- [x] ~~Cron segunda 06:30 / sexta 17:00 + push~~ → **débito de infra** (push web VAPID/FCM) — push ligado em 28/10/2026 (ver Decisões, "Reunião e avisos por push")
- [x] Truncar o texto do WhatsApp acima de ~4.000 caracteres, remetendo ao PDF

**Aceite:** às 07:00 de segunda o engenheiro abre o boletim, toca em WhatsApp, escolhe o grupo e envia. O PDF tem 3 páginas no máximo para uma obra típica.

> **M8 concluído e mergeado em 25/10/2026 (PR #10).** core/boletim (texto WhatsApp §8.1 + truncagem, 79 testes); tela Boletim ao vivo (Atenção, Quem faz o quê por responsável, prévia) + WhatsApp + Imprimir/PDF, pelo ícone no cabeçalho da obra. Revisão: sem críticos/altos; aplicados fuso UTC na semana + guard de truncagem. Débitos: pdf-service, cron+push, §4.7 fontes engenheiro/compras (decisão de produto). CI verde.

## M9 · Prontidão para o piloto (pivô) + endurecimento leve
**Objetivo:** destravar o piloto real (deploy, homologação, go-live) e polir o que for verificável.

> **Pivô (25/10/2026, decisão do usuário):** a **fila offline Dexie + idempotência + conflitos** é um bloco grande e não verificável sem E2E/dispositivo — vira um **milestone dedicado futuro** (M9-offline), não entra agora. O M9 passa a focar no que destrava o piloto.

- [x] **Guia de go-live** (`DEPLOY.md`): Vercel (PWA) + Supabase (aplicar migrations M0–M8, env, bucket de fotos, pg_cron, criar gestor) + variáveis
- [x] **README** do projeto (visão, stack, scripts, estrutura)
- [x] **Checklist de prontidão** (`PILOTO.md`): o que está pronto por milestone, débitos e bloqueadores de go-live
- [~] Acessibilidade: `:focus-visible` global já existe; swipe com botões equivalentes. Conquistas/celebração de fase não feitas (gamificação fica para depois)

> **M9 (pivô) concluído e mergeado em 25/10/2026 (PR #11).** DEPLOY.md (go-live Supabase+Vercel), README.md, PILOTO.md (prontidão + débitos) e vercel.json. Revisão do guia: corrigidos a contagem de migrations (22), a ordem do pg_cron e o escopo do db:reset. A fila offline é o M9-offline (dedicado). CI verde.

**Deferido para o M9-offline (dedicado):** fila offline Dexie com `client_op_id` idempotente; upload de foto em 2º plano com retomada; indicador "x aguardando sinal"; conflitos last-write-wins; E2E completos (SPEC 12); testes de RLS por perfil no CI; performance/Lighthouse ≥ 90.

**Aceite:** com o `DEPLOY.md`, dá para subir o app na Vercel e o banco no Supabase e fazer login numa obra real; o `PILOTO.md` lista o que falta para o go-live.

## M10 · Piloto
**Objetivo:** uma obra real do início ao fim no CONTRO.

- [ ] Criar a obra piloto (a equipe se cadastra pelo uso, com sugestões)
- [ ] Treinamento de 30 minutos (gestor e equipe de obra)
- [ ] 4 semanas de uso com reunião e boletim pelo app
- [ ] Medir as métricas do PRD §3 e coletar ajustes
- [ ] Decidir as questões em aberto Q2 (peso do %) e Q4 (prestador)

**Aceite:** 4 boletins e 4 atas gerados pelo app; ≥ 70% das providências cumpridas no prazo; 100% das atividades concluídas com foto.

## M11 · Fidelidade ao protótipo aprovado
**Objetivo:** as telas do app ficam iguais ao protótipo aprovado (`prototipo/Main.dc.html` e `ModeloCel.dc.html`): visual, navegação e textos. Regras e dados não mudam; os textos derivados saem do core.

- [x] Core: `trilhaDeFases` (status, etiqueta e textos de fase e atividade da trilha) com testes
- [x] Obra: cabeçalho preto (nome, "Dia N de M do modelo", %, boletim, barra) e barra inferior Fases · Pendências · Providências · Cronograma com contadores
- [x] Obra: trilha de fases (nós com linha, etiqueta "Fase N · status", cartões de atividade com câmera e prestador, tarja de Inauguração)
- [x] Início (gestor e equipe): cabeçalho preto com "Modelos" (só gestor) e ícone de perfil (painel com nome, perfil, Boletim automático, Aprovar membros e Sair), blocos Reunião e Tarefas, cartões das obras
- [x] Tarefas: tela geral (todas as obras) aberta pelo bloco do início
- [x] Obra: Pendências (fila com cartão e lista completa), vistoria e adiar
- [x] Obra: Providências, Cronograma e Boletim
- [x] Nova obra
- [x] Reunião e ata
- [x] Folhas: ficha da atividade, câmera, celebração de fase e toast
- [x] Modelos no celular (ModeloCel)

**Aceite:** lado a lado com o protótipo, cada tela tem a mesma estrutura, hierarquia, cores e textos; a única diferença intencional é a maquete (E1) omitida.

> **M11 concluído em 26/10/2026 (PRs #39 a #45).** Todas as telas do app de campo e dos modelos no celular refeitas pelo protótipo, conferidas por captura em 390 px numa prévia local (sem Docker para o banco local). Textos derivados novos no core: `trilhaDeFases`, `faixasDeFases`, `opcoesAdiamento`, `pendenteHa`, `resumoReuniao`, `previaAtividadeModelo`.

---

## Boletim automático (destrava o débito do M8)
**Objetivo:** o gestor configura quando o boletim é gerado (dia, hora, recorrência) e é avisado por push para enviar com um toque. Decisões do usuário: envio = **gerar + avisar** (sem API de WhatsApp, sem e-mail); escopo = **global** (um agendamento para todas as obras); aviso = **push**; recorrência = semanal (dia + hora) com edição de fechamento opcional.

**Fatia 1 · Configuração (base)**
- [x] Migration `config_boletim` (linha única global) + RLS (membro lê, só gestor edita) + teste pgTAP
- [x] `core/boletimAgenda.ts` — validação + `proximoDisparo` (puro, 9 testes)
- [x] Tela **Boletim automático** (aba Mais, só gestor): liga/desliga, dia, hora, fechamento opcional, "próximo envio" e Desfazer
- [ ] Aplicar a migration no Supabase remoto (ação do usuário) para o save funcionar no piloto

**Fatia 2 · Geração agendada (backend)**
- [x] Tabela `boletim_disparo` (marcador por obra/semana/edição, dedup único) + RLS (membro lê, gestor marca enviado)
- [x] `gerar_disparos_boletim(p_agora)` — no horário (fuso America/Sao_Paulo) cria os disparos das obras ativas, idempotente; teste pgTAP (horário, dedup, obra ativa só, fechamento)
- [x] pg_cron `*/15 * * * *` chama a função (ela checa o horário por dentro)
- Decisão de arquitetura: o texto/snapshot do boletim é calculado no **cliente** (core, como na tela Boletim), então a função só marca "está na hora". Sem Edge Function/compute server-side de texto nesta fatia.

**Fatia 3 · Enviar (lista in-app + push)** (push precisa de VAPID + Edge Function)
- [x] Lista "prontos para enviar" no Início (só gestor) a partir de `boletim_disparo` → "Abrir" abre o boletim da obra (já calculado no cliente) e "Enviado" marca com Desfazer (regra 10). Verificado no app (local) de ponta a ponta.
- [x] (código) Service worker com handler de push/notificationclick via `importScripts` (offline intacto); permissão + assinatura; tabela `push_subscription` + RLS + pgTAP
- [x] (código) Edge Function `enviar-push-boletim` (lê disparos não notificados, envia e marca); toggle "Receber aviso por push" na tela do gestor
- [ ] **Deploy (ação do usuário):** gerar VAPID, `VITE_VAPID_PUBLIC_KEY` na Vercel, segredos + deploy da função, agendar pg_cron+pg_net — runbook em `supabase/functions/enviar-push-boletim/README.md`
- [ ] Ressalva iOS: push só com o PWA instalado na tela inicial (16.4+)

**Aceite:** no dia/hora configurado pelo gestor, o boletim de cada obra ativa é gerado e o gestor recebe um push; ele toca e o WhatsApp abre com o texto pronto.

---

## Ações do dia (04/11/2026)
Tarefa e pendência viram "ação"; um push por pessoa e um da equipe para o gestor. Spec: `docs/superpowers/specs/2026-11-04-acoes-do-dia-design.md` · plano: `docs/superpowers/plans/2026-11-04-acoes-do-dia.md` · protótipos: [telas](https://claude.ai/artifact/JeSVVNoHoYFxexKh9exjJH) e [fluxo](https://claude.ai/artifact/ENLyqf2QeGbmmS76VUPXU4).
- [x] 1. Regra de domínio `acoes.ts` no core (`Acao`, `prazoPendencia`, `estadoAcao`, `classificarAcoes`, resumos e textos).
- [x] 2. Hoje (`agendaDia.ts`) passa a receber ações (item `'acao'`).
- [x] 3. Tokens (`--contro-attention`, `--contro-late-bg`), ícones e CLAUDE.md.
- [x] 4. Migration `20261104100000_acoes_do_dia.sql`, `gerar_avisos` (`acoes`, `acoes_equipe`) e pgTAP.
- [x] 5. Tela Avisos do gestor: bloco "Ações do dia" (hora e três prazos).
- [x] 6. Adaptador `acoesObra.ts` e hooks `useAcoesDasObras` e `usePendenciasDasObras`.
- [x] 7. Tarefas da equipe e Minhas ações com quatro seções (`CardAcao`).
- [x] 8. Tela inicial e cards de obra contam ações.
- [x] 9. Boletim com pendências em "Quem faz o quê".
- [x] 10. Documentação: PRD, SPEC e PLAN.
- [x] 11. Verificação final e PR (#111).

---

## Providências como ações (04/11/2026)
Providência pendente sem dono vira ação da equipe; o gestor atribui responsável. Spec: `docs/superpowers/specs/2026-11-04-providencias-como-acoes-design.md` · plano: `docs/superpowers/plans/2026-11-04-providencias-como-acoes.md`.
- [x] 1. Core: `OrigemAcao` com `'providencia'` e `providenciaParaAcaoBase`.
- [x] 2. Migration `20261104200000_providencia_prazo.sql` (`providenciar_ate`, RPC, `gerar_avisos`) e pgTAP.
- [x] 3. Regra `providenciasSemDono`, contadores, Hoje e gravação dos prazos.
- [x] 4. Tarefas da equipe: chip "Sem responsável", folha "Atribuir providência" e aba Providências.
- [x] 5. Documentação: PRD, SPEC e PLAN.
- [x] 6. Verificação final e PR.

---

## Score e Log (04/11/2026)
Menu inferior com Score e Log, histórico das mudanças com Vida do item e pontuação por nome. Spec: `docs/superpowers/specs/2026-11-04-score-e-log-design.md` · plano: `docs/superpowers/plans/2026-11-04-score-e-log.md`.
- [x] 1. Core: `log.ts`, `nomes.ts` e testes.
- [x] 2. Core: `score.ts` e testes.
- [x] 3. Migration `20261104300000_log_score.sql` (índices e `p_motivo`) e pgTAP.
- [x] 4. Web: carregador, menu inferior `NavInferior`, telas Log e Vida do item, motivo ao replanejar.
- [x] 5. Web: tela Score e detalhe.
- [x] 6. Documentação: PRD, SPEC, PLAN e CLAUDE.
- [x] 7. Verificação final e PR.

---

## Próximos 5 dias (04/11/2026)
As listas de ações mostram só o que vence de amanhã até 4 d.u. depois. Spec: `docs/superpowers/specs/2026-11-04-proximos-5-dias-design.md`.
- [x] 1. Core e web: `classificarAcoes` com `proximosDU` (padrão 5) e `depois`; seção "Próximos 5 dias" e resumo.
- [x] 2. Documentação: PRD, SPEC e PLAN.

## Item do Mapa de coleta (04/11/2026)
Botão "Adicionar item do mapa" na fase Mapa de coleta da obra. Spec: `docs/superpowers/specs/2026-11-04-item-do-mapa-design.md`.
- [x] 1. Migration `20261104400000_adicionar_mapa.sql` (RPC `adicionar_mapa_obra`) e pgTAP.
- [x] 2. Web: `NovoMapaSheet`, `novoMapa` no hook, botão só no Mapa de coleta, Desfazer.
- [x] 3. Documentação, verificação final e PR.

## Atividades como ações (04/11/2026)
Atividade sem tarefa vinculada aberta vira ação "Sem responsável"; o gestor atribui quem cuida. Spec: `docs/superpowers/specs/2026-11-04-atividades-como-acoes-design.md`.
- [x] 1. Core: `atividadesAcoes.ts`, `OrigemAcao` com `'atividade'`, `atividadeParaAcaoBase` e `comTarefa` na agenda.
- [x] 2. Migration `20261104500000_atividade_prazo.sql` (`fim_previsto_calc`, RPC, `gerar_avisos`) e pgTAP.
- [x] 3. Web: `listarObras`, contadores, `useAcoesDasObras` e `CardAcao` da atividade.
- [x] 4. Tarefas da equipe: folha "Atribuir atividade" e "Quem cuida" na ficha.
- [x] 5. Documentação: PRD, SPEC e PLAN.
- [x] 6. Verificação final e PR.

---

## Obras gerais · Etapa 1 · ambientes e acesso (05/11/2026)
Primeira de 5 etapas de Obras gerais (obras que não são da Contorno, com pessoas e acesso por obra). Esta etapa entrega só ambientes e acesso; a obra geral por dentro vem depois. Spec: `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` · plano: `docs/superpowers/plans/2026-11-05-obras-gerais-1-ambientes-e-acesso.md`.
- [x] 1. Core: `ambiente.ts` (ambientes da pessoa) e testes.
- [x] 2. Migration `20261105200000_obras_gerais_acesso.sql`: `obra.ambiente` e `cidade`, `pessoa` (administrador, acesso_contorno, papel_geral), `obra_participante`, `convite_geral` e funções de acesso.
- [x] 3. Migration `20261105220000_obras_gerais_rls.sql`: RLS por obra, gatilho `a_guarda_obra` e Storage.
- [x] 4. Migration `20261105230000_obras_gerais_rotinas.sql`: avisos, boletim e reunião só olham a Contorno.
- [x] 5. Migration `20261105240000_obras_gerais_rpcs.sql`: criar obra geral, dar acesso e convite por e-mail.
- [x] 6. Web: ambiente atual (`useAmbiente`), troca no perfil e Contorno filtrada.
- [x] 7. Web: `ObrasGeraisInicio` e nova obra geral.
- [x] 8. Web: "Pessoas e acessos" de Obras gerais.
- [x] 9. Documentação: PRD, SPEC, PLAN e CLAUDE.

**Próximas etapas** (cada uma com plano próprio, escrito depois que a anterior entra na `main`):
- ~~Etapa 3: menu de baixo, Hoje, Ações da equipe, avisos (push) e eficiência~~ → entregue (ver "Obras gerais · Etapa 3").
- ~~Etapa 4: reunião, ata, pendências (Check list) e boletim por obra, com "+ lembrete de providência" e "+ nota" na nova atividade, e Reunião e avisos por obra~~ → entregue (ver "Obras gerais · Etapa 4"; "+ nota" saiu do escopo).
- ~~Etapa 5: Score e Log por participação, menu de baixo completo e sugestões separadas por ambiente~~ → entregue (ver "Obras gerais · Etapa 5").

---

## Obras gerais · Etapa 2 · a obra geral por dentro (06/11/2026)
Segunda de 5 etapas. Entrega a obra geral por dentro: trilha de fases e atividades com data prevista, subitens, ficha, quem planeja × Membro e Pessoas da obra. Spec: `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` · plano: `docs/superpowers/plans/2026-11-06-obras-gerais-2-obra-por-dentro.md`.
- [x] 1. Core: `obraGeral.ts` (trilha, status, resumo, atalhos de data, `podePlanejarObraGeral`) e testes.
- [x] 2. Migration `20261106100000_obras_gerais_planejamento.sql`: colunas de data e responsável, `contro_planeja_obra`, RLS de planejamento, trigger de proteção e RPCs de planejamento.
- [x] 3. Migration `20261106110000_obras_gerais_campo.sql`: RPCs de campo para quem participa da obra.
- [x] 4. Migration `20261106120000_obras_gerais_pessoas_da_obra.sql`: adicionar, convidar e remover pessoas da obra.
- [x] 5. Web: carregar a obra geral (`useObraGeral`) e separar o rodapé de avanço.
- [x] 6. Web: `ObraGeralDetalhe` com trilha, fases e troca de obra.
- [x] 7. Web: `FichaAtividadeGeral` e edição de subitem.
- [x] 8. Web: `NovaAtividadeGeralSheet` com data prevista e subitens.
- [x] 9. Web: `PessoasDaObra` para o Coordenador.
- [x] 10. Documentação: PRD, SPEC, PLAN e CLAUDE.
- [x] 11. Correção: excluir subitem na ficha da Contorno (migration `20261106130000_excluir_subitem.sql`).

**Próximas etapas:** etapas 4 e 5, listadas em "Obras gerais · Etapa 1".

---

## Obras gerais · Etapa 3 · Hoje, Ações da equipe e avisos (06/11/2026)
Terceira de 5 etapas. Entrega o dia a dia da Contorno nas Obras gerais: menu de baixo, aba Hoje, bloco e tela Ações da equipe por obra, "% no prazo" da obra e avisos por push. Spec: `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` · plano: `docs/superpowers/plans/2026-11-06-obras-gerais-3-hoje-acoes-avisos.md`.
- [x] 1. Core: `agendaObraGeral`, `detalheItemGeral`, `acoesDaObraGeral`, `eficienciaObraGeral`, `textoEficiencia` e `textoAcoesBloco` em `obraGeral.ts`, com testes.
- [x] 2. Migration `20261106200000_obras_gerais_avisos.sql`: tipos `acoes_geral` e `equipe_geral`, gatilho de aviso de atribuição e nova data, aviso de saída da obra e `gerar_avisos_gerais` com o cron `avisos-gerais` (teste pgTAP `obras_gerais_avisos.test.sql`).
- [x] 3. Web: `carregarResumoObrasGerais` e `useResumoObrasGerais` (uma consulta por tabela, sem N+1).
- [x] 4. Web: `ObrasGeraisCasca`, `NavGeral` e `HojeGeral`; `?ir=geral-hoje` abre o Hoje de Obras gerais; estado de erro na `ObraGeralDetalhe`.
- [x] 5. Web: `BlocoAcoesGeral`, `AcoesObraGeral` e "% no prazo".
- [x] 6. Documentação: PRD, SPEC e PLAN.

**Próximas etapas:** etapas 4 e 5, listadas em "Obras gerais · Etapa 1".

---

## Obras gerais · Etapa 4 · reunião, Check list, providências e boletim por obra (06/11/2026)
Quarta de 5 etapas. Leva às Obras gerais o ciclo semanal da Contorno, por obra: reunião com pauta, ata e tarefas; Check list com antes e depois; lembretes de providência; boletim (WhatsApp, PDF e automático); "Reunião e avisos" da obra; e Ações da equipe com tarefas, pendências e providências. Spec: `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` · plano: `docs/superpowers/plans/2026-11-06-obras-gerais-4-reuniao-checklist-boletim.md`.
- [x] 1. Core: `obraGeralSemana.ts` (`semanaDaReuniaoGeral`, `montarBoletimGeral`, `providenciarAteGeral`, `situacaoProvidenciaGeral`, `entraNaCobrancaGeral`), com testes.
- [x] 2. Migration `20261106300000_obras_gerais_reuniao.sql`: reunião por obra geral (`reuniao.obra_id`, `abrir_reuniao_geral`, fechar/reabrir/responder abertos à obra), teste pgTAP.
- [x] 3. Migration `20261106310000_obras_gerais_tarefas_pendencias.sql`: tarefas e pendências abertas às obras gerais, teste pgTAP.
- [x] 4. Migration `20261106320000_obras_gerais_avisos_obra.sql`: `config_avisos_obra`, prazo da pendência e da providência por obra, `gerar_avisos_gerais` com as ações completas e os lembretes de reunião por obra, teste pgTAP.
- [x] 5. Migration `20261106330000_obras_gerais_boletim.sql`: `config_boletim_obra` e `gerar_disparos_boletim_geral`, teste pgTAP.
- [x] 6. Web: Reunião e avisos da obra, reunião da obra e Reuniões (Administrador); filtro `obra_id is null` na Contorno.
- [x] 7. Web: Check list e providências na obra geral ("+ lembrete de providência" na nova atividade).
- [x] 8. Web: boletim da obra geral, "Prontos para enviar" e boletim automático por obra.
- [x] 9. Web: Ações da equipe completas (`acoesCompletasObraGeral` no core; resumo, bloco, tela de ações e Hoje com tarefas, pendências e providências; boletim com a mesma lista) e documentação.

**Próximas etapas:** etapa 5, entregue (ver "Obras gerais · Etapa 5").

---

## Obras gerais · Etapa 5 · Score, Log, menu e sugestões por ambiente (06/11/2026)
Última das 5 etapas: **Obras gerais está concluída.** Entrega o Score e o Log por participação, o menu de baixo completo (Hoje · Obra · Score · Log), a Vida do item nas fichas gerais e as sugestões de autocompletar separadas por ambiente, com nome livre de responsável em tarefa. Spec: `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` · plano: `docs/superpowers/plans/2026-11-06-obras-gerais-5-score-log-sugestoes.md`.
- [x] 1. Migration `20261106400000_obras_gerais_sugestoes.sql`: `sugestao.ambiente`, RLS por ambiente, `salvar_tarefa` com nome livre em obra geral e `excluir_sugestao_prestador(p_nome, p_ambiente)`, teste pgTAP.
- [x] 2. Migration `20261106410000_obras_gerais_score_diario.sql`: histórico do Score por ambiente, teste pgTAP.
- [x] 3. Core: Score e Log das obras gerais, com testes.
- [x] 4. Web: dados do Log e do Score por ambiente e Vida do item.
- [x] 5. Web: menu Hoje · Obra · Score · Log e telas na casca de Obras gerais.
- [x] 6. Web: sugestões por ambiente (`useNomesSugeridos`, `CampoPrestador`), nome livre nas telas gerais, prestador com autocompletar na ficha da atividade geral e documentação.

**Ficou adiado:** desativar só a Contorno de quem tem os dois ambientes; texto de cadastro do convidado; evento ao remover participação; confirmar em produção a infraestrutura dos avisos; testes de Administrador sem acesso à Contorno (Score e sugestões); a normalização de nomes de sugestão ainda casa sugestões apagadas (cópia literal, por ambiente); sem "+ nota" na nova atividade.

---

## Melhorias (fora do plano principal)

### E1 · Maquete 3D gamificada (melhoria)
**Status:** em avaliação. Não iniciar sem aprovação do usuário.

**Objetivo:** cada obra tem a maquete da unidade que ganha forma e cor conforme as atividades são concluídas.

**Etapa 0 · Estudo de viabilidade (entrega: 1 página para decisão)**
- [ ] Comparar maquete padrão por modelo (sem IA) × maquete por unidade a partir do PDF (com IA)
- [ ] Medir a importação com IA em 2 executivos reais (ex.: Divinópolis 5 e Juiz de Fora): pranchas, chamadas, custo por unidade, acertos antes da conferência
- [ ] Verificar se o projetista entrega DWG ou IFC
- [ ] Estimar esforço de desenvolvimento e impacto em celulares simples
- [ ] Decisão do usuário: seguir, seguir só com maquete padrão, ou arquivar

**Etapa 1 · Implementação (se aprovada)**

- [ ] Core: `estadoPeca(peca, concluidas)` com os modos construir, remover, temporária e entre (testes)
- [ ] Maquete padrão CDC (seed) a partir do executivo de referência: casca, pilares, mezanino, apoio (vestiários, recepção, coworking, spa, personal), pista, fachada com pórtico
- [ ] Tela Maquete: Three.js, câmera orbital, vista completa/só térreo, girar, recentrar, legenda previsto/executado
- [ ] Toque na peça → card com atividade, status, quantidade do executivo e "Concluir com foto"
- [ ] Animação de montagem, foco de câmera, XP e celebração por fase; modo noite na entrega
- [ ] Linha do tempo (prévia de terreno a inauguração) sem alterar dados
- [ ] Importação de PDF do executivo (assistida) → proposta de peças → conferência do gestor
- [ ] Desempenho: 60 fps no aparelho de referência; maquete ≤ 2 MB

**Aceite:** numa obra com 12 atividades concluídas, a maquete mostra exatamente essas peças coloridas e o resto cinza. Concluir o forro com foto faz o forro e o ripado turquesa aparecerem com animação em < 1 s, +50 XP. Arrastar a linha do tempo até "Inauguração" mostra a unidade completa à noite, e "Voltar para hoje" restaura o estado real.

---

## Pré-avaliação da entrega (08/11/2026)

- [x] Tabelas, RLS, RPCs e lista dos 103 itens (`20261108100000_pre_avaliacao_entrega.sql`), com teste pgTAP.
- [x] Situação, nota projetada e comparação de revisões em `core/avaliacao.ts`, com testes.
- [x] Aba Avaliação: ambientes, Tirando ponto, Não com foto do antes virando pendência, revisões, histórico com quem fez, nota oficial e itens editáveis pelo Gestor.

**Aceite:** com 6 não conformes em 103 itens, a nota é 94,17% (igual ao PDF da Contorno); Não sem foto não cria pendência; item resolvido que volta a dar problema reabre a mesma pendência; obra geral não tem a aba nem acesso pelas RPCs.

---

## Decisões

- [x] **08/11/2026 · Pré-avaliação da entrega:** protótipo D aprovado pelo usuário. Sem "Não se aplica" e sem "marcar restantes"; os 6 documentos marcados como N/A no PDF da Prime São Bento ficaram fora da lista (base 1.030, como a Contorno). Lista editável pelo Gestor (recomendação aceita ao seguir sem objeção). "Não" exige foto do antes. Desvios do protótipo: o Não tem o botão "Criar pendência" (a pendência e a nota mudam ao criar, não ao tocar em Não); ao reabrir a mesma pendência mantém-se a foto do antes original e sai a do depois (o fluxo existente de "Voltar para pendente"), sem nova foto; abrir e fechar revisão exigem conexão, porque a cópia dos itens é feita no servidor. Reabrir pede confirmação, pois tira a foto do depois. Item resolvido antes de a revisão fechar já fica Conforme nela (a foto do depois foi a prova) e não volta a reconfirmar; só o resolvido depois do fechamento é reconfirmado. A fila offline passou a manter a ordem por item (`proximaOp` com chave), para o Desfazer não passar na frente da ação.
- [x] **05/11/2026 · Providências e preparativo:** padronizar Comprar/Alugar/Contratar sem dois-pontos em ações, lembretes e documentos; converter títulos salvos com auditoria e proteger envios offline antigos. Preparativo por pessoa em três colunas por vencimento relativo à reunião, limite de 15 dias corridos, divisória aos 5 dias e referência `(#N)` da atividade da obra. A investigação dos dois itens de cimento da Sagrada Família confirmou providências distintas de Alvenarias e de Contrapiso; não unir os registros.
Registro do que mudou em relação ao PRD/SPEC durante a implementação (data · decisão · motivo · quem).

- 2026-11-05 · **Inauguração no card de obras.** Abaixo de "Entrega" o card mostra "Inauguração" (a `entrega_original`) em cinza; em risco, uma faixa vermelha no pé do card ("Inauguração em risco · +N d.u.", original riscada → prevista, "Ver plano") abre o Plano de recuperação daquela obra; o resto do card abre a obra. A linha "Entrega" do card passa a ser a **previsão real** (atrasadas terminam hoje), para bater com a faixa. Fora deste passo, a pedido do usuário: data definida pelo gestor, marca no Log e sinal de caminho crítico em Fases/Cronograma. · Usuário.
- 2026-11-05 · **Obras gerais, etapa 1 · isolamento.** Leitura e escrita por obra via RLS com `contro_ve_obra(obra)` e gatilho `a_guarda_obra` (itens só apontam para itens da mesma obra); rotinas (avisos, boletim, abrir/reabrir reunião) só olham a Contorno nesta etapa.
- 2026-11-05 · **Obras gerais · campos protegidos.** `pessoa.administrador`, `acesso_contorno`, `papel_geral` e `user_id` só mudam por RPC; `contro_perfil()` e `contro_e_membro()` exigem `acesso_contorno`.
- 2026-11-05 · **Obras gerais · listas da Contorno.** Pessoas só de Obras gerais não aparecem nas listas da Contorno (`pessoa_sel` exige `acesso_contorno`; telas da Contorno filtram `acesso_contorno`).
- 2026-11-05 · **Obras gerais · dar acesso.** Dar acesso a quem estava pendente, desativado ou recusado na Contorno entra só em Obras gerais; não devolve a Contorno.
- 2026-11-05 · **Obras gerais · convite por e-mail.** `convite_geral` é usado no cadastro: a pessoa entra direto, sem aprovação.
- 2026-11-05 · **Obras gerais · navegação.** Sem tela de pouso: o app abre no último ambiente e o primeiro acesso é na Contorno; seletor de ambiente de 44 px; nome do ambiente em branco 55% no cabeçalho preto.
- 2026-11-05 · **Obras gerais · desativar.** Desativar alguém na Contorno (`definir_membro_ativo`) também tira o acesso às Obras gerais, porque `ativo` vale para os dois ambientes; continua em aberto (desativar só a Contorno quando a pessoa tem papel geral). Hoje ninguém tem os dois.
- 2026-11-05 · **Obras gerais · RLS por papel.** (Resolvida em 06/11/2026: ver "RLS por papel nas tabelas de planejamento" abaixo.)
- 2026-11-05 · **Obras gerais · nomes antigos.** Quem passa a ser só de Obras gerais deixa de aparecer pelo nome nos registros antigos da Contorno (`pessoa_sel` exige `acesso_contorno`).
- 2026-11-05 · **Obras gerais · convite.** O convite por e-mail depende da confirmação de e-mail ativa no Supabase de produção; quem chega por convite ainda vê o texto de cadastro "aguarde a liberação do gestor" (continua em aberto: ajustar o texto de cadastro do convidado).
- 2026-11-05 · **Obras gerais · participações.** Participações em obra geral são apagadas de fato ao tirar o acesso (sem histórico); continua em aberto avaliar um evento.
- 2026-11-06 · **Obras gerais · etapa 2 · menu de baixo.** O menu de baixo das Obras gerais foi da etapa 2 para a 3, porque Hoje, Score e Log ainda não existem lá · se errado, a etapa 3 entrega o menu de qualquer forma.
- 2026-11-06 · **Obras gerais · responsável.** Só pessoa da obra ou Administrador, sem nome livre · o nome livre depende das sugestões por ambiente (etapa 5).
- 2026-11-06 · **Obras gerais · prestador.** Em obra geral o prestador não usa nem alimenta `sugestao` · evita nome da Contorno em Obras gerais e vice-versa; sem autocompletar até a etapa 5.
- 2026-11-06 · **Obras gerais · nova atividade.** "+ lembrete de providência" e "+ nota" ficaram para a etapa 4 · providências e Check list da obra geral entram lá; até lá o Coordenador não cria providência.
- 2026-11-06 · **Obras gerais · RLS por papel nas tabelas de planejamento.** Fecha a pendência da etapa 1: `contro_planeja_obra` (Administrador ou Coordenador participante) governa a escrita; o Membro só escreve por RPCs de campo. Isso também resolve o bloqueio de quem é só de Obras gerais em `contro_nome_prestador` e nas checagens de entrada. `mapa_alvo_id` não existe mais (removida em 20261026160000), então não entra na guarda; o vínculo real `obra_mapa_libera` já é checado.
- 2026-11-06 · **Obras gerais · saída da obra.** Quem sai da obra deixa as atividades sem responsável (gatilho `obra_participante_sai`); saída de obra apagada não limpa, para não quebrar `definir_acesso_geral`. `contro_troca_participacoes` remove só as obras que saíram.
- 2026-11-06 · **Obras gerais · Administradores visíveis.** Quem tem papel geral vê os Administradores ativos pelo nome, para poder escolhê-los como responsável · custo: o Membro vê o nome dos 3 Administradores.
- 2026-11-06 · **Obras gerais · protege o planejamento.** O trigger `obra_atividade_protege_planejamento` só deixa data prevista, original, replanejamentos e responsável mudarem por RPC · a escrita direta apagaria o rastro do replanejamento.
- 2026-11-06 · **Obras gerais · data nula.** ~~`definir_data_prevista` e `editar_subitem_geral` aceitam data nula~~ · substituída na revisão final (ver "não dá para tirar a data" abaixo).
- 2026-11-06 · **Obras gerais · excluir subitem.** Em obra geral, por `excluir_subitem_geral`/`restaurar_subitem_geral` (quem planeja). Excluir ou restaurar atividade de obra apagada passa a dar 42501 (`contro_planeja_obra` exige obra não apagada); sem uso na UI.
- 2026-11-06 · **Obras gerais · Coordenador não põe Coordenador.** Adicionar ou convidar para a obra dá 42501 se o alvo é Coordenador e quem pede não é Administrador · só o Administrador torna alguém Coordenador; custo: o Administrador liga Coordenadores às obras.
- 2026-11-06 · **Obras gerais · convidar conta pendente.** Conta pendente nunca aprovada vira ativa só em Obras gerais; desativada ou recusada dá 22023 e o Administrador usa Pessoas e acessos.
- 2026-11-06 · **Obras gerais · e-mail dos membros.** Só o Administrador vê (via `listar_pessoas_gerais`); a pessoa não tem coluna de e-mail e o Coordenador não enxerga e-mails.
- 2026-11-06 · **Obras gerais · Pessoas da obra.** Também abre pelo ícone de pessoas no cabeçalho da obra, para quem planeja.
- 2026-11-06 · **Correção na Contorno · excluir subitem.** Excluir subitem na ficha da atividade falhava ("Não foi possível excluir o item.") porque `excluir_atividade_obra` recusava subitem. Agora `excluir_atividade_obra` e `restaurar_atividade_obra` aceitam o id de um subitem · pedido do usuário em 06/11/2026.
- 2026-11-06 · **Obras gerais · Desfazer da data volta exatamente.** `desfazer_data_prevista(evento)` restaura data, original e replanejamentos guardados no `antes` do evento, sem contar replanejamento (antes, o Desfazer chamava `definir_data_prevista` com a data antiga e contava um replanejamento a mais) · só quem planeja, o próprio evento, até 10 min e o último evento de data do item.
- 2026-11-06 · **Obras gerais · não dá para tirar a data de item aberto.** Data nula em atividade ou subitem aberto que já tem data dá 22023 ("use Desfazer") · tirar a data e pôr outra contornaria o contador de replanejamentos. Item sem data: no-op; item concluído: troca sem contar.
- 2026-11-06 · **Obras gerais · replanejamento do Score (etapa 3).** Mudar a data de item concluído não conta replanejamento (só `data_definida`), e o Desfazer não apaga o evento `replanejada` · o Score da etapa 3 contará o replanejamento pelos eventos (`replanejada` menos os desfeitos por `data_desfeita`), não só pela coluna.
- 2026-11-06 · **Obras gerais · funções de planejamento da Contorno recusam obra geral.** `adicionar_atividade_obra`, `ajustar_inicio`, `adicionar_mapa_obra`, `atualizar_prazos_atividades`, `atualizar_prazos_providencias`, `aplicar_plano_recuperacao` e `fixar_entrega_original` dão 23505 em obra geral · eram liberadas só por `contro_e_membro()`, então quem tem a Contorno e é Membro de uma obra geral planejava por elas. `gerar_obra` (cria obra Contorno nova), `concluir_tarefa` e `reabrir_tarefa` (campo, tarefas da reunião) ficaram de fora. Mapa de coleta (`obra_mapa_libera`, `mapa_proposta`) passa a usar `contro_planeja_obra` na RLS de escrita.
- 2026-11-06 · **Obras gerais · pendências em aberto.** Seguem abertas: desativar na Contorno tira as Obras gerais; texto de cadastro do convidado; participação apagada sem histórico; devolver a Contorno a quem é só de Obras gerais.
- 2026-11-06 · **Obras gerais · etapa 3 · ação = atividade.** Na obra geral, a ação da equipe é a própria atividade de topo aberta (com ou sem responsável); ela não aparece duas vezes. Tarefas de reunião entram na etapa 4 · se errado, a etapa 4 soma as tarefas à mesma lista.
- 2026-11-06 · **Obras gerais · etapa 3 · atividade sem data.** `Acao.prazo` é obrigatório no core: atividade sem data prevista fica fora das Ações da equipe, do Hoje e dos avisos, e aparece só na trilha · custo: atividade sem data não é cobrada até ganhar data.
- 2026-11-06 · **Obras gerais · etapa 3 · menu de baixo.** Hoje · Obra (Coordenador e Membro) e Hoje · Obras (Administrador). Score e Log entram na etapa 5, junto com os dados deles; abas vazias seriam pior. A casca sempre abre no Hoje (a aba escolhida só volta dentro da sessão).
- 2026-11-06 · **Obras gerais · etapa 3 · horários dos avisos.** Os avisos do dia das obras gerais usam `acoes_ativo` e `acoes_hora` de `config_avisos` (seg a sex, janela de 3 h) até a etapa 4 trazer a configuração por obra ("Reunião e avisos por obra").
- 2026-11-06 · **Obras gerais · etapa 3 · textos dos pushes imediatos.** Atribuição, nova data e saída da obra têm o texto só no SQL, como o push de tarefa atribuída da Contorno; o app nunca os mostra. "1 atividade ficou" / "n atividades ficaram" (singular e plural) · custo: nenhum.
- 2026-11-06 · **Obras gerais · etapa 3 · avisos só para quem participa.** Pessoa só da Contorno nunca recebe aviso geral e vice-versa; o Administrador recebe os dois sem somar. Defesa em profundidade: o gatilho confere que o destinatário participa da obra ou é Administrador ativo, mesmo que as RPCs já validem o responsável. Não avisa quem fez a mudança a si mesmo, e o Desfazer da data não gera "Nova data".
- 2026-11-06 · **Obras gerais · etapa 3 · Coordenador de duas obras.** Recebe um só aviso "equipe do dia" com as obras somadas (o índice único diário por tipo e pessoa não colide).
- 2026-11-06 · **Obras gerais · etapa 3 · eficiência.** "% no prazo" = concluídas dentro do prazo original sobre concluídas com prazo mais abertas já atrasadas; sem nenhuma, sem texto. `AtividadeGeral` ganhou `data_prevista_original`.
- 2026-11-06 · **Obras gerais · etapa 3 · review final.** (1) O Desfazer da troca de responsável usa `desfazer_responsavel_atividade`, que não manda "Nova atividade" (o gatilho pula a atribuição com `contro.desfazer` ligado). (2) "Nova data" segue o prazo efetivo da atividade de topo: replanejar um subitem que muda o prazo avisa o responsável da atividade (nome dela, prazo antigo → novo); editar a data da atividade enquanto os subitens mandam no prazo não avisa. (3) Eficiência: concluída sem original própria usa o maior original (ou data) dos subitens. (4) Ações da equipe voltam com o mesmo chip ao fechar a ficha, e o Voltar delas volta à aba e à obra de onde foram abertas. (5) Linha do Hoje: fechar a ficha ou voltar da obra volta ao Hoje, em todos os papéis. Tocar numa aba do menu esquece essas voltas.
- 2026-11-06 · **Obras gerais · etapa 3 · pendência de infra.** Confirmar em produção, depois do `db push`, que o job `avisos-gerais` existe no pg_cron.
- 2026-11-06 · **Obras gerais · etapa 4 · reunião por obra.** Uma reunião por obra geral e data (`reuniao.obra_id`); a reunião única da Contorno (`obra_id` nulo) não muda. Fechar/reabrir a ata e criar/atribuir tarefas = quem planeja (Coordenador, Administrador); responder itens e observações = qualquer participante.
- 2026-11-06 · **Obras gerais · etapa 4 · pauta e ata por datas.** Sem cronograma: "semana passada" = atividades de topo com prazo na semana anterior (concluídas no prazo, com atraso) e **todas** as abertas vencidas antes da semana da reunião (não só as da semana passada: a reunião existe para cobrar · custo: pauta mais longa); "esta semana" = prazo de segunda a sexta da reunião; cobrança = tarefas abertas da obra. Sem "começar" e sem ritmo em dias úteis.
- 2026-11-06 · **Obras gerais · etapa 4 · tarefas.** Criar, editar, atribuir, excluir e restaurar = quem planeja; concluir, reabrir e informar avanço = qualquer participante. Responsável = pessoa da obra ou Administrador (sem nome livre até a etapa 5).
- 2026-11-06 · **Obras gerais · etapa 4 · pendências.** Apontar, resolver (foto do depois), editar, reabrir, excluir/restaurar = qualquer participante; atribuir responsável = quem planeja.
- 2026-11-06 · **Obras gerais · etapa 4 · providências.** Criar e remover = quem planeja; marcar = qualquer participante. `providenciar_ate` = data prevista da atividade menos a antecedência em dias úteis, recalculado no banco quando a data muda. O lembrete nasce com 5 d.u. de antecedência (editável).
- 2026-11-06 · **Obras gerais · etapa 4 · "+ nota" fora.** A nova atividade ganha só "+ lembrete de providência"; "+ nota" sai do escopo (a atividade da Contorno não tem nota; o prestador cobre). Substitui a decisão "nova atividade" da etapa 2.
- 2026-11-06 · **Obras gerais · etapa 4 · avisos por obra.** `config_avisos_obra` com as colunas da `config_avisos` (sem linha = a global). Ações do dia continuam um aviso por pessoa somando as obras, na **hora mais cedo entre as obras em que a pessoa tem algo vencendo ou vencido** (só essas geram aviso). Lembretes de reunião `reuniao_manha_geral` e `reuniao_antes_geral`, um por pessoa por dia; com reuniões de duas obras no mesmo dia, o da manhã lista as duas e o "antes de começar" vale para a primeira (limite aceito). Substitui a decisão "horários dos avisos" da etapa 3.
- 2026-11-06 · **Obras gerais · etapa 4 · sem aviso de providências.** Obras gerais não têm aviso separado de providências; o toggle `provid_*` fica oculto em "Reunião e avisos" da obra, porque as providências já entram nas ações do dia.
- 2026-11-06 · **Obras gerais · etapa 4 · boletim por obra.** `config_boletim_obra` configurada por Administradores; `gerar_disparos_boletim_geral` grava `boletim_disparo` e um aviso `boletim_geral` para Coordenadores da obra e Administradores; envio ao WhatsApp manual. O disparo nasce com `notificado_em` (o push vai pelo `aviso_disparo`, não pelo `enviar-push-boletim` que avisa gestores da Contorno). Um aviso `boletim_geral` por pessoa por dia (obras no mesmo horário juntam no texto · custo: boletim de outra obra mais tarde no mesmo dia sai sem push).
- 2026-11-06 · **Obras gerais · etapa 4 · filtro mínimo na Contorno.** `reuniaoApi.loadReuniao` e `ReunioesScreen` filtram `obra_id is null`, e `fechar_reuniao`/`reabrir_reuniao` da Contorno também (senão o gestor fecharia ou reabriria reunião de obra geral) · resultado igual na Contorno.
- 2026-11-06 · **Obras gerais · etapa 4 · obra Contorno excluída.** Ações de tarefa e pendência em obra Contorno excluída dão 42501, e `salvar_tarefa` com obra inexistente dá 42501 (mesma troca aceita na etapa 2) · nenhum efeito na UI.
- 2026-11-06 · **Obras gerais · etapa 4 · "Reuniões hoje".** Ordena as obras pelo horário da reunião.
- 2026-11-06 · **Obras gerais · etapa 4 · bloco Reunião.** Diz "Pauta e atas" (sem "preparar": a pauta antecipada é da reunião única da Contorno) · sem PDF de pauta antecipada nas obras gerais.
- 2026-11-06 · **Obras gerais · etapa 4 · ações da equipe completas.** Ações = atividades de topo + tarefas + pendências (prazo pela config da obra) + providências pendentes com prazo, de atividade aberta e sem tarefa vinculada aberta; a mesma conta em `acoesCompletasObraGeral` (core) e em `gerar_avisos_gerais` (banco). A atividade aberta com tarefa vinculada aberta conta **uma vez**, pela tarefa; a providência sem dono vai para o **responsável da atividade de topo** (ou "Sem responsável"). Substitui a decisão "ação = atividade" da etapa 3.
- 2026-11-06 · **Obras gerais · etapa 4 · toque nas ações.** Tarefa: o check conclui (Desfazer) e o toque abre o avanço (a própria tarefa, ou quem não planeja; "Mudar" o prazo só para quem planeja) ou a edição (quem planeja, tarefa de outro ou feita). Tarefa vinculada a atividade se conclui na ficha da atividade (abre a ficha; não há câmera de tarefa na obra geral). Pendência abre o Check list com ela em destaque; atividade e providência abrem a ficha da atividade de topo. No Hoje, tarefa, pendência e providência aparecem como "Ação" e abrem as ações da equipe da obra (como na Contorno).
- 2026-11-06 · **Obras gerais · etapa 4 · quem faz o quê do boletim.** Usa a mesma lista das ações: tarefas e pendências abertas e, como na obra geral a atividade aberta com responsável é ação dessa pessoa, também ela e as providências dela; atividade e providência sem responsável ficam fora (o boletim já as mostra nos atrasos e na semana). A Contorno não muda (`quemFazOQueBoletim` continua igual; a conversão fica no `boletimDaObraGeral`).
- 2026-11-06 · **Obras gerais · etapa 4 · tarefa ligada a subitem.** A web só vincula tarefa à atividade de topo (ficha); a regra de não repetir olha a atividade de topo · aceito.
- 2026-11-06 · **Obras gerais · etapa 4 · saída da obra limpa tarefas e pendências.** Quem sai de uma obra geral também deixa as tarefas e as pendências abertas dela sem responsável (eventos `editada` e `responsavel_alterado`, motivo "saiu da obra"; migration `20261106340000_obras_gerais_saida_tarefas.sql`). O aviso aos Coordenadores e Administradores continua contando só atividades. Defesa: o `acoes_geral` só conta ações de obras de que a pessoa participa (ou de qualquer obra, para o Administrador).
- 2026-11-06 · **Obras gerais · etapa 5 · sugestões por ambiente, não por obra.** Quem tem papel em Obras gerais vê as sugestões de Obras gerais (todas as obras gerais); a Contorno vê só as da Contorno. Excluir sugestão de prestador em Obras gerais = quem planeja alguma obra geral (Coordenador ou Administrador). As leituras filtram `.eq('ambiente', ambiente)` na web, porque o Administrador com os dois ambientes veria as listas misturadas · custo: nome de prestador repetido entre obras gerais aparece para todos elas.
- 2026-11-06 · **Obras gerais · etapa 5 · nome livre só em tarefa.** Atividade e pendência continuam com pessoa da obra ou Administrador; o nome digitado vira sugestão de Obras gerais. Substitui a decisão da etapa 2 (sem nome livre) e a do prestador sem autocompletar.
- 2026-11-06 · **Obras gerais · etapa 5 · Score.** Itens = atividades de topo com responsável (prazo = data prevista efetiva; original = `prazoOriginalAtividadeGeral`), tarefas e pendências com responsável, das obras que a pessoa vê. Replanejamento = eventos `replanejada` não desfeitos (sem `data_desfeita` apontando para eles) na janela; o contador da coluna não é usado.
- 2026-11-06 · **Obras gerais · etapa 5 · histórico do Score.** Gravado só quando quem abre o Score é Administrador (visão de todas as obras gerais); Coordenador e Membro veem o gráfico dessa visão e o número atual da própria visão · custo: Coordenador e Membro não veem gráfico de prestadores.
- 2026-11-06 · **Obras gerais · etapa 5 · Log.** As mesmas linhas da Contorno, com "concluiu" (e "responsável: X" quando outra pessoa concluiu), data alterada (de → para), mudança de data desfeita e responsável trocado. Sem "início ajustado".
- 2026-11-06 · **Obras gerais · etapa 5 · menu.** Hoje · Obra (ou Obras) · Score · Log para todos em Obras gerais; Score e Log abrem na própria casca, com o mesmo menu.
- 2026-11-06 · **Obras gerais · etapa 5 · replanejamento de subitem.** Conta no Score da atividade de topo (as datas dos subitens formam o prazo dela) · custo: nenhum.
- 2026-11-06 · **Obras gerais · etapa 5 · rótulos do Log.** Em substantivo ("Data alterada", "Mudança de data desfeita", "Responsável trocado") com de → para no detalhe, no estilo dos rótulos atuais ("Replanejada") · custo: nenhum.
- 2026-11-06 · **Obras gerais · etapa 5 · replanejamento de tarefa.** Em Obras gerais também conta por eventos (a decisão do Score vale para todos os itens) · custo: nenhum.
- 2026-11-06 · **Obras gerais · etapa 5 · leitura do histórico geral.** Linhas gerais de `score_diario` legíveis pelo Administrador ou, nas chaves de equipe, por quem vê a pessoa (RLS de `pessoa`); prestadores e nomes livres só do Administrador (achado da revisão de segurança) · custo: Coordenador e Membro sem gráfico de prestadores.
- 2026-11-06 · **Obras gerais · etapa 5 · execução em paralelo.** A revisão da tarefa 4 e as tarefas 5 e 6 rodaram em paralelo, com arquivos disjuntos · custo: risco pequeno de conflito.
- 2026-11-06 · **Obras gerais · etapa 5 · adiado.** Sem teste de Administrador sem acesso à Contorno (Score e sugestões); a normalização de sugestão ainda casa sugestões apagadas (cópia literal, por ambiente).
- 2026-11-05 · **"Aprovar membros" passa a se chamar "Pessoas e acessos"** (mesma função na Contorno).
- 2026-11-05 · **Administradores marcados por migration de dados** (primeiro nome luiz, rafael ou rodrigo entre gestores); conferir em produção antes do merge.
- 2026-11-06 · **Administrador só Luiz Felipe.** Rafael e Rodrigo passam a Coordenador em Obras gerais (migration de dados 20261106500000) e continuam Gestores da Contorno; o Administrador os coloca nas obras pela tela Pessoas da obra. O Coordenador segue podendo adicionar Membros nas obras dele. Pedido do usuário.
- 2026-11-06 · **Ficha da Contorno sem "Pendências da atividade".** Repetia o Check list e confundia; as pendências ficam só na aba Check list da obra (como nas Obras gerais). A seção tinha entrado em 03/11 sem registro no PRD/SPEC. Pedido do usuário.
- 2026-11-06 · **#N nas atividades da obra geral.** Como na Contorno (`numeracaoObra`: fase a fase, na ordem), para orientar a conversa: na trilha, na ficha, no aviso de avanço e em Organizar. Reordenar renumera. Pedido do usuário.
- 2026-11-06 · **Gaveta aberta trava a tela de trás (iPhone).** `overflow: hidden` no body não impedia o dedo de rolar o fundo no Safari; a `BottomSheet` passa a fixar o body na posição atual (com contador para gaveta sobre gaveta) e devolve a rolagem ao fechar. Vale para todas as gavetas do app. Pedido do usuário.
- 2026-11-06 · **Ficha da obra geral sem "Pendências da atividade".** Muita informação numa tela só; as pendências ficam na aba Check list da obra. Pedido do usuário.
- 2026-11-06 · **Subitem na nova atividade: texto na largura toda.** O campo cresce com o texto (altura soma as bordas e recalcula quando a largura muda); data e remover passam para baixo do campo, à direita. Pedido do usuário.
- 2026-11-06 · **Ficha da obra geral: topo fixo e rolagem contida.** Com a ficha rolada até o fim não havia como sair no iPhone. O topo (Voltar, nome, menu) fica preso no alto da folha; a `BottomSheet` passa a usar `90dvh` (área visível) e `overscroll-behavior: contain`. Pedido do usuário.
- 2026-11-06 · **Nome do subitem cresce com o texto.** `TextoCrescente` (packages/ui): campo de uma linha que quebra e cresce em vez de esconder o texto; Enter não cria linha. Usado no subitem da nova atividade e em Novo/Editar subitem. Pedido do usuário.
- 2026-11-06 · **Organizar obra geral (arrastar e soltar).** Botão "Organizar" ao lado de "+ fase" (quem planeja: Gestor; Coordenador nas dele) abre a lista com alça de arrastar: muda a sequência das fases e, dentro de cada fase, a das atividades. O número da fase e o #N das atividades saem da ordem. Mover atividade para outra fase e subitens ficam de fora. Cada soltura salva na hora (otimista) com Desfazer de 5 s. RPCs `reordenar_fases_geral` e `reordenar_atividades_geral` exigem a lista completa (sem repetição); biblioteca @dnd-kit (toque e teclado). Só Obras gerais. Pedido do usuário.
- 2026-11-06 · **Sem "Entrega da obra" na trilha das Obras gerais** por enquanto: obra geral não tem data de entrega (precisaria de todas as datas e sequências). Pedido do usuário.
- 2026-11-06 · **Sem "obras da contorno" no app.** Título da aba, nome do app instalado (manifest) e texto alternativo do logo passam a "CONTRO"; a descrição do manifest vira "Planeje e acompanhe as obras." (o app atende também Obras gerais). Pedido do usuário.
- 2026-11-06 · **Editar nome e cidade da obra geral.** Lápis no topo da obra (`EditarObraGeralSheet`), com Desfazer de 5 s. Gestor em qualquer obra geral; Coordenador nas dele (faz tudo menos criar obra); Equipe não. RPC `editar_obra_geral` (migration 20261106530000), mesmas regras de nome e cidade de `criar_obra_geral`. Pedido do usuário.
- 2026-11-06 · **Coordenador da Contorno e boletim do Coordenador de Obras gerais.** Contorno ganha o Coordenador (perfil `gestor` + `pessoa.coordenador_contorno`, protegido como os outros campos de papel): faz tudo, inclusive criar obras e editar modelos, mas em Pessoas e acessos só desliga ou religa quem é da Equipe (nunca Gestor, Coordenador da Contorno, Administrador nem Coordenador de Obras gerais); o Gestor desliga qualquer um. Matheus passa a Coordenador. Em Obras gerais o Coordenador passa a configurar o boletim automático das obras dele; continua só tirando da obra quem é da Equipe, e colocar um Coordenador numa obra ou tornar alguém Coordenador segue só do Gestor (criar e dar papel ficam com o Gestor). Migration 20261106520000. Pedido do usuário.
- 2026-11-06 · **Rótulos "Gestor" e "Equipe".** Na tela, "Administrador" vira "Gestor" e "Membro" vira "Equipe", em Obras gerais e na Contorno ("Adicionar à equipe", "Ninguém da equipe nesta lista"). Valores no banco e nomes no código não mudam; mensagens de exceção do SQL também não (o app mostra as próprias mensagens). Conta antiga "Luiz" (Equipe de obra, desativada) excluída logicamente pela migration 20261106510000. Pedido do usuário.

- 2026-11-05 · **Gráfico de evolução no detalhe do Score (opção B do protótipo).** Card com número grande, variação desde ontem e linha do score de fim de cada dia útil. Gravação feita pelo app ao calcular o Score (último cálculo do dia vence; o servidor decide o dia, então o passado não muda), em vez de um job noturno: o cálculo do score é do core (regra 1) e uma Edge Function teria de duplicar a carga de dados do Log/Score. **Limite conhecido:** dia em que ninguém abre o Score fica sem ponto, e ações feitas depois da última abertura do dia só entram no ponto do dia seguinte. **Confiança:** qualquer membro pode gravar o score de hoje de qualquer nome pela RPC (o valor vem do cliente); aceito porque todo membro já pode concluir e replanejar as ações que formam o score, e o dia é decidido pelo servidor, então o histórico passado não muda. Se virar problema, trocar por um job no servidor que calcule com o core. Pedido do usuário.

- 2026-11-05 · **Selo dos chips de Tarefas da equipe.** "Sem responsável" mostra o total que a lista mostra (atrasadas + vencem hoje + próximos 5 dias); o chip de cada pessoa mostra atrasadas + vencem hoje. O selo é branco (preto no chip ativo) e fica vermelho só quando há atraso. Regra em `core/acoes.seloChipResponsavel`. Pedido do usuário.
- 2026-11-05 · **Selo do chip "Todos" em Tarefas.** Mostra a soma de atrasadas + vencem hoje de toda a lista (com e sem responsável), mesma regra do chip de pessoa; vermelho quando há atraso. Pedido do usuário.

- 2026-11-04 · **Score lista todos com ação atribuída; "Sem responsável" primeiro em Tarefas.** (1) No Score da equipe aparece toda pessoa com tarefa ou pendência atribuída (não excluída), mesmo sem nada concluído ou vencido no período: fica com "0 ações no período · sem score ainda", depois dos pontuados. Antes só entrava quem tinha item na janela. (2) Em Tarefas, o chip "Sem responsável" vem antes de "Todos" e só aparece quando há pelo menos uma ação sem responsável; sem nenhuma, "Todos" é o primeiro. "Todos" continua selecionado ao abrir. · pedido do usuário · usuário

- 2026-11-04 · **Número do Hoje no menu = total do dia.** O badge do item Hoje mostra atrasados + para hoje (a soma dos cards das obras), não só os atrasados; fica vermelho quando há atraso e preto quando não há. · pedido do usuário · usuário
- 2026-11-04 · **Pré-obra também vira ação.** Itens atrasados do Orçamento e do Mapa de coleta (fases preliminares) entram em Tarefas da equipe ("Sem responsável"), nos contadores e no aviso do gestor, como as demais atividades; o prazo vem do cronograma do pré-obra. Antes eles apareciam como atraso só na tela Hoje (ex.: CDC Paquetá), o que gerava a divergência. Migration 20261104700000_pre_obra_como_acao.sql. · pedido do usuário · usuário
- 2026-11-04 · **Atividades como ações.** Atividade de topo sem tarefa vinculada aberta entra em Tarefas da equipe ("Sem responsável") nas três seções e nos contadores; atribuir cria a tarefa vinculada à atividade (concluir pela câmera conclui a atividade). fim_previsto_calc derivado para o push do gestor. Hoje esconde a atividade que já tem tarefa. Concluir a atividade fecha as tarefas vinculadas; concluir a tarefa (Tarefas ou Minhas ações) passa pela câmera e conclui a atividade; Desfazer reabre as duas. O contador 'abertas' da tela inicial conta só até 5 d.u. · pedido do usuário · usuário
- 2026-11-04 · **Log só leitura.** As linhas do Log não abrem folha de edição nem navegam para o item: o Log é a foto do que aconteceu; editar fica nas telas de cada item. Removidos a folha da tarefa pelo Log e o toque nas linhas e nos cards por item. · pedido do usuário · usuário
- 2026-11-04 · **Item do mapa pela obra.** Botão "Adicionar item do mapa" na fase Mapa de coleta; folha com nome, duração, antecedência e atividades liberadas; RPC adicionar_mapa_obra; não altera o modelo. Salva direto, sem fila offline, como o adicionar de atividade. · pedido do usuário · usuário Adicionar um item renumera os #N da obra, como ao adicionar atividade.
- 2026-11-04 · **Próximos 5 dias.** As listas de ações mostram só o que vence de amanhã até 4 d.u. depois; o resto não aparece (sem "Mais adiante"). · pedido do usuário · usuário
- 2026-11-04 · **Score e Log.** Menu inferior Hoje · Obras · Score · Log (ativo preto/branco), para todos os perfis. Log = eventos já gravados (90 dias), com "vencida" derivada e Vida do item nas fichas; motivo opcional ao replanejar tarefa (p_motivo). Score 0–100 por nome: equipe (pontualidade 35, conclusão do dia 20, resposta ao atraso 20, replanejamentos 15, pendências 10) e prestadores (no fim previsto 45, atraso médio 30, com foto 25), mínimo 5 itens, faixas ≥75/50–74/<50; "empurrou a fase" descartado (sem início real da sucessora); prazo da atividade = cronograma vigente. Conclusão do dia conta concluída até o prazo vigente; vencida no Log aparece no primeiro dia útil após o prazo. **Exceção aprovada (04/11/2026, Score e Log):** vermelho também na faixa **Atenção** do Score e nas linhas **vencidas** do Log; âmbar também em **replanejada**, **início ajustado** e na faixa **Regular**. · pedido do usuário · usuário
- 2026-11-04 · **Providências como ações.** Providência pendente sem dono entra em Tarefas da equipe ("Sem responsável") e nos contadores; o gestor atribui responsável pela folha de tarefa, criando a tarefa vinculada à providência (mecanismo já existente; sem campo novo no lembrete). O app grava `providenciar_ate` (derivado) para o push do gestor contar as mesmas providências; pode ficar defasado até alguém abrir o app. Providências de atividades do pré-obra (fora do cronograma) não viram ação nem gravam prazo. Regra 'sem dono' e `prazosParaGravar` no core (`providencias.ts`). · pedido do usuário · usuário
- 2026-11-04 · **Ações do dia.** Um push por pessoa com atrasadas + vencem hoje e um da equipe para o gestor, no lugar de "Bom dia" e "Tarefas que vencem hoje". Tarefa e pendência viram "ação" com a mesma importância, sem etiqueta de origem; pendência ganha prazo pela criticidade (alta 2, média 4, baixa 6 d.u., configurável). Seções Atrasadas · Vencem hoje · Próximos dias · Concluídas com ícone; âmbar #B45309 só para "vence hoje" (exceção ao design system); card atrasado com fundo #FBEAEA. Tela inicial, cards e boletim contam ações. **Ata não muda** (as pendências não são itens de reunião; decisão de quem implementou, a confirmar com o usuário). · pedido do usuário · usuário
- 2026-11-03 · **Central de reuniões (opção C) e PDF completo.** Card Reunião → tela Reuniões (próxima: abrir pauta, Preparar · PDF, WhatsApp; lista de atas passadas, até 30). Na pauta, menu ⋯ (Preparar, Baixar ata, Reuniões e atas) no lugar de "Anterior", "Baixar ata" no topo e do ícone sem nome no rodapé. **Defeito corrigido:** a ata e a prévia são impressas a partir da tela, que tem altura fixa com rolagem própria (`.app-shell` 100dvh, `.app-main` overflow); a impressão só pegava o trecho visível (≈2 páginas, só as primeiras obras). Agora, na impressão, a casca do app perde altura fixa e rolagem (conferido: ata de 7 obras sai inteira). · pedido do usuário · usuário

- 2026-10-31 · **Botão provisório de atualizar o PWA.** Alguns celulares ficavam presos numa versão antiga. O build gera `/version.json` (commit da Vercel), fora do cache do service worker; o app compara com a própria versão ao abrir, ao voltar e a cada 10 min e mostra "Nova versão do CONTRO · Atualizar". O menu do perfil tem "Atualizar o app · versão X" (sempre). Atualizar = tirar o service worker e o cache dos arquivos e recarregar; a fila offline, as fotos guardadas e o login ficam. Provisório: sai quando a atualização automática estiver confiável. · pedido do usuário · usuário
- 2026-10-31 · **WhatsApp legível (opção A + ícones).** Ata, pauta antecipada e boletim: obra em destaque, seções em negrito com ícone, um item por linha e a bolinha da temperatura do prazo (🔴 atrasado, 🟡 até 7 dias, 🔵 em dia, 🟢 feito, ⚪ sem resposta), calculada no core (`whatsapp.ts`, `temperaturaPrazo`). **Exceção à regra "sem emoji na UI"**, só para o texto do WhatsApp (CLAUDE.md atualizado); app e PDFs seguem sem emoji. Antes o texto vinha encadeado com ";" numa linha por seção, difícil de ler. · pedido do usuário · usuário

- 2026-10-30 · **Preparar a reunião (pauta antecipada em PDF).** Botão de prévia no rodapé da pauta da próxima reunião (prévia · Voltar · Continuar, pedido do usuário); sempre todas as obras (sem "só o meu", decisão do usuário); 1, 2 ou 3 formatos num PDF só — tabela em paisagem, folha e por pessoa em retrato (`@page` nomeado). Regras e textos em `core/preparo.ts`; dados da mesma pauta (`ataDados.montarPreparo`). Sai pela impressão do aparelho ("Salvar como PDF"), como a ata sem pdf-service; template no pdf-service fica para quando o serviço for publicado. Push na véspera fica para depois. · pedido do usuário · usuário

- 2026-10-30 · **Card da reunião mostra a próxima.** Antes mostrava a reunião da semana corrente (na quarta, a segunda que já passou). Agora `reuniaoQueVem` (core): a de hoje até o fim do dia; depois, a da semana seguinte. A pauta da próxima já abre para preparar; a ata anterior fica em "Anterior · data" na tela da reunião. · pedido do usuário · usuário

- 2026-10-29 · **Várias pendências de uma vez.** A câmera do Check list abre "Tirar fotos" (sequência, miniaturas, "Pronto · N", atalho para a galeria) ou "Da galeria" (seleção múltipla). Uma pendência por foto; lista com o que é, local, criticidade e atividade; "Para todas as fotos" (com 2+); "Apontar" grava as prontas e mantém as outras (decisão do usuário). Regras em `core/loteFotos.ts`; cada foto usa o mesmo apontar otimista/offline de antes (sem migration). · pedido do usuário · usuário

- 2026-10-29 · **Ata colaborativa.** Pauta por obra em 4 passos: Cobrança → Semana passada (etiquetas TERMINAR/COMEÇAR, "Terminou/Não terminou", "Começou/Não começou") → Esta semana ("Segue o plano/Precisa de ação"; compras "Já providenciado/Precisa de ação") → Fechamento (observações, itens sem resposta, prévia da ata). Toda resposta fica gravada em `reuniao_resposta` (antes "Começou" e "Segue o plano" não eram gravados e a ata mostrava "Começou" como não feito). "Na ata: …" em cada card; contador de respondidos e ✓ no chip da obra. **Quem cuida é obrigatório** em toda ação; "Não terminou" grava quanto andou (avanço parcial). Ata em 4 blocos + Providências + Quem faz o quê; WhatsApp no mesmo formato. **Minhas ações** (avanço 0/25/50/75%/Feita e comentário da tarefa, `informar_avanco_tarefa`), com botão na ata e em Tarefas. **Calendário livre** ("Outra data" abre o mês; sábado/domingo em cinza mas selecionáveis) na providência, no prazo de tarefa e no remarcar. **PDF**: "Resumo em tabela + ata" (paisagem, padrão) ou "Só a ata"; sem pdf-service, a impressão do navegador usa o mesmo layout. A pauta e a ata usam as semanas da **data da reunião** (antes, as de hoje: a ata fechada mudava ao ser aberta dias depois); cada resposta guarda a ação (`tarefa_id`), porque a mesma atividade pode estar em duas seções; `hojeISO` passou a usar o fuso do aparelho (em UTC, depois das 21h já era "amanhã"). Decisões do protótipo assumidas: fim de semana selecionável; mesmos degraus do avanço das atividades; formato do PDF escolhido na hora. · pedido do usuário · usuário

- 2026-10-28 · **Reunião e avisos por push.** O gestor define dia e horário da reunião e os avisos (lembrete de manhã e antes de começar; resumo da manhã; tarefas do dia; providências) em `config_avisos`; `gerar_avisos()` (pg_cron 5 min) grava `aviso_disparo` por pessoa e a Edge Function `enviar-avisos` envia. "Avisos neste celular" no perfil para cada um ativar. O resumo e as providências não repetem o cálculo do cronograma no banco (regra 1): o resumo conta obras e tarefas atrasadas e convida a abrir o app; providências é um lembrete. **Push ligado em produção em 28/10/2026** (usuário, pelo runbook `supabase/functions/enviar-avisos/README.md`): chaves VAPID, `VITE_VAPID_PUBLIC_KEY` na Vercel, segredos e deploy de `enviar-avisos` e `enviar-push-boletim`, crons `avisos-enviar` (5 min) e `boletim-enviar-push` (15 min); teste de push recebido no celular. · pedido do usuário · usuário

- 2026-10-28 · **Reabrir pauta da reunião.** A ata de 26/10 foi fechada com 2 obras de teste que depois foram apagadas e ficou vazia ("Nenhuma obra em andamento"), embora houvesse 6 obras ativas. Reaberta no banco com autorização do usuário. No app: ata fechada sem obras explica o motivo e o gestor tem "Reabrir pauta" (`reabrir_reuniao`). A segunda da semana passa a ser calculada pela data local (antes UTC). · pedido do usuário · usuário

- 2026-10-28 · **Check list sem vistoria (muda a regra 5).** Tirou a foto do depois, a pendência está resolvida (`resolver_pendencia` fecha direto; as que estavam em vistoria foram fechadas com evento `fechada_sem_vistoria`). Opção B do protótipo: Pendências com Fotos | Lista (lista por criticidade, com câmera para resolver) e Resolvidos em lista compacta que abre com antes e depois. CLAUDE.md, PRD e SPEC atualizados. · decisão do usuário · usuário

- 2026-10-28 · **Check list = Pendências | Resolvidos (sem fila e sem adiar).** Pendências: uma foto por vez, altas primeiro; esquerda = Resolvida (câmera do depois), direita = próxima foto. Resolvidos: card com antes e depois; a vistoria (regra 5) acontece no próprio card, sem a tela separada. Adiar saiu do app (pendências adiadas voltam para Pendências); `adiar_pendencia`/`trazer_pendencia` e o pg_cron de devolução ficam no banco sem uso. · pedido do usuário · usuário

- 2026-10-28 · **Check list: fotos ampliadas e concluída de volta para pendente.** Miniatura e fotos da vistoria abrem antes/depois em tela cheia com zoom (pinça, toque duplo, arrastar). Concluída tem "Voltar para pendente" (`reabrir_pendencia`), com a escolha de manter ou tirar a foto do depois; sem Desfazer, porque a folha de escolha já é a confirmação (desvio consciente da regra 10). Corrigido: a Nova pendência reabria com os dados do último apontamento. · pedido do usuário · usuário

- 2026-10-28 · **Fila do Check list por criticidade:** altas no topo, médias no meio, baixas no fim; dentro da mesma criticidade segue `ordem_fila` (então "Resolver agora" e "Trazer para a fila" sobem a pendência só dentro do grupo dela). Só ordenação no core (`classificarPendencias`), sem migration. · pedido do usuário · usuário

- 2026-10-28 · **Check list: editar, apagar e achar a atividade.** "⋯" em cada item da lista completa com Editar e Apagar (RPCs `editar_pendencia`, `excluir_pendencia`, `restaurar_pendencia`: qualquer membro, offline e idempotentes, exclusão lógica com evento e Desfazer). A atividade da pendência se escolhe por busca (`filtrarAtividades` no core: nome sem acento ou #N) com a lista agrupada por fase. Corrigido o foco que saía do campo ao digitar: o BottomSheet refazia o foco a cada render quando `onClose` mudava. · pedido do usuário · usuário

- 2026-10-28 · **Ficha: avanço e concluir num lugar só (opção D do protótipo).** O rodapé fixo virou 25% · 50% · 75% · Pronta · Foto numa linha (ir e voltar livremente; Pronta conclui sem foto; Foto conclui com foto). Saíram o "Marcar como resolvida" e os cards do topo, que faziam a mesma coisa. Rodapé com mais respiro embaixo, longe da borda da tela. · pedido do usuário · usuário

- 2026-10-28 · **Avanço parcial por atividade (opção C + B do protótipo):** anel na trilha (cada toque +25%, o quarto conclui sem foto) e cards 25 · 50 · 75 · Pronta na ficha. O parcial conta no % da obra pelo peso da atividade (fecha a Q2). Coluna `obra_atividade.avanco_pct` (0..99) e RPC `definir_avanco` (offline, idempotente, evento `avanco`). Concluir continua por `concluir_atividade`; reabrir mantém o avanço anterior. Mapa de coleta fica fora (é check). · pedido do usuário · usuário

- 2026-10-28 · **"Trocar senha" no menu do perfil:** a pessoa logada digita e repete a nova senha (mín. 6), sem sair da conta nem depender de e-mail (`auth.updateUser`). O "Esqueci a senha" do login continua para quem não lembra a senha. · usuário
- 2026-10-27 · **Número "#N" em todas as atividades da obra** (antes só no pré-obra), na trilha, no cronograma e na ficha, como no modelo. O número é do app (numeração por fase e ordem), não faz parte do nome: os nomes guardados não têm "#N" (limpos no Modelo 1 e na obra CDC - Céu azul), para nunca aparecer duas vezes. · usuário
- 2026-10-27 · **Menu "⋮" no cabeçalho da obra** (no lugar da lixeira): "Editar nome da obra" (qualquer membro, com Desfazer) e "Apagar obra" (só o gestor, com a confirmação de sempre). · usuário
- 2026-10-27 · **Voltar ao mesmo lugar:** a tela (início, reunião, tarefas, modelos…), a aba Hoje/Minhas obras, a obra aberta e, dentro dela, a aba (Fases, Providências, Cronograma, Check list), a fase aberta e a ficha aberta ficam lembradas neste aparelho (`useLembrado`, localStorage). Ao reabrir o app ou a guia, a pessoa continua onde estava; "Sair" apaga; obra lembrada que foi apagada volta para a lista. · usuário
- 2026-10-27 · **Volta ao mesmo lugar:** a tela (início, modelos, reunião, tarefas…), a aba Hoje/Minhas obras, a obra aberta e, dentro dela, a aba (Fases, Providências, Cronograma, Check list), a fase aberta e a ficha aberta ficam lembradas neste aparelho (`useLembrado`, localStorage). Ao voltar ao app ou à guia, mesmo depois de o celular fechar o app, a pessoa continua onde estava. "Sair" apaga; obra apagada volta para a lista. · usuário
- 2026-10-27 · **Apagar obra (só o gestor):** ícone de lixeira no cabeçalho da obra (só aparece para o gestor), sempre com tela de confirmação; exclusão lógica (`excluir_obra`, grava `excluida_por`) e Desfazer (`restaurar_obra`). Trigger impede a equipe de apagar por update direto (a policy de update da obra é aberta a membros). Core `podeApagarObra`. · usuário
- 2026-10-27 · **Rascunho nos formulários com botão de salvar:** Nova obra, Nova atividade, Novo lembrete e Nova tarefa guardam o que foi digitado neste aparelho (localStorage, por pessoa) e recuperam ao reabrir, com aviso "Rascunho recuperado" e Descartar; o rascunho some ao salvar (`useRascunho`). · usuário
- 2026-10-27 · **Salvar sozinho os textos digitados:** prestador (e "quem foi contratado"), nome da atividade e texto do lembrete salvam quando o app vai para segundo plano/fecha ou a ficha fecha, sem precisar confirmar (`useAutoSalvar`). As três edições passam pela fila offline (`editar_prestador`, `renomear_atividade`, `editar_descricao_providencia`), otimistas (regra 9). O prestador não salva no meio da digitação para não criar sugestões pela metade. · usuário
- 2026-10-27 · **Topo da ficha com menu "⋯" (opção C do protótipo):** ao lado do X, com alvos de 48 px; reúne "Editar nome" e "Excluir atividade" (o lápis solto e o botão de excluir no corpo da ficha saem). · usuário
- 2026-10-27 · **"Para começar" em lista compacta (opção A do protótipo):** na ficha, mapas e lembretes viram linhas da mesma altura: quadrado para marcar/desmarcar (com Desfazer), tipo, nome em uma linha, uma linha de datas (prazo e começar, ou quem marcou e quando; atraso em vermelho com relógio) e "⋯" com o detalhe (editar o texto, reabrir/marcar, excluir lembrete manual). · usuário
- 2026-10-27 · **Adicionar e excluir atividades na obra:** "+ Adicionar atividade" no fim de cada fase da obra (nome, prazo, começa depois de; o pré-obra não) e "Excluir atividade" na ficha, com Desfazer. RPCs `adicionar_atividade_obra`, `excluir_atividade_obra` (exclusão lógica + subitens + evento) e `restaurar_atividade_obra`. As dependências ficam guardadas; no cálculo, a sucessora herda as predecessoras da excluída (core `dependenciasAtivas`). Só na obra: o modelo não muda. · usuário
- 2026-10-27 · **Mapa de coleta como check (opção A do protótipo):** quadrado no card da trilha marca "pronto para decisão de contratação", sem foto e **sem pontos** (concluir/desfazer dão 0 XP e não fecham fase com bônus; core `xpConclusao(_, mapa)` espelha o servidor). "+ Quem foi contratado" é opcional e depois; grava em `prestador` do mapa, com as sugestões de prestador. Na ficha do mapa: "Mapa pronto" no rodapé (sem câmera) e o campo "Quem foi contratado". · usuário
- 2026-10-27 · **Textos livres na obra:** o nome da atividade (inclusive do pré-obra) e o texto do lembrete se editam na ficha, com lápis e Desfazer. Vale só para a obra (não altera o modelo). · usuário
- 2026-10-27 · **Lembrete com duração** (`duracao_du`, padrão 0) em modelo_providencia e obra_providencia: quantos dias úteis leva para providenciar. O Hoje avisa desde "começar" (prazo − duração) até o prazo. Continua sem valor e sem fornecedor (regra 4 do CLAUDE.md atualizada). Os lembretes existentes (modelos e obras) foram preenchidos com a sugestão do assistente: contratação 5, compra 3, locação 1 (migration 20261027100000, pedido do usuário); o seed também. · usuário
- 2026-10-27 · **Hoje lê para trás:** atividade (e mapa de coleta) que devia ter começado e ainda está no prazo aparece como "Em andamento" todo dia até ser concluída (antes só aparecia no dia exato de começar e sumia até virar atraso). O mapa mostra a atividade que libera e quando ela começa. **Nova obra:** além das próximas 4 segundas, "Outra data no calendário" aceita qualquer data, passada ou futura; fim de semana vai para a segunda seguinte (`diaUtilAPartir`). · usuário
- 2026-10-26 · **"Voltar para pendente"** na ficha da atividade concluída, para qualquer membro (antes só quem concluiu desfazia, pelo toast); Desfazer conclui de novo com a mesma foto. **"Demolições e retiradas" sem subitens**, como as demais atividades (modelos: apagados; obras: exclusão lógica; seed atualizado). · usuário

- 2026-10-26 · **Nomes de pessoas:** cadastro exige nome e sobrenome; etiquetas mostram o nome curto (primeiro nome + inicial do sobrenome: "Luiz F"), pelo core `nomeCurto`; "Editar meu nome" no menu do perfil (RPC `atualizar_meu_nome`). **Pendências viram "Check list"**, com botão "i" de como funciona, e a aba vai para depois de Cronograma (Fases, Providências, Cronograma, Check list). · usuário

- 2026-10-26 · **Mapa de coleta aparece na atividade que ele libera**: na ficha, em "Para começar", um card "Mapa de coleta · #N" (a fazer / atrasado em vermelho / concluído) junto das providências, entrando na contagem "X de Y providenciados". Resolver o mapa na fase 2 reflete no card; o card também tem "Marcar mapa como resolvido" (conclui o mapa, com Desfazer). Só aviso: não trava. · usuário

- 2026-10-26 · **Mapa de coleta libera várias atividades** (`modelo_mapa_libera`/`obra_mapa_libera`; sai `mapa_alvo_id`): o mapa termina antes da mais cedo delas (ES − antecedência). Ligações já propostas em todos os modelos e obras (ex.: #3 Empreiteiro civil libera Mobilização, Demolições, Limpeza, Alvenarias, Impermeabilização e Contrapiso). No assistente do modelo, o passo 3 do pré-obra é múltipla escolha; na obra, os itens do pré-obra têm "#N" na trilha e a ficha mostra "Libera: #…" e "Preparada por: #…". **Orçamento (fase 1) vira 3 atividades em sequência** (#1 Recebimento dos projetos → #2 Levantamento de quantitativos → #3 Montagem da EAP no Grana); a atividade "Orçamento" sai (exclusão lógica nas obras). · usuário

- 2026-10-26 · **Pré-obra: fases 1 "Orçamento" e 2 "Mapa de coleta"** em todos os modelos e obras (as demais renumeradas +2), **antes do dia 0** e **fora do % e do prazo**. Orçamento: atividade com 3 subitens de 5 du (Recebimento dos projetos, Levantamento de quantitativos, Montagem da EAP no Grana), terminando antes do primeiro mapa. Mapa de coleta: 18 mapas (5 du) ligados à atividade que liberam (`mapa_alvo_id`) e à antecedência da contratação; só entram os mapas cujo alvo existe no modelo. Datas no core (`cronogramaPreObra`, `deslocarDU`). Nas obras já criadas entra aberto. **Nada do pré-obra trava**: é aviso para se programar (datas, vermelho quando passa, Hoje); nenhuma atividade da obra depende dele. No editor de modelos, o passo 3 do assistente numa fase de pré-obra vira "O que esta etapa prepara?" (atividade alvo + dias úteis antes); duplicar modelo copia o pré-obra. Migration `20261026150000_pre_obra.sql` + `seeds/pre_obra.sql`. · usuário
- 2026-10-26 · **Plano de recuperação da inauguração** (opção A; entradas: faixa no topo da trilha e card da aba Hoje). Core: defasagem por dependência no motor (`defasagens`), `previsaoEntrega`, `planoRecuperacao` (candidatas de paralelismo e redução nas próximas críticas, escolha gulosa do mínimo que zera o atraso), `simularPlano`, `tarefasDoPlano`. Banco: `obra.entrega_original` (fixada na primeira abertura; obras antigas recebem a data do cronograma atual), `obra_dependencia.defasagem_du` e RPCs `fixar_entrega_original` / `aplicar_plano_recuperacao`, com pgTAP. · usuário
- 2026-10-26 · **Providências em duas abas: "A providenciar" e "Providenciadas"**. Ao marcar, o item sai da lista e o toast diz "foi para Providenciadas" (com Desfazer). Em "Providenciadas", agrupado por dia, cada item mostra **quem marcou e quando** ("Paulo · hoje às 10:42", de `feito_por`/`feito_em`, que o banco já gravava), com filtro por pessoa e "Reabrir". · usuário
- 2026-10-26 · **Tela inicial em duas abas** no menu inferior: "Hoje" (padrão, com contador vermelho de atrasos) e "Minhas obras" (nova obra, Reunião, Tarefas e cards das obras). · usuário

- 2026-10-26 · **"Hoje" na tela inicial** (opção A, entre três protótipos): cards por obra, recolhíveis, com "Atrasado" (lembrete não providenciado, atividade vencida, tarefa vencida) e "Para hoje"; core `agendaDoDia` e `resumoDoDia`, calculados na mesma carga da carteira (sem N+1). Junto, o **lembrete passa a ser atrasado só depois do dia limite** ("providenciar até sex" ainda vale na sexta), para o "Para hoje" fazer sentido; antes ficava vermelho já no próprio dia. · usuário

- 2026-10-26 · **Não existe atividade bloqueada** (muda a regra 3 do CLAUDE.md). Qualquer atividade aberta pode ser concluída a qualquer momento, com ou sem foto: as dependências só montam o cronograma e os lembretes só avisam ("falta locação: …"). Concluir uma atividade com subitens marca os subitens abertos. Some da UI "Liberada", "Aguardando providência", "Planejada · aguarda…", o cadeado e o "Libera quando concluir"; a ficha mostra Planejada, Em andamento, Atrasada ou Concluída e ganha o rodapé fixo "✓ Marcar como resolvida" com o botão de câmera ao lado (protótipo A1). Banco: `concluir_atividade` sem checar predecessoras, lembretes e subitens; `desfazer_conclusao` não depende das sucessoras (migration `20261026130000_sem_bloqueio.sql`, pgTAP `sem_bloqueio.test.sql`). · usuário

- 2026-10-26 · **Prestador da atividade fica** (escolhido em protótipo: manter x remover). O nome gravado na ficha vira sugestão `prestador` por trigger no banco (`obra_atividade_sugestao_prestador`, conta usos sem repetir na mesma atividade) e a ficha sugere os nomes já usados enquanto se digita (sem diferenciar acento). Na reunião, "Esta semana" mostra o prestador e a providência já vem "Confirmar com <prestador> o início/a conclusão". · usuário

- 2026-10-26 · **Reunião em pauta guiada (opção A)**, escolhida entre três protótipos. Obra a obra em 4 etapas (Semana passada, Esta semana, Providências, Observações); "Não feito" abre a providência para recuperar por cima da pauta, com a atividade atrasada e o **impacto no cronograma só simulado** (core `simularConclusaoEm`, sem gravar); responsável da pauta pode ser **nome digitado** (`tarefa.responsavel_nome`, vira sugestão) e a providência ganha **observação** (`tarefa.observacao`). Ata sem cards de contagem, seções em faixa cinza e estados por ícone (✓ turquesa, ✕ e relógio vermelhos) com texto acessível (`aria-label`) — o formato do ícone diferencia o estado sem depender da cor. Corrige o cabeçalho alto e o rodapé com sobra da tela antiga. · usuário

- 2026-10-26 · **Atividade conclui com ou sem foto** (muda a regra 3 do CLAUDE.md). Sem foto é um toque (na câmera, "Concluir sem foto", ou na ficha), com Desfazer; a atividade fica "Concluída · sem foto" na trilha e na ficha, com "Anexar foto" depois. Banco: `concluir_atividade` aceita foto nula; novas RPCs `anexar_foto_conclusao` (só em concluída sem foto, uma vez, foto da obra) e `desfazer_conclusao` (só quem concluiu, nenhuma sucessora concluída, devolve o XP); idempotentes e com pgTAP. Meta do PRD passa de 100% para ≥ 90% com foto. Pendência continua só fechando com foto de depois (regra 5). · usuário
- 2026-10-26 · **Ajustar prazo e dependências pela linha do tempo** (protótipo aprovado, opção C): na ficha da atividade, três semanas de dias úteis com a atividade, as anteriores e as seguintes; setas para o início (nunca antes das predecessoras; voltar ao mais cedo limpa o início manual) e para a duração (bloqueada quando há subitens); dependências em etiquetas; o efeito na entrega da obra vem do core (`simularAjuste`) e só grava em **Salvar ajustes**, com Desfazer. Substitui os campos com botão "Ajustar". · usuário
- 2026-10-26 · (M11 · modelos no celular) O fluxo principal agora é o do protótipo `ModeloCel` (modelos → fases → atividades → assistente de 5 passos); a **tabela com Gantt** (visão de computador, complementar) continua acessível por "Ver tabela completa com Gantt" na tela do modelo (chegou a sair no PR #45 e voltou a pedido do usuário). **Editar uma atividade** abre o assistente direto na revisão (regra 13) e grava pelo cliente sob RLS, dependências primeiro (se o anti-ciclo recusar, nada mais muda); as outras trocas (nome, duração, subitens, lembretes) não são transacionais entre si. **Remover atividade, excluir fase e excluir modelo** pedem um segundo toque de confirmação (como no protótipo); só o modelo tem Desfazer, porque atividade e fase são apagadas de fato no modelo (as obras já criadas não mudam). O modelo **em branco** nasce sem fases (a RPC `duplicar_modelo` não cria fases). · segue o protótipo
- 2026-10-26 · (M11 · telas de campo) Diferenças intencionais em relação ao protótipo: ficha da atividade mantém "Ajustar prazo e dependências" (recolhível) para não perder início manual, duração e predecessoras; cronograma ganhou "Abrir ficha da atividade"; reunião/ata sem linha de participantes (não é registrado); boletim sem "sai toda segunda às 7h" (o horário é configurável); atraso na tarja de Inauguração em #FF8A80 sobre o preto, como no protótipo. · segue o protótipo
- 2026-10-26 · (M11) **Telas refeitas pelo protótipo aprovado.** As telas tinham estrutura própria (barra global Início/Modelos/Mais, abas em pílula na obra) e não seguiam o protótipo. Decisões: (1) **card e ícone da Maquete 3D omitidos** até a E1 ser aprovada; (2) a aba que o protótipo chama "Suprimentos" se chama **"Providências"** (vale o PRD); (3) sem barra global: **ícone de perfil no cabeçalho do início** abre o painel com Boletim automático, Aprovar membros (só gestor) e Sair (opção A do protótipo de menu); (4) Tarefas saem da obra e viram a tela geral aberta pelo bloco "Tarefas" do início, como no protótipo. · usuário decidiu (1)–(3); (4) segue o protótipo
- 2026-10-25 · (ajuste dos modelos · PR a abrir) **Providências e antecedências do Modelo 1 calibradas pela base histórica.** A partir da análise do ERP de compras da construtora (25 obras "Contorno do Corpo"; ver `docs/analise-padroes-compras-obras.md` e `docs/proposta-modelo1-ajustes.md`), o Modelo 1 ganhou 14 providências novas/alteradas no gerador `supabase/seeds/gen-modelos.mjs` (propagadas aos Modelos 2 e 3 pelas atividades que cada um mantém): empreiteiro civil global (contratação, 20du — subcontratados são ~51% do valor), locações de canteiro/acesso (banheiro químico, betoneira, martelete, caçamba de limpeza permanente), compra antecipada de equipamentos de ar-condicionado (30du) e materiais de incêndio, agregados no contrapiso, itens de longo prazo nos acabamentos (granito/marmoraria 25du, esquadrias de alumínio 30du), start-up do ar no lugar da compra de evaporadoras, paisagismo na fachada, luminárias 15→20du e enxoval CDC (30du). **Sem mudança de atividades, durações ou dependências** (o motor de cronograma e o `anexoA.test.ts` ficam intactos); muda só dado de seed, não a regra em `packages/core`. Decisão central: itens fabricados/encomendados (esquadrias, granito, AC, enxoval) são **comprados no início e instalados no fim** — por isso antecedências longas. Sugestões deixadas para decisão do usuário (não implementadas): dar data-fim às locações e tratar "Enxoval CDC" como bloco próprio (exigiriam SPEC). · usuário aprovou a proposta
- 2026-10-25 · (boletim automático · fatia 3 · PR a abrir) **Push por Web Push, com o SW intacto.** Os handlers de `push`/`notificationclick` entram no service worker gerado via `workbox.importScripts('/push-handlers.js')` — não troca a estratégia do vite-plugin-pwa, então o precache/offline do M9-offline fica igual. Assinaturas em `push_subscription` (RLS: cada um só a sua). A Edge Function `enviar-push-boletim` (service role, `npm:web-push`) lê os disparos não notificados, envia aos gestores inscritos, remove assinaturas 404/410 e marca `notificado_em`. O envio depende de deploy (VAPID, segredos, pg_cron+pg_net) — runbook em `supabase/functions/enviar-push-boletim/README.md`. A lista in-app "prontos para enviar" cobre o "avisar" sem depender do push.
- 2026-10-25 · (boletim automático · fatia 2 · PR a abrir) **Geração agendada por marcador, sem compute server-side de texto.** Como o texto/snapshot do boletim é calculado no core (TS) e a tela Boletim já o monta ao abrir, a fatia 2 não materializa texto no banco: `gerar_disparos_boletim(p_agora)` (SECURITY DEFINER, fuso America/Sao_Paulo) só insere um `boletim_disparo` por obra ativa quando chega o dia/hora de `config_boletim`, com dedup único por (obra, semana, edição). pg_cron roda a cada 15 min e a função checa o horário por dentro (idempotente). A lista "prontos para enviar" e o push consomem esses disparos na fatia 3. Testado por pgTAP (horário, dedup, obra ativa, fechamento).
- 2026-10-25 · (boletim automático · fatia 1 · PR a abrir) **Agendamento do boletim deixa de ser fixo.** O gestor configura dia/hora (global, todas as obras) em `config_boletim` (linha única; RLS só gestor edita), com edição principal + fechamento opcional; os horários do SPEC §11 viram apenas o padrão. Envio = **gerar + avisar** por push (sem API de WhatsApp nem e-mail — a Cloud API não envia para grupos); escopo **global** e aviso por **push** escolhidos pelo usuário. Geração agendada (pg_cron) e push (VAPID/Edge Function) são as fatias 2 e 3.

- 2026-10-25 · (pdf-service · PR a abrir) **Boletim e ata em PDF** (substitui o HTML imprimível): novo pacote `apps/pdf-service` (Node + Express + Playwright) que importa o `@contro/core` e renderiza templates HTML A4 (Nunito Sans, design system; vermelho só para atraso) para PDF via Chromium. Endpoints `POST /boletim` (BoletimDados) e `POST /ata` ({dataFmt, obras}); `GET /health`; `pnpm --filter @contro/pdf-service smoke` gera PDFs de exemplo. Os geradores de HTML são puros e testados no Vitest (roda no CI). **Follow-up (feito, PR a abrir)**: o botão "Baixar PDF" do web (boletim e ata) agora chama o pdf-service quando `VITE_PDF_SERVICE_URL` está configurado (helper `baixarPdf` → POST + download do blob), com fallback para `window.print()` quando não há URL; o serviço ganhou CORS (preflight + `Access-Control-Allow-Origin` por `PDF_CORS_ORIGIN`, default `*`; **em produção, fixar para a origem do app**). A URL é normalizada (sem barra final → evita `//endpoint` 404), o nome do arquivo é sanitizado e o botão desabilita durante o download. **Ainda pendente**: deploy do serviço (container) e o snapshot semanal (pg_cron) que materializa os dados do PDF
- 2026-10-25 · (rename do nome antigo → contro · PR #21) Rename geral do projeto a pedido do usuário: zero referência ao nome antigo em todo o código (pacotes `@contro/*`, tokens `--contro-*`, funções SQL `contro_*`, `project_id` contro, marca/docs/testes, e os nomes internos do zip de logos reempacotados como `CONTRO_*`). Revisão independente: 0 crítico/alto/médio. O `config.toml` também passou a fixar portas próprias do Supabase local (api 54821, studio 54823, inbucket 54824, db 54822/shadow 54820) e desligar o analytics no dev, para não colidir com outros stacks locais — convenção de ambiente, decidida aqui. Pontos sem ação (não são referências de produto): a pasta do workspace no disco mantém o nome antigo (caminho do SO, fora do versionamento); e as imagens de logo contêm essas letras por coincidência dentro de um trecho de base64
- 24/10/2026 · Lembretes sem valor e sem fornecedor · isso fica em outro sistema · usuário
- 24/10/2026 · Vermelho só para atraso (exceção ao CONTRO) · destacar o que está atrasado · usuário
- 24/10/2026 · Faixa de obra na ata em cinza #4A4A4A · vermelho dava a impressão de que todas as obras estavam atrasadas · usuário
- 24/10/2026 · WhatsApp pelo link `wa.me` (sem API) · simplicidade e nenhum risco de bloqueio do número · usuário
- 24/10/2026 · Home sem card de XP e sem contadores; nova obra como ícone "+" · o foco é a obra · usuário
- 24/10/2026 · Cabeçalho da obra sem chips; tarja de Inauguração no fim das fases · simplificar e fixar a meta · usuário
- 24/10/2026 · Tarefas editáveis com replanejamento rastreado e Reabrir/Desfazer · correção de toques acidentais e replanejamento · usuário
- 24/10/2026 · Sem cadastro de feriados; dias úteis seg–sex e ajuste manual de início · não complicar; o usuário empurra a data quando houver feriado · usuário
- 24/10/2026 · Modelo com fases editáveis (renomear, criar, excluir), atividades incluir/remover e subitens em sequência ou paralelo · flexibilidade do modelo · usuário
- 24/10/2026 · Equipe com nomes fictícios no início; nomes digitados viram sugestões (cadastro pelo uso) · sem configuração prévia · usuário
- 24/10/2026 · Símbolo: usar o vetor aprovado da pasta do projeto CONTRO · já disponível · usuário
- 2026-10-24 · Modelo sem versões nem publicação: vários **modelos de obra** salvos (nome + subtítulo), escolhidos ao criar a obra. Lançamento de atividade no celular em assistente de 5 passos. Predecessoras de qualquer fase, sem ciclo (cálculo topológico).
- 2026-10-24 · Só dois perfis: **Gestor** (tudo, inclusive modelos) e **Equipe de obra** (tudo menos editar modelos).
- 2026-10-24 · Maquete 3D gamificada fica como **melhoria E1, fora do plano principal**: antes, estudo de uso de IA e custo. O protótipo navegável serve de referência.
- 2026-10-24 · (auto — recomendado) Repositório próprio do CONTRO em `LuizFPires/contro` (privado→público), isolado do catch-all `Desktop/Claude` · CI e deploy por PR precisam de repo dedicado · usuário aprovou "Repo próprio + GitHub"
- 2026-10-24 · Rename da marca contro → **CONTRO** (só a marca visível: UI, assets, PWA, docs). Mantidos os identificadores internos `@contro/*`, prefixo CSS `--contro-*` e a função SQL `contro_e_membro()` (invisíveis; renomeá-los seria churn e migration no banco sem ganho). Repo renomeado para `LuizFPires/contro`. Projeto Supabase renomeado para `contro` (ref inalterado). · usuário
- 2026-10-24 · (auto — recomendado) Autenticação por **e-mail e senha** (não link mágico) · equipe de campo, login previsível sem depender de abrir o e-mail no celular; link mágico pode entrar depois se preciso
- 2026-10-24 · (auto — recomendado) Hospedagem do PWA na **Vercel** com deploy de preview por PR; CI no **GitHub Actions** (lint, typecheck, vitest) · Vercel já conectado ao ambiente e atende o critério de preview por PR do M0
- 2026-10-24 · (auto — recomendado · M1) Q6 — seed dos modelos com os **prazos provisórios do Anexo A**; o usuário ajusta pelo histórico real direto no editor do Modelo quando tiver os dados · não bloqueia o M1 e é o que o PLAN previa
- 2026-10-24 · (auto — recomendado · M1) `peso(atividade)` isolado no core retornando a **duração** (peso por duração); a opção por custo (Q2) fica para o M5/M10, trocando só essa função · evita efeito colateral
- 2026-10-24 · (auto — recomendado · M1) CRUD de modelo (`salvar_modelo_*`, `duplicar_modelo`, `excluir_modelo`) como **funções RPC no Postgres** (plpgsql, transacional, checagem de perfil gestor), não Edge Functions · mais simples e transacional; Edge Function fica para `gerar_obra` (M2)
- 2026-10-24 · (auto — recomendado · M1) Só `duplicar_modelo` e `excluir_modelo` viram RPC (precisam de transação/regra). As edições granulares (renomear, duração, predecessora, providência, subitem) vão pelo **cliente sob RLS**, pois os constraints e triggers (dur≥1, anti-ciclo, 1 nível, fase com título) já validam no banco · menos código e mesma garantia
- 2026-10-24 · (auto — recomendado · M2) `gerar_obra`, `ajustar_inicio`, `concluir_atividade` e `marcar_subitem` como **RPCs Postgres** (plpgsql, transacionais, SECURITY DEFINER com checagem de perfil+vínculo), não Edge Functions · consistente com o M1 e sem deploy separado; a SPEC citava Edge Function para `gerar_obra`
- 2026-10-24 · (auto — recomendado · M2) Fotos no **Storage** em bucket privado `fotos`, caminho `obra_id/…`, acesso por URL assinada curta; compressão no aparelho (lado maior 1600px, JPEG ~0,75), upload em segundo plano · conforme PRD/SPEC
- 2026-10-24 · (auto — recomendado · M2) Offline completo (fila Dexie) fica no **M9**; no M2 as ações de campo são **otimistas via TanStack Query** (sem a fila ainda), e `concluir_atividade` é confirmada no servidor (exige liberada) · entrega o M2 sem antecipar o M9
- 2026-10-24 · (auto — recomendado · M3) `marcar_providencia` vira **RPC Postgres** que grava `status`, `feito_em` e `feito_por` no servidor (pessoa do `auth.uid()`) · resolve o débito do review do M2 (feito_por não confiável no update direto)
- 2026-10-24 · (auto — recomendado · M3) Incluir/remover lembrete de obra (`obra_providencia`) pelo **cliente sob RLS** (membro), com policy de DELETE adicionada · a tabela e a RLS já vieram do M2; só falta a UI e a policy de remover
- 2026-10-24 · (review de segurança · M3) `obra_providencia.manual` é **server-controlled e imutável** (trigger BEFORE UPDATE), e a policy de DELETE exige `manual` · a policy de UPDATE é aberta a membros; sem a trava, um membro poderia flipar `manual=true` numa providência do modelo e deletá-la, removendo um bloqueio de liberação
- 2026-10-24 · (auto — recomendado · M4) `pendencia`/`pendencia_evento` com RPCs Postgres (`apontar_pendencia`, `resolver_pendencia`, `adiar_pendencia`, `trazer_pendencia`, `vistoriar_pendencia`), SECURITY DEFINER, gravando `*_por`/`*_em` no servidor e o evento; `vistoriar` bloqueia `vistoriada_por = resolvida_por` no servidor (regra 5) · consistente com M1–M3 e garante a regra independente da UI
- 2026-10-24 · (auto — recomendado · M4) Fila = `status='aberta' AND (adiada_ate IS NULL OR adiada_ate <= hoje)` ordenada por `ordem_fila` (derivada no cliente); "Resolver agora"/"Trazer para a fila" fazem `ordem_fila = min−1, adiada_ate = null` · conforme SPEC §5
- 2026-10-24 · (auto — recomendado · M4) **Câmera in-app** via `getUserMedia` (traseira) para apontar e para resolver com **ghost do antes a 40%**; fallback para captura nativa de arquivo (`<input capture>`, sem ghost) quando `getUserMedia` indisponível · o ghost do SPEC exige overlay, impossível na captura nativa
- 2026-10-24 · (auto — recomendado · M4) **Deck de swipe** próprio com Pointer Events (sem lib), limiar 100px e rotação `dx/22`, com botões equivalentes · conforme SPEC; evita dependência
- 2026-10-24 · (auto — recomendado · M4) Cron diário via **pg_cron** (00:10) registra o evento `trazida` das adiadas vencidas; a fila já as inclui por query (`adiada_ate <= hoje`), então a correção visual não depende do cron · robustez sem acoplar a UI ao agendador
- 2026-10-24 · (review M4 · aceito sem correção) Ações de campo das pendências **não são otimistas** (esperam o servidor, feedback por spinner), igual ao M2. O otimismo via `onMutate` + a fila offline Dexie ficam para o **M9** e serão aplicados de forma uniforme a todas as ações de campo; resolver/apontar dependem de upload de foto, limitando o otimismo · evita padrão inconsistente só no M4 (regra 9 cumprida integralmente no M9)
- 2026-10-24 · (auto — recomendado · M5) As **fórmulas** de indicadores (real, previsto_hoje/sexta, ritmo_dias) já estão isoladas no core desde o M2 (`obra.ts` + `peso()` em `schedule.ts`). O M5 adiciona `core/indicadores.ts` apenas com os **helpers de texto/classificação** do ritmo ("N dias à frente" / "No ritmo" / "Atrasada · N dias") e as listas de "Recuperar atraso", sem duplicar as fórmulas · evita duplicação (regra 1)
- 2026-10-24 · (auto — recomendado · M5) Q2 segue por **duração** (`peso()` isolado); troca por custo só quando houver dado de custo · mantém a decisão do M1
- 2026-10-24 · (auto — recomendado · M5) **Gantt próprio** (SVG/CSS, sem lib), por fase, com linha de hoje e cores por estado (concluída turquesa, liberada preto, atrasada vermelho, planejada cinza) · conforme SPEC §5.8, sem dependência
- 2026-10-24 · (auto — recomendado · M5) Editar o cronograma da obra (duração e predecessoras da **cópia**) pelo **cliente sob RLS**, com anti-ciclo no core antes de gravar **e novo trigger anti-ciclo em `obra_dependencia`** (hoje só existe para `modelo_dependencia`); gestor e equipe de obra editam a obra · integridade no banco + consistente com a edição de modelo do M1
- 2026-10-24 · (auto — recomendado · M6) `tarefa`/`tarefa_evento` com escrita só por RPCs Postgres (`salvar_tarefa`, `concluir_tarefa`, `reabrir_tarefa`, `excluir_tarefa`), SECURITY DEFINER, gravando `*_por`/`*_em` e o evento; SELECT por membro · consistente com M4/M5 e garante replanejamento/efeitos no servidor
- 2026-10-24 · (auto — recomendado · M6) Efeito do vínculo: concluir tarefa com vínculo **providência** marca a providência feito e guarda `efeito_providencia_id`; reabrir desfaz se a atividade não foi concluída. Vínculo **atividade** conclui pela **câmera** (fluxo `concluir_atividade`), fora do `concluir_tarefa` · conclusão de atividade exige foto (regra 3), não pode ser automática no servidor
- 2026-10-24 · (auto — recomendado · M6) Replanejamento no servidor (`salvar_tarefa`): mudar o prazo com status aberta preserva `prazo_original` (se nulo) e incrementa `replanejamentos`, com `tarefa_evento('replanejada')` · regra 8
- 2026-10-24 · (auto — recomendado · M6) O §4.7 "Quem faz o quê" (tarefas derivadas de engenheiro/compras) **não entra no M6**: o PLAN do M6 cobre só o CRUD e a tela de tarefas; a derivação aparece no boletim/ata (M7/M8) · escopo do PLAN
- 2026-10-25 · (review M6 · aceito sem correção) **Desfazer em "salvar edição" de tarefa** fica para o M9, junto com o Desfazer uniforme das demais edições (início/prestador/duração/predecessoras) e o otimismo/offline. Concluir e excluir (ações de toque fácil / destrutivas) já têm Desfazer; a edição é por sheet, ação deliberada. Reverter replanejamento exige desfazer prazo + contador + evento · trata-se de forma uniforme no M9
- 2026-10-25 · (usuário · M7/M8) Ata e boletim como **view HTML imprimível** no app (compartilhar por WhatsApp `wa.me` + "imprimir como PDF" do navegador). O **pdf-service** (Node + Playwright) do SPEC fica como **débito de infra** (como aplicar migrations precisa do PAT), a entrar quando houver runtime de navegador · tudo verificável agora, sem infra nova; o HTML imprimível é o mesmo template que o pdf-service renderiza depois
- 2026-10-25 · (auto — recomendado · M7) `core/semana.ts` (§4.6: semana passada previsto×realizado com motivo; esta semana concluir/começar/providenciar) e `core/atribuicoes.ts` (§4.7 "Quem faz o quê") e os textos da ata no core, puros e testados · regra 1 ("textos do boletim e da ata" no core)
- 2026-10-25 · (auto — recomendado · M7) `reuniao`/`reuniao_obra` com `fechar_reuniao` RPC (snapshot por obra); escrita por RPC; cron pg_cron segunda 15:30 cria a pauta (`abrir_reuniao`), e a tela também abre/cria sob demanda · consistente com M4–M6; a reunião não depende do cron para funcionar
- 2026-10-25 · (auto — recomendado · M7) Nova providência na reunião reaproveita o add de providência do M3 (cliente sob RLS, `manual=true`) com vínculo; as **sugestões automáticas** (lembretes atrasados/da semana, atividades atrasadas) vêm do core/atribuições · evita duplicar regra e UI
- 2026-10-25 · (auto — recomendado · M8) `core/boletim.ts`: texto do WhatsApp (SPEC §8.1) derivado do estado da obra (indicadores + semana + atribuições), com **truncagem acima de ~4000 chars** remetendo ao PDF; testes · regra 1 ("textos do boletim" no core); `core/atribuicoes` já existe (M7)
- 2026-10-25 · (auto — recomendado · M8) Boletim é **view derivada ao vivo** da obra (não persiste snapshot no M8): o ícone de boletim no cabeçalho da obra abre Atenção / Quem faz o quê / prévia / **WhatsApp + Imprimir-PDF** (HTML imprimível, como a ata) · entrega o uso imediato; snapshot histórico e o pdf-service ficam como débito
- 2026-10-25 · (auto — recomendado · M8) Cron (segunda 06:30 / sexta 17:00) e **push "Boletim pronto"** ficam como **débito de infra** (push web precisa de service worker push + VAPID/FCM, infra nova); o boletim abre sob demanda a qualquer hora · consistente com a decisão do M7 de adiar infra pesada; o aceite (engenheiro abre e envia) é atendido sem push
- 2026-10-25 · (usuário · M9) **Pivô do M9**: a fila offline (Dexie + idempotência + conflitos) é grande e não verificável sem E2E/dispositivo → vira um **milestone dedicado futuro (M9-offline)**. O M9 agora foca em **destravar o piloto**: guia de go-live (`DEPLOY.md`), README, checklist de prontidão (`PILOTO.md`), com gamificação/a11y se couber · prioriza entrega verificável e o caminho para o piloto real (M10)
- 2026-10-25 · (M9-offline fatia 2 · PR #14) **Concluir atividade com foto em 2º plano**, otimista e idempotente. Foto comprimida no Dexie (`db.fotos`), enfileira `concluir_atividade` com `client_op_id`, upload com retomada, XP/fechamento de fase calculados no **core** (`faseFechaCom`/`xpConclusao`, espelham o RPC). Revisão independente: 0 crítico/alto. Corrigidos: **MÉDIO-1** `drop` das assinaturas antigas de 2 args (`concluir_atividade`, `marcar_providencia`) para não deixar overload sem guard de idempotência; **MÉDIO-3** limpeza do blob no Dexie em rejeição terminal; **BAIXO-2** regra de domínio movida para o core com teste. MÉDIO-2 (rejeição surfaçada) já coberto pela `SyncIndicator` — débito aceito: a celebração de fase aparece otimista e pode reverter se o servidor rejeitar (o aviso "não enviadas" explica)
- 2026-10-25 · (M9-offline fatia 3 · PR a abrir) **Subitem + concluir/reabrir tarefa** otimistas, offline e idempotentes (`client_op_id`). `marcar_subitem`, `concluir_tarefa` e `reabrir_tarefa` ganham o guard `contro_op_nova` (com `drop` das assinaturas antigas de 2/1 arg); a UI faz patch otimista (obra para subitem, lista de tarefas para status) e `invalidar()` agora também invalida `['tarefas', obraId]`. **Deferido para a fatia 4** (com as pendências): `excluir_tarefa`/`restaurar_tarefa` e `salvar_tarefa` (insert) — o undo precisa **cancelar a op na fila** e o insert precisa de **id gerado no cliente** para ser idempotente; hoje seguem online. Edições de cronograma do gestor (duração/predecessoras/prestador/início) não são toque de campo da regra 9 e ficam fora do offline
- 2026-10-25 · (M9-offline fatia 4 · PR a abrir) **Adiar + trazer + vistoriar pendência** otimistas, offline e idempotentes. Os três RPCs ganham `p_client_op_id` + guard `contro_op_nova` (com `drop` das assinaturas antigas); a UI enfileira e faz patch otimista em `['pendencias']` (adiada_ate/motivo, status, ordem_fila via topo do cache) e `invalidar()` passa a invalidar também `['pendencias', obraId]`. Vistoriar é seguro offline porque a regra 5 (vistoriador ≠ resolvedor) já é barrada na UI por `podeVistoriar`. **Fatia 5 (final)**: `resolver` (foto de depois em 2º plano), `apontar_pendencia` e `salvar_tarefa` (inserts com id gerado no cliente) e `excluir`/`restaurar` tarefa (undo cancelando a op pendente no outbox)
- 2026-10-25 · (M9-offline fatia 5a · PR a abrir) **Resolver pendência com foto de depois em 2º plano**, otimista e idempotente — reuso do padrão da fatia 2 (guarda a foto no Dexie, enfileira, sobe com retomada). `resolver_pendencia` ganha `p_client_op_id` + guard (drop da assinatura antiga); a UI manda para vistoria na hora (patch status `em_vistoria` + `resolvida_por` do perfil). **Falta na fatia 5b (final)**: `apontar_pendencia` e `salvar_tarefa` (inserts com id gerado no cliente → `insert on conflict do nothing` + guard) e `excluir`/`restaurar` tarefa (offline, simétricos como concluir/reabrir; op-cancellation do undo é otimização futura)
- 2026-10-25 · (M9-offline fatia 5b · PR a abrir) **Apontar pendência offline** (insert com id gerado no cliente + foto do antes em 2º plano). `apontar_pendencia` passa a receber `p_id` (do cliente) e `p_client_op_id`: `insert ... on conflict (id) do nothing` + guard garantem idempotência mesmo com reenvio (migration nova, drop da assinatura antiga de 6 args). A UI gera o id (o MESMO para o card otimista e para a op, via `onMutate` antes do `mutationFn`), guarda a foto no Dexie e insere a pendência na fila na hora. `enviarFoto` deixou de ser usado no cliente (conclusão/resolver/apontar sobem a foto pelo Dexie). Revisões (commit + independente): corrigido o evento espúrio em colisão de `p_id` (insert usa `returning id`; se nada foi inserido, aborta com 23505 antes do evento — cobre até chamador com `client_op_id` nulo) e o **vazamento de object URL** no card otimista (a miniatura do antes passa a aparecer só após o drain, sem `URL.createObjectURL`). Aceito: o id compartilhado entre card e op via `onMutate` (confirmado correto na revisão; reenvio/ações na pendência nova usam o id real). **Falta a fatia 5c (final)**: `salvar_tarefa` (insert com id do cliente) e `excluir`/`restaurar` tarefa
- 2026-10-25 · (M9-offline fatia 5c · PR a abrir) **Salvar tarefa offline** (insert com id gerado no cliente, espelhando o apontar; edição faz patch otimista). `salvar_tarefa` fica compatível: `p_id` nulo = id do servidor (caminho online da reunião, inalterado); `p_id` do cliente = insert idempotente (`on conflict do nothing` + `returning`/`raise` em colisão) + guard `contro_op_nova`; edição mantém replaneja/edita. Também: `dev-dist/` (gerado pelo PWA em dev) adicionado ao `.gitignore` e aos ignores do ESLint. **Falta a fatia 5d (final)**: `excluir`/`restaurar` tarefa offline (undo cancelando/anulando a op pendente)
- 2026-10-25 · (M9-offline fatia 5c · revisão) 0 crítico/alto/médio, 2 baixos (APPROVE). Aceitos: (a) o replanejamento (regra 8) não é refletido no patch de edição otimista — o contador se corrige no drain; (b) editar um `p_id` inexistente/excluído deixou de dar "Tarefa inválida" (23503) e passa a criar (id livre) ou rejeitar com 23505 (id ocupado) — benigno porque a UI só edita tarefas vivas do cache e ambos os casos são rejeição terminal. `contro_e_membro` global (sem escopo por obra) é pré-existente e condiz com a regra 11
- 2026-10-25 · (M9-offline fatia 5d · PR a abrir) **Excluir/restaurar tarefa offline**, otimistas e idempotentes (simétricos como concluir/reabrir). `excluir_tarefa`/`restaurar_tarefa` ganham `p_client_op_id` + guard (drop das assinaturas de 1 arg); a UI remove/re-adiciona na hora e guarda a tarefa removida num `useRef` para o "Desfazer" (regra 10) re-adicionar mesmo offline. Com isto **a fila offline cobre todas as ações de campo** (conclusão/providência/subitem; concluir/reabrir/salvar/excluir/restaurar tarefa; adiar/trazer/vistoriar/resolver/apontar pendência). **Débitos remanescentes do M9-offline**: aplicar as migrations no Supabase (PAT); conflitos last-write-wins; op-cancellation do undo (hoje excluir+restaurar drenam os dois, estado final correto); E2E/RLS no CI; Lighthouse; edições de cronograma do gestor (não são toque de campo)
- 2026-10-25 · (M9-offline fatia 5d · revisão) 0 crítico/alto/médio, 4 baixos (APPROVE). Corrigidos: o stash `removidas` não acumula mais entradas órfãs (timeout de 8 s libera após a janela do Desfazer) e o `delete` do stash saiu do `onMutate` para o `onSuccess` do restaurar (não some com a tarefa se o enfileiramento falhar); imports do `sync.ts` reordenados. Aceito: sem teste SQL de idempotência (o repo não tem harness SQL; concluir/reabrir idem; a fila é testada no core) — débito junto do E2E/RLS no CI
- 2026-10-25 · (M9-offline fatia 5a · revisão) 0 crítico/alto, 1 médio, 2 baixos. Corrigido o médio (regra 5): `podeVistoriar` agora exige `resolvida_por` não-nulo — na janela otimista offline (perfil não carregado → `resolvida_por=null`) ninguém vistoria até o servidor confirmar, então o próprio resolvedor não fecha a própria pendência. O servidor já garantia a integridade final; isto fecha o furo na UX. Aceitos (baixos): patch de resolver não zera `resolveuNome`/`fotoDepoisUrl` (cosmético até o drain); `resolvida_por` otimista vs `contro_pessoa_atual()` só diverge em aparelho compartilhado com cache de perfil velho (visual, transitório)
- 2026-10-25 · (M9-offline fatia 4 · revisão) 0 crítico/alto/médio, 2 baixos + 1 sugestão. Corrigido: o cálculo do **topo da fila** (regra de domínio, regra 1) saiu do hook para `packages/core` (`topoFila`, com teste) — isso também fecha o LOW-1 (semente 0 divergia do servidor quando toda `ordem_fila > 0`). Aceito como otimismo consciente (LOW-2): vistoriar com cache velho pode piscar "fechada" antes de o servidor rejeitar (regra 5) — a integridade é garantida pelo guard do servidor + rollback + invalidar; a UI já barra o resolvedor por `podeVistoriar`
- 2026-10-25 · (M9-offline fatia 3 · revisão) 0 crítico/alto/médio, 3 baixos aceitos como otimismo consciente: (a) o **efeito de vínculo providência↔tarefa** não entra no patch otimista — offline há janela em que a tarefa aparece "feita" mas a providência vinculada ainda "pendente" (e pode exibir vermelho de atraso) até o drenar/invalidar; (b) o "Desfazer" de concluir **enfileira reabrir** em vez de cancelar a op pendente, então offline drenam os dois (eventos concluída+reaberta; estado final correto) — fechar no futuro cancelando a op pendente no outbox; (c) `QueryClient` sem defaults (refetchOnWindowFocus) pode reverter o otimismo numa janela estreita online — herdado das fatias 1/2, fora do escopo
- 2026-10-25 · (M9-offline fatia 2 · débitos aceitos) **BAIXO-1**: janela de duplicação da linha `foto` se o app morrer entre o insert no servidor e o checkpoint no Dexie — resolver tornando o insert idempotente (unique em `storage_path` ou id derivado do `localId`) quando mexer no schema de fotos. **BAIXO-3**: migration de idempotência sem teste de integração do reenvio (a lógica central da fila já é testada em `core/outbox`) — cobrir com E2E/pgTAP no bloco de testes do M9-offline
- 2026-10-25 · (review M7/M8 · débito registrado) O "Quem faz o quê" da **ata e do boletim** hoje inclui só as **tarefas por responsável** (fonte 1 do §4.7). As fontes 2 (engenheiro: recuperar atraso/garantir conclusão/mobilizar início) e 3 (compras: destravar/contratar/alugar/comprar) **não aparecem** porque o modelo de obra não tem quem é o engenheiro/compras. `core/atribuicoes` já suporta essas fontes (basta passar os nomes). Pendente de **decisão de produto**: como identificar engenheiro/compras por obra (campo na obra? por `papel_texto`?). Herdado do M7, não é regressão do M8
