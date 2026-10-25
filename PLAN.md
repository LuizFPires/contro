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
- [x] Tokens CONTRO em `packages/ui` (cores, raios, Nunito Sans self-hosted, vermelho só como `--obdc-late`)
- [x] Componentes base: Botão (primário, secundário, terciário), Chip, Card, BottomSheet, Toast com "Desfazer", TabBar, Input, Segmented
- [x] Supabase: projeto criado e **Auth e-mail/senha validado de ponta a ponta** (login logado e logout funcionando com o projeto `oaslrtizvfornxjuxpgp`). Falta só o 2º projeto (homologação)
- [x] Tabelas `pessoa` (perfil gestor | equipe), `unidade`, `sugestao` + RLS — migration, políticas, seed e teste pgTAP **aplicados no projeto**
- [x] CI: lint, typecheck, vitest, build — **verde** (GitHub Actions; repo tornado público). Deploy de preview por PR ainda requer ligar a Vercel
- [~] Sentry no web — código pronto (inerte sem DSN); falta o usuário fornecer o DSN
- [x] Importar o símbolo vetorial aprovado da pasta do projeto CONTRO (ícone do app, favicon, cabeçalho)

**Aceite:** login no celular, PWA instalável, tela vazia "Minhas obras" no padrão CONTRO, CI verde.

> **Aceite do M0 validado em 24/10/2026:** login logado de ponta a ponta no app contra o Supabase real, tela "Minhas obras" no padrão CONTRO, logout, CI verde. Migrations + RLS + seed aplicados; usuário de teste `engenheiro@obdc.dev` (gestor).
>
> **Ainda pendente (não bloqueia o M0):** 2º projeto Supabase (homologação), ligar a Vercel ao repo para preview por PR, e DSN do Sentry.
>
> **Débitos técnicos do M0 (resolver antes do M1):**
> - Rodar o teste de RLS (pgTAP) no CI — exige subir o Supabase local (Docker) na pipeline; por ora o teste roda localmente com `supabase test db`.
> - BottomSheet: focus-trap completo (hoje há foco inicial, retorno e trava de scroll; falta prender o Tab dentro do sheet).
> - Vetorizar o símbolo aprovado (hoje é raster embutido em SVG) e unificar a fonte dos assets de marca.

## M1 · Modelos de obra e motor de cronograma
**Objetivo:** o gestor mantém vários modelos de obra, e o core calcula o cronograma de qualquer obra.

- [ ] `core/calendar.ts`: `addDU`, `duEntre` em dias úteis de segunda a sexta (**sem feriados**)
- [ ] `core/schedule.ts`: forward pass (ES/EF), backward pass (LS, folga, crítico), datas a partir do início e entrega
- [ ] Subitens: `dur()` pelo vão (sequência ou paralelo) e `inicio_manual` no forward pass
- [ ] Testes: Modelo 1 (28 atividades, total 54 du), Modelo 2 e Modelo 3 derivados, ciclo rejeitado, subitens de Demolições (5 du), início manual empurrando as sucessoras, dependência múltipla
- [ ] Migrations `modelo`, `modelo_fase`, `modelo_atividade`, `modelo_dependencia`, `modelo_providencia` + RLS (só gestor escreve; equipe lê)
- [ ] `core/schedule.ts` por ordenação topológica (dependência entre quaisquer fases) e detecção de ciclo
- [ ] Seed dos modelos 1 (CDC completo), 2 (CDC sem vestiários) e 3 (Retrofit leve) a partir do Anexo A
- [ ] Tela **Modelos** (celular, só gestor): lista com nome, subtítulo, dias e uso; novo (cópia ou em branco), duplicar, renomear nome/subtítulo, excluir com Desfazer
- [ ] **Assistente de atividade** em 5 passos (nome com sugestões, prazo, começa depois de com abas por fase e busca, providências, revisão); editar abre na revisão
- [ ] Tela `/modelo` (desktop, complementar):
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

> **M5 concluído e mergeado em 24/10/2026 (PR #7).** As fórmulas já estavam no core (M2); adicionado `core/indicadores.ts` (texto do ritmo, dias úteis restantes) e os casos do protótipo (Eldorado 47/53/−3 exatos). Gantt por fase com linha de hoje; tarja de Inauguração enriquecida; editar duração/predecessoras na ficha + trigger anti-ciclo em `obra_dependencia`. Revisão: sem críticos/altos; aplicados ajustes (token `--obdc-bg-app`, 44px e a11y no Gantt, duração só sem subitens, coerência de obra). Desfazer em edições fica p/ M9. CI verde.

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
- [ ] ~~Cron segunda 06:30 / sexta 17:00 + push~~ → **débito de infra** (push web VAPID/FCM)
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

---

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

## Decisões
Registro do que mudou em relação ao PRD/SPEC durante a implementação (data · decisão · motivo · quem).

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
- 2026-10-24 · Rename da marca obdc → **CONTRO** (só a marca visível: UI, assets, PWA, docs). Mantidos os identificadores internos `@obdc/*`, prefixo CSS `--obdc-*` e a função SQL `obdc_e_membro()` (invisíveis; renomeá-los seria churn e migration no banco sem ganho). Repo renomeado para `LuizFPires/contro`. Projeto Supabase renomeado para `contro` (ref inalterado). · usuário
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
- 2026-10-25 · (M9-offline fatia 3 · PR a abrir) **Subitem + concluir/reabrir tarefa** otimistas, offline e idempotentes (`client_op_id`). `marcar_subitem`, `concluir_tarefa` e `reabrir_tarefa` ganham o guard `obdc_op_nova` (com `drop` das assinaturas antigas de 2/1 arg); a UI faz patch otimista (obra para subitem, lista de tarefas para status) e `invalidar()` agora também invalida `['tarefas', obraId]`. **Deferido para a fatia 4** (com as pendências): `excluir_tarefa`/`restaurar_tarefa` e `salvar_tarefa` (insert) — o undo precisa **cancelar a op na fila** e o insert precisa de **id gerado no cliente** para ser idempotente; hoje seguem online. Edições de cronograma do gestor (duração/predecessoras/prestador/início) não são toque de campo da regra 9 e ficam fora do offline
- 2026-10-25 · (M9-offline fatia 4 · PR a abrir) **Adiar + trazer + vistoriar pendência** otimistas, offline e idempotentes. Os três RPCs ganham `p_client_op_id` + guard `obdc_op_nova` (com `drop` das assinaturas antigas); a UI enfileira e faz patch otimista em `['pendencias']` (adiada_ate/motivo, status, ordem_fila via topo do cache) e `invalidar()` passa a invalidar também `['pendencias', obraId]`. Vistoriar é seguro offline porque a regra 5 (vistoriador ≠ resolvedor) já é barrada na UI por `podeVistoriar`. **Fatia 5 (final)**: `resolver` (foto de depois em 2º plano), `apontar_pendencia` e `salvar_tarefa` (inserts com id gerado no cliente) e `excluir`/`restaurar` tarefa (undo cancelando a op pendente no outbox)
- 2026-10-25 · (M9-offline fatia 5a · PR a abrir) **Resolver pendência com foto de depois em 2º plano**, otimista e idempotente — reuso do padrão da fatia 2 (guarda a foto no Dexie, enfileira, sobe com retomada). `resolver_pendencia` ganha `p_client_op_id` + guard (drop da assinatura antiga); a UI manda para vistoria na hora (patch status `em_vistoria` + `resolvida_por` do perfil). **Falta na fatia 5b (final)**: `apontar_pendencia` e `salvar_tarefa` (inserts com id gerado no cliente → `insert on conflict do nothing` + guard) e `excluir`/`restaurar` tarefa (offline, simétricos como concluir/reabrir; op-cancellation do undo é otimização futura)
- 2026-10-25 · (M9-offline fatia 5b · PR a abrir) **Apontar pendência offline** (insert com id gerado no cliente + foto do antes em 2º plano). `apontar_pendencia` passa a receber `p_id` (do cliente) e `p_client_op_id`: `insert ... on conflict (id) do nothing` + guard garantem idempotência mesmo com reenvio (migration nova, drop da assinatura antiga de 6 args). A UI gera o id (o MESMO para o card otimista e para a op, via `onMutate` antes do `mutationFn`), guarda a foto no Dexie e insere a pendência na fila na hora. `enviarFoto` deixou de ser usado no cliente (conclusão/resolver/apontar sobem a foto pelo Dexie). Revisões (commit + independente): corrigido o evento espúrio em colisão de `p_id` (insert usa `returning id`; se nada foi inserido, aborta com 23505 antes do evento — cobre até chamador com `client_op_id` nulo) e o **vazamento de object URL** no card otimista (a miniatura do antes passa a aparecer só após o drain, sem `URL.createObjectURL`). Aceito: o id compartilhado entre card e op via `onMutate` (confirmado correto na revisão; reenvio/ações na pendência nova usam o id real). **Falta a fatia 5c (final)**: `salvar_tarefa` (insert com id do cliente) e `excluir`/`restaurar` tarefa
- 2026-10-25 · (M9-offline fatia 5c · PR a abrir) **Salvar tarefa offline** (insert com id gerado no cliente, espelhando o apontar; edição faz patch otimista). `salvar_tarefa` fica compatível: `p_id` nulo = id do servidor (caminho online da reunião, inalterado); `p_id` do cliente = insert idempotente (`on conflict do nothing` + `returning`/`raise` em colisão) + guard `obdc_op_nova`; edição mantém replaneja/edita. Também: `dev-dist/` (gerado pelo PWA em dev) adicionado ao `.gitignore` e aos ignores do ESLint. **Falta a fatia 5d (final)**: `excluir`/`restaurar` tarefa offline (undo cancelando/anulando a op pendente)
- 2026-10-25 · (M9-offline fatia 5c · revisão) 0 crítico/alto/médio, 2 baixos (APPROVE). Aceitos: (a) o replanejamento (regra 8) não é refletido no patch de edição otimista — o contador se corrige no drain; (b) editar um `p_id` inexistente/excluído deixou de dar "Tarefa inválida" (23503) e passa a criar (id livre) ou rejeitar com 23505 (id ocupado) — benigno porque a UI só edita tarefas vivas do cache e ambos os casos são rejeição terminal. `obdc_e_membro` global (sem escopo por obra) é pré-existente e condiz com a regra 11
- 2026-10-25 · (M9-offline fatia 5a · revisão) 0 crítico/alto, 1 médio, 2 baixos. Corrigido o médio (regra 5): `podeVistoriar` agora exige `resolvida_por` não-nulo — na janela otimista offline (perfil não carregado → `resolvida_por=null`) ninguém vistoria até o servidor confirmar, então o próprio resolvedor não fecha a própria pendência. O servidor já garantia a integridade final; isto fecha o furo na UX. Aceitos (baixos): patch de resolver não zera `resolveuNome`/`fotoDepoisUrl` (cosmético até o drain); `resolvida_por` otimista vs `obdc_pessoa_atual()` só diverge em aparelho compartilhado com cache de perfil velho (visual, transitório)
- 2026-10-25 · (M9-offline fatia 4 · revisão) 0 crítico/alto/médio, 2 baixos + 1 sugestão. Corrigido: o cálculo do **topo da fila** (regra de domínio, regra 1) saiu do hook para `packages/core` (`topoFila`, com teste) — isso também fecha o LOW-1 (semente 0 divergia do servidor quando toda `ordem_fila > 0`). Aceito como otimismo consciente (LOW-2): vistoriar com cache velho pode piscar "fechada" antes de o servidor rejeitar (regra 5) — a integridade é garantida pelo guard do servidor + rollback + invalidar; a UI já barra o resolvedor por `podeVistoriar`
- 2026-10-25 · (M9-offline fatia 3 · revisão) 0 crítico/alto/médio, 3 baixos aceitos como otimismo consciente: (a) o **efeito de vínculo providência↔tarefa** não entra no patch otimista — offline há janela em que a tarefa aparece "feita" mas a providência vinculada ainda "pendente" (e pode exibir vermelho de atraso) até o drenar/invalidar; (b) o "Desfazer" de concluir **enfileira reabrir** em vez de cancelar a op pendente, então offline drenam os dois (eventos concluída+reaberta; estado final correto) — fechar no futuro cancelando a op pendente no outbox; (c) `QueryClient` sem defaults (refetchOnWindowFocus) pode reverter o otimismo numa janela estreita online — herdado das fatias 1/2, fora do escopo
- 2026-10-25 · (M9-offline fatia 2 · débitos aceitos) **BAIXO-1**: janela de duplicação da linha `foto` se o app morrer entre o insert no servidor e o checkpoint no Dexie — resolver tornando o insert idempotente (unique em `storage_path` ou id derivado do `localId`) quando mexer no schema de fotos. **BAIXO-3**: migration de idempotência sem teste de integração do reenvio (a lógica central da fila já é testada em `core/outbox`) — cobrir com E2E/pgTAP no bloco de testes do M9-offline
- 2026-10-25 · (review M7/M8 · débito registrado) O "Quem faz o quê" da **ata e do boletim** hoje inclui só as **tarefas por responsável** (fonte 1 do §4.7). As fontes 2 (engenheiro: recuperar atraso/garantir conclusão/mobilizar início) e 3 (compras: destravar/contratar/alugar/comprar) **não aparecem** porque o modelo de obra não tem quem é o engenheiro/compras. `core/atribuicoes` já suporta essas fontes (basta passar os nomes). Pendente de **decisão de produto**: como identificar engenheiro/compras por obra (campo na obra? por `papel_texto`?). Herdado do M7, não é regressão do M8
