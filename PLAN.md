# PLAN — obdc · plano de implementação por milestones

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
**Objetivo:** projeto rodando ponta a ponta com login e o visual OBDC.

- [x] Monorepo pnpm (`apps/web`, `apps/pdf-service`, `packages/core`, `packages/ui`, `supabase`)
- [x] Vite + React + TS + PWA (manifest, ícone provisório obdc, service worker)
- [x] Tokens OBDC em `packages/ui` (cores, raios, Nunito Sans self-hosted, vermelho só como `--obdc-late`)
- [x] Componentes base: Botão (primário, secundário, terciário), Chip, Card, BottomSheet, Toast com "Desfazer", TabBar, Input, Segmented
- [~] Supabase: projeto de dev e homologação; Auth com e-mail e senha — **código pronto** (cliente + login + useSession); falta o usuário criar os projetos e preencher as variáveis
- [x] Tabelas `pessoa` (perfil gestor | equipe), `unidade`, `sugestao` + RLS (sem feriados) — migration, políticas, seed e teste pgTAP prontos (aplicar requer o projeto Supabase)
- [~] CI: lint, typecheck, vitest; deploy de preview por PR — **CI pronto** (GitHub Actions); preview por PR requer ligar a Vercel ao repositório
- [~] Sentry no web — código pronto (inerte sem DSN); falta o usuário fornecer o DSN
- [x] Importar o símbolo vetorial aprovado da pasta do projeto obdc (ícone do app, favicon, cabeçalho)

**Aceite:** login no celular, PWA instalável, tela vazia "Minhas obras" no padrão OBDC, CI verde.

> **Pendências de credencial (só o usuário):** criar projetos Supabase (dev + homologação), ligar a Vercel ao repo para preview por PR, e fornecer o DSN do Sentry. O restante do M0 está implementado e verde.
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

- [ ] Migrations `obra`, `obra_atividade`, `obra_dependencia`, `foto` + RLS por perfil e vínculo
- [ ] `gerar_obra` (Edge Function, transacional): copia o modelo escolhido e grava `modelo_rotulo`
- [ ] Tela **Nova obra**: unidade, segundas disponíveis, **escolha do modelo** e prévia (atividades, lembretes, dias úteis, fases com datas, entrega)
- [ ] **Carteira:**
  - título com ícone "+";
  - atalhos Reunião e Tarefas (placeholders até M6/M7);
  - card da obra (fase, %, 6 segmentos, ritmo, entrega, aviso de atraso)
- [ ] **Cabeçalho da obra:** nome, "Dia N de M", %, barra e ícone de boletim (placeholder até M8)
- [ ] **Fases:**
  - trilha com 6 fases e estados;
  - expandir fase;
  - itens com estado e motivo de bloqueio
- [ ] **Ficha da atividade** (bottom sheet): situação, datas, prestador (texto opcional, com sugestões), depende de / libera
- [ ] **Subitens** na ficha: checklist com prazo; marcar sem foto obrigatória; a atividade só conclui com todos marcados
- [ ] **Ajustar início** (manual): escolher a nova data; as sucessoras recalculam; o evento é registrado
- [ ] Câmera de conclusão (captura, compressão, upload em segundo plano) → `concluir_atividade` (exige liberada)
- [ ] Celebração de fase concluída com o que foi liberado
- [ ] Toast "liberou X" ao concluir

**Aceite:** criar a obra "CDC Sete Lagoas", concluir Mobilização com 3 fotos, ver a celebração e a Fase 2 liberada. O tempo de criação da obra fica abaixo de 2 minutos.

## M3 · Lembretes de providência e liberação
**Objetivo:** nada trava por falta de contratação, locação ou compra.

- [ ] Migration `obra_providencia` + RLS (compras pode alterar o status)
- [ ] `core/providencias.ts`: limite, providenciar até, na obra em, atrasada
- [ ] Liberação = predecessoras + providências (`core`), com testes
- [ ] Aba **Providências:** grupos Atrasados (vermelho) e A providenciar, "Marcar como providenciado" e o contador de já providenciados
- [ ] Na ficha da atividade: lista "Para começar" com + Contratação / + Locação / + Compra
- [ ] Formulário do lembrete: tipo, o que, precisa estar na obra em (padrão: início da atividade), situação. **Sem valor e sem fornecedor**
- [ ] Badge vermelho de lembretes atrasados na aba

**Aceite:** marcar "Porcelanato e argamassa" como providenciado libera "Revestimento cerâmico" na hora, com o toast "liberou…". Um lembrete vencido aparece em vermelho com "era para providenciar até…".

## M4 · Pendências
**Objetivo:** pendência registrada com foto, resolvida com antes e depois, sem nada se perder.

- [ ] Migrations `pendencia`, `pendencia_evento` + RLS
- [ ] Apontar (ícone de câmera): foto → título, local, criticidade e atividade
- [ ] **Fila:** deck com swipe (limiar de 100 px, rotação, selos RESOLVIDA/ADIAR) e botões equivalentes
- [ ] **Resolver:** câmera com o **ghost do antes** (40%) → em vistoria
- [ ] **Adiar:** sheet com data de retorno (4 opções) e motivo (4 opções) → sai da fila; toast com "Desfazer"
- [ ] **Lista completa:** Na fila ("Resolver agora"), Adiadas ("Trazer para a fila"), Em vistoria, Concluídas
- [ ] **Vistoria:** antes e depois lado a lado, Aprovar / Reabrir; bloquear quando o vistoriador é quem resolveu
- [ ] Cron diário: devolver adiadas vencidas à fila

**Aceite:** adiar até ter 27/10 com "aguardando material" → a pendência some da fila e aparece em Adiadas; Desfazer devolve. Quem resolveu não consegue aprovar a própria vistoria.

## M5 · Cronograma, indicadores e inauguração
**Objetivo:** ler a saúde da obra num olhar.

- [ ] `core/indicadores.ts`: real, previsto hoje e sexta, ritmo em dias, atrasos (atividades e lembretes); `peso()` isolado (Q2)
- [ ] Testes com os casos do protótipo (Eldorado 47%, 53%, −3 dias; Pampulha; Betim)
- [ ] Aba **Cronograma:** Gantt por fase, linha de hoje, cores por estado, detalhe ao tocar (situação, prestador, lembretes, depende de, libera)
- [ ] Carteira e cabeçalho com os indicadores reais
- [ ] **Tarja Inauguração** no fim da trilha de fases: data por extenso, dias úteis restantes e atraso do ritmo
- [ ] Editar o cronograma da obra (duração e predecessoras da cópia), gestor e equipe de obra

**Aceite:** os números batem com os casos de teste; a tarja mostra a data correta e acompanha os ajustes manuais de início.

## M6 · Tarefas
**Objetivo:** quem faz o quê, até quando, com baixa ao longo da semana.

- [ ] Migrations `tarefa`, `tarefa_evento` + RLS (o responsável conclui e edita o texto; qualquer perfil pode trocar o responsável, com evento registrado)
- [ ] Tela **Tarefas:**
  - filtro por pessoa com o contador de atrasadas;
  - grupos Atrasadas, Abertas e Concluídas;
  - vínculo exibido
- [ ] **Concluir** (um toque) com "Desfazer". Efeitos do vínculo:
  - lembrete → providenciado (grava o efeito);
  - atividade → câmera
- [ ] **Reabrir** (botão e toque no check). Desfaz o efeito no lembrete se a atividade não foi concluída
- [ ] **Editar** (sheet): texto, responsável, prazo (atalhos ou dd/mm com validação), situação; excluir com "Desfazer"
- [ ] **Replanejamento:** `prazo_original` e `replanejamentos`; exibir "Replanejada Nx · prazo original…"
- [ ] Atalho Tarefas na carteira com abertas e atrasadas

**Aceite:** concluir "Garantir porcelanato…" libera o revestimento; reabrir faz o lembrete voltar para "a providenciar"; mudar o prazo de 21/10 para 03/11 mostra "Replanejada 1x · prazo original qua 21/10".

## M7 · Reunião semanal e ata
**Objetivo:** a reunião de segunda às 16h acontece dentro do app e gera a ata.

- [ ] Migrations `reuniao`, `reuniao_obra` + cron (segunda 15:30 cria a pauta)
- [ ] `core/semana.ts`: semana passada previsto x realizado (com motivo), esta semana (concluir, começar, providenciar)
- [ ] Tela **Reunião:** KPIs (cumpridas, atrasadas, novas). Card por obra com:
  - faixa **cinza #4A4A4A**;
  - semana passada;
  - providências anteriores;
  - esta semana;
  - observações;
  - novas providências
- [ ] **Nova providência:** sugestões automáticas da obra (lembretes atrasados e da semana, atividades atrasadas) com vínculo; responsável; prazo; editar e excluir pelas mesmas regras do M6
- [ ] **Fechar reunião** → snapshot por obra → **Ata** (obra a obra + compilado por responsável)
- [ ] Ata no WhatsApp (`wa.me`) e PDF (pdf-service, template do SPEC 8.3)

**Aceite:** com 3 obras, a pauta abre pronta; registrar 6 providências em menos de 15 minutos; fechar gera a ata em PDF idêntica ao modelo aprovado (cinza na faixa, vermelho só no que está atrasado).

## M8 · Boletim semanal
**Objetivo:** todo grupo de obra recebe o resumo da semana em um toque.

- [ ] `core/atribuicoes.ts` (SPEC 4.7) e `core/boletim.ts` (texto do WhatsApp, SPEC 8.1), com testes de snapshot
- [ ] Tela **Boletim** (ícone no cabeçalho da obra):
  - Atenção;
  - Quem faz o quê;
  - prévia da mensagem;
  - botões **WhatsApp** e **Baixar PDF**
- [ ] pdf-service: template do boletim (SPEC 8.2) com Nunito Sans embutida, margens e quebras corretas
- [ ] Cron segunda 06:30 (edição de segunda) e sexta 17:00 (fechamento) + push "Boletim pronto para enviar"
- [ ] Truncar o texto do WhatsApp acima de ~4.000 caracteres, remetendo ao PDF

**Aceite:** às 07:00 de segunda o engenheiro abre o boletim, toca em WhatsApp, escolhe o grupo e envia. O PDF tem 3 páginas no máximo para uma obra típica.

## M9 · Offline, gamificação e endurecimento
**Objetivo:** confiável em campo e agradável de usar.

- [ ] Fila offline Dexie com `client_op_id` idempotente para todas as ações de campo
- [ ] Upload de fotos em segundo plano com retomada
- [ ] Indicador discreto "x ações aguardando sinal"
- [ ] Conflitos: last write wins por campo; reversão com explicação quando o servidor recusar a conclusão
- [ ] Gamificação:
  - XP da equipe (registrado, sem card na home);
  - conquistas da obra;
  - celebração de fase (revisão final)
- [ ] Performance: abrir a obra em < 1,5 s em 4G; toques < 100 ms; auditoria Lighthouse PWA ≥ 90
- [ ] Acessibilidade: contraste AA, foco visível e leitores de tela nos controles de swipe (botões equivalentes)
- [ ] E2E completos (SPEC 12) e testes de RLS por perfil

**Aceite:** em modo avião, concluir atividade, apontar pendência, marcar lembrete e concluir tarefa; ao reconectar, tudo sincroniza sem duplicar.

## M10 · Piloto
**Objetivo:** uma obra real do início ao fim no obdc.

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
- 24/10/2026 · Vermelho só para atraso (exceção ao OBDC) · destacar o que está atrasado · usuário
- 24/10/2026 · Faixa de obra na ata em cinza #4A4A4A · vermelho dava a impressão de que todas as obras estavam atrasadas · usuário
- 24/10/2026 · WhatsApp pelo link `wa.me` (sem API) · simplicidade e nenhum risco de bloqueio do número · usuário
- 24/10/2026 · Home sem card de XP e sem contadores; nova obra como ícone "+" · o foco é a obra · usuário
- 24/10/2026 · Cabeçalho da obra sem chips; tarja de Inauguração no fim das fases · simplificar e fixar a meta · usuário
- 24/10/2026 · Tarefas editáveis com replanejamento rastreado e Reabrir/Desfazer · correção de toques acidentais e replanejamento · usuário
- 24/10/2026 · Sem cadastro de feriados; dias úteis seg–sex e ajuste manual de início · não complicar; o usuário empurra a data quando houver feriado · usuário
- 24/10/2026 · Modelo com fases editáveis (renomear, criar, excluir), atividades incluir/remover e subitens em sequência ou paralelo · flexibilidade do modelo · usuário
- 24/10/2026 · Equipe com nomes fictícios no início; nomes digitados viram sugestões (cadastro pelo uso) · sem configuração prévia · usuário
- 24/10/2026 · Símbolo: usar o vetor aprovado da pasta do projeto obdc · já disponível · usuário
- 2026-10-24 · Modelo sem versões nem publicação: vários **modelos de obra** salvos (nome + subtítulo), escolhidos ao criar a obra. Lançamento de atividade no celular em assistente de 5 passos. Predecessoras de qualquer fase, sem ciclo (cálculo topológico).
- 2026-10-24 · Só dois perfis: **Gestor** (tudo, inclusive modelos) e **Equipe de obra** (tudo menos editar modelos).
- 2026-10-24 · Maquete 3D gamificada fica como **melhoria E1, fora do plano principal**: antes, estudo de uso de IA e custo. O protótipo navegável serve de referência.
- 2026-10-24 · (auto — recomendado) Repositório próprio do obdc em `LuizFPires/obdc` (privado), isolado do catch-all `Desktop/Claude` · CI e deploy por PR precisam de repo dedicado · usuário aprovou "Repo próprio + GitHub"
- 2026-10-24 · (auto — recomendado) Autenticação por **e-mail e senha** (não link mágico) · equipe de campo, login previsível sem depender de abrir o e-mail no celular; link mágico pode entrar depois se preciso
- 2026-10-24 · (auto — recomendado) Hospedagem do PWA na **Vercel** com deploy de preview por PR; CI no **GitHub Actions** (lint, typecheck, vitest) · Vercel já conectado ao ambiente e atende o critério de preview por PR do M0
