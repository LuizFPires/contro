# Obras gerais · Etapa 4: reunião, Check list, providências, boletim e "Reunião e avisos" por obra · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Levar às Obras gerais o ciclo semanal da Contorno, **por obra**: reunião com pauta, ata e tarefas; Check list de pendências com antes e depois; lembretes de providência; boletim (WhatsApp/PDF e automático); e a tela **Reunião e avisos** da obra (o Coordenador configura as obras dele; Administradores, qualquer obra geral). Ações da equipe e avisos passam a incluir tarefas, pendências e providências.

**Architecture:** Banco aditivo: `reuniao.obra_id` (nulo = reunião única da Contorno), `config_avisos_obra` e `config_boletim_obra` por obra geral; RPCs de reunião, tarefa e pendência abertas a quem participa da obra geral pelo padrão já usado na etapa 2 (cópia literal + `contro_tem_acesso()` + `contro_ve_obra(obra)`; ações de planejar exigem `contro_planeja_obra`); rotinas novas/estendidas só para obra geral. Core ganha a semana por datas previstas, o boletim por datas e o prazo de providência a partir da data prevista. Web reaproveita as telas da Contorno onde elas aceitam um tipo mínimo de obra e cria telas gerais onde a da Contorno depende do cronograma (reunião, boletim).

**Tech Stack:** React 18 + TypeScript, TanStack Query, Dexie, Supabase (Postgres, RLS, pg_cron, pgTAP), pdf-service (sem mudança), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` (Reunião e Ações da equipe; A13, A15, C1, C13; "Escolhas minhas": boletim por obra, uma data só).

## Decisões desta etapa (rulings do controlador; registrar em PLAN "Decisões")

1. **Reunião por obra geral:** uma reunião por obra e data (`reuniao.obra_id`). A reunião única da Contorno (`obra_id` nulo) não muda. Fechar/reabrir a ata e criar/atribuir tarefas = quem planeja a obra (Coordenador, Administrador); responder itens e observações = qualquer participante.
2. **Pauta e ata por datas:** sem cronograma; "semana passada" = atividades de topo com prazo na semana anterior (concluídas no prazo, concluídas com atraso, abertas atrasadas); "esta semana" = prazo de segunda a sexta da semana da reunião; cobrança = tarefas abertas da obra. Sem "começar", sem ritmo em dias úteis.
3. **Tarefas em obra geral:** criar, editar, atribuir, excluir e restaurar = quem planeja; concluir, reabrir e informar avanço = qualquer participante. Responsável = pessoa da obra ou Administrador (sem nome livre até a etapa 5).
4. **Pendências em obra geral:** apontar, resolver (foto do depois), editar, reabrir, excluir/restaurar = qualquer participante (como a equipe na Contorno); atribuir responsável = quem planeja.
5. **Providências em obra geral:** criar e remover = quem planeja; marcar = qualquer participante (já existe). Prazo `providenciar_ate` = data prevista da atividade menos a antecedência em dias úteis, recalculado no banco quando a data muda.
6. **"+ nota" da nova atividade** sai do escopo (não há campo de nota na atividade da Contorno; o prestador/observação já cobre); só "+ lembrete de providência" entra.
7. **Avisos por obra:** `config_avisos_obra` (mesmas colunas da `config_avisos`, sem linha = valores da linha global). Ações do dia continuam **um aviso por pessoa** somando as obras, enviado na hora mais cedo entre as obras dela (dedupe diário existente). Lembretes de reunião de obra geral: tipos `reuniao_manha_geral` e `reuniao_antes_geral`, um por pessoa por dia; com reuniões de duas obras no mesmo dia, o da manhã lista as duas e o "antes de começar" vale para a primeira (limite aceito).
8. **Boletim por obra geral:** `config_boletim_obra` (ativo, dia, hora, fechamento) configurada por Administradores; disparo `gerar_disparos_boletim_geral` grava `boletim_disparo` e um aviso `boletim_geral` para Coordenadores da obra e Administradores; envio ao WhatsApp continua manual (como na Contorno).
9. **Filtro mínimo na Contorno:** `reuniaoApi.loadReuniao` e `ReunioesScreen` passam a filtrar `obra_id is null` (resultado igual para a Contorno; sem isso duas reuniões na mesma data quebrariam a tela).

## Global Constraints

- **A Contorno não muda** (exceto a decisão 9, sem efeito visível). `gerar_avisos`, `gerar_disparos_boletim`, `abrir_reuniao`, `reabrir_reuniao`, `fechar_reuniao`, `config_avisos`, `config_boletim` e as telas da Contorno ficam com o mesmo resultado. Testes pgTAP provam isso.
- Padrão de RPC aberta a obra geral: cópia literal da versão mais recente + entrada `contro_tem_acesso()` + `contro_ve_obra(obra)` (42501) e, para planejar, `contro_planeja_obra(obra)` (42501). Para obra Contorno o resultado tem de ser idêntico ao de hoje.
- Responsável em obra geral (tarefa, pendência): `contro_valida_responsavel_geral` (22023). Nome livre recusado em obra geral (22023).
- Erros: 42501 sem acesso/papel; 22023 dado inválido; 23503 item inexistente/outra obra; 23505 tipo de obra errado.
- URLs de aviso de Obras gerais: `/?ir=geral-hoje` (ações, atribuição), `/?ir=geral-reuniao&obra=<id>` (reunião), `/?ir=geral-boletim&obra=<id>` (boletim).
- Textos: os mesmos da Contorno onde a tela é a mesma; telas novas usam o vocabulário do CLAUDE.md; datas "qua 21/10"; sem emoji no app/PDF (WhatsApp segue `core/whatsapp.ts`).
- Regra 1 (core com teste), migrations com pgTAP, exclusão lógica, Desfazer 5 s, offline nas ações de campo (tarefas e pendências já usam a fila).
- Design system CONTRO, toque ≥ 44 px.
- Commits pt-BR imperativo; branch `obras-gerais-4`; CLI `npx -y supabase@2`. Migrations: `20261106300000_obras_gerais_reuniao.sql`, `20261106310000_obras_gerais_tarefas_pendencias.sql`, `20261106320000_obras_gerais_avisos_obra.sql`, `20261106330000_obras_gerais_boletim.sql`.

## Review Focus

1. Duas reuniões na mesma data (Contorno + obra geral, ou duas obras gerais) não se misturam em nenhuma tela nem RPC. pgTAP na Task 2; tela na Task 6.
2. Membro de obra geral tentando atribuir tarefa/pendência ou fechar a ata → 42501; concluir tarefa/pendência → ok. pgTAP Tasks 2–3.
3. Mudar a data prevista de atividade com providência pendente recalcula `providenciar_ate`. pgTAP Task 4.
4. Pessoa em duas obras gerais recebe um só aviso de ações do dia, com o total das duas. pgTAP Task 4.
5. Pessoa só da Contorno nunca vê reunião, pendência, tarefa ou boletim de obra geral (e vice-versa). pgTAP Tasks 2–5.

---

### Task 1: Core: semana, boletim e providência por datas

**Files:** Create `packages/core/src/obraGeralSemana.ts` (+ test); export no `index.ts`.

**Produces:**
- `semanaDaReuniaoGeral(e: { atividades: AtividadeGeral[]; dataReuniao: DataISO; hoje: DataISO }): { passadaNoPrazo: AtividadeGeral[]; passadaComAtraso: AtividadeGeral[]; atrasadasAbertas: AtividadeGeral[]; daSemana: AtividadeGeral[] }` — semana = segunda a sexta da `dataReuniao`; passada = semana anterior; usa `prazoAtividadeGeral`, `prazoOriginalAtividadeGeral`, `atrasoDU`; só atividades de topo não excluídas.
- `montarBoletimGeral(e: { obra: { nome: string; cidade: string | null }; atividades: AtividadeGeral[]; nomes: Record<string, string>; hoje: DataISO; quemFazOQue: BoletimDados['quemFazOQue'] }): BoletimDados` — mesmo tipo do `core/boletim.ts`: `realPct` = concluídas/total de topo; `previstoSextaPct` = topo com prazo ≤ sexta da semana / total; `ritmoTexto` = `textoEficiencia(...) ?? ''`, `ritmoAtrasado` = false; atrasos = abertas atrasadas; concluir = abertas com prazo nesta semana; começar = []. Confira os campos obrigatórios de `BoletimDados` e preencha os que não se aplicam com vazio neutro; `textoBoletimWhatsapp` tem de funcionar com ele (teste).
- `providenciarAteGeral(dataPrevista: DataISO, antecedenciaDu: number): DataISO` — `deslocarDU`/`addDU` para trás; antecedência 0 = a própria data.
- **Steps:** testes (semana com reunião numa quarta; boletim com 4 atividades; `textoBoletimWhatsapp(montarBoletimGeral(...))` não lança e contém o nome da obra; providência de 3 d.u. antes de uma segunda cai na quarta anterior) → ver falhar → implementar → passar → commit `adiciona a semana, o boletim e a providência por datas no core`.

---

### Task 2: Banco: reunião por obra geral

**Files:** `supabase/migrations/20261106300000_obras_gerais_reuniao.sql`, `supabase/tests/obras_gerais_reuniao.test.sql`.

- `reuniao.obra_id uuid null references obra`; trocar `unique(data)` por `create unique index reuniao_contorno_data on reuniao(data) where obra_id is null` e `create unique index reuniao_obra_data on reuniao(obra_id, data) where obra_id is not null`. Recriar **`abrir_reuniao` e `reabrir_reuniao` como cópia literal** com o `on conflict (data) where obra_id is null` e o `where obra_id is null` nas buscas por data (a Contorno continua igual).
- `reuniao_sel`: `(obra_id is null and contro_e_membro()) or (obra_id is not null and contro_ve_obra(obra_id))`.
- RPCs novas (security definer, `search_path=''`, grants como as demais): `abrir_reuniao_geral(p_obra_id uuid, p_data date) returns uuid` (participante; obra geral senão 23505; hora de `config_avisos_obra` da obra → global → '16:00'; cria a `reuniao_obra` única; idempotente; não mexe em reunião fechada), `fechar_reuniao_geral(p_id uuid, p_snapshot jsonb)` e `reabrir_reuniao_geral(p_id uuid)` (quem planeja).
- `salvar_observacao_reuniao` e `responder_reuniao`: cópia literal com entrada `contro_tem_acesso()` + `contro_ve_obra(obra)` (a obra do `reuniao_obra`/do item).
- **pgTAP:** Contorno abre a reunião única como hoje (mesma linha, mesmas obras); reunião geral na mesma data coexiste; participante abre/responde; Membro não fecha (42501); Coordenador fecha/reabre; pessoa só da Contorno não lê a reunião geral e vice-versa; segunda chamada de `abrir_reuniao_geral` devolve o mesmo id.
- Commit `adiciona a reunião por obra geral`.

---

### Task 3: Banco: tarefas e pendências em obra geral

**Files:** `supabase/migrations/20261106310000_obras_gerais_tarefas_pendencias.sql`, `supabase/tests/obras_gerais_tarefas_pendencias.test.sql`.

- Cópia literal (versão mais recente de cada) com o padrão das Global Constraints e as regras das decisões 3–4: `salvar_tarefa` (planejar se obra geral; valida responsável geral; recusa nome livre), `concluir_tarefa`, `reabrir_tarefa`, `informar_avanco_tarefa` (participante), `excluir_tarefa`, `restaurar_tarefa` (planejar); `apontar_pendencia`, `resolver_pendencia`, `editar_pendencia`, `reabrir_pendencia`, `excluir_pendencia`, `restaurar_pendencia` (participante), `atribuir_pendencia` (planejar + responsável geral).
- `notificar_atribuicao_tarefa`: cópia literal; em obra geral a URL é `/?ir=geral-hoje` e só avisa responsável participante ou Administrador.
- **pgTAP:** Membro conclui tarefa e informa avanço; Membro não cria/atribui tarefa (42501); Coordenador cria tarefa com responsável da obra e com Administrador; responsável de fora → 22023; Membro aponta e resolve pendência com foto; Membro não atribui pendência; membro só da Contorno → 42501 em tudo da obra geral; Contorno inteira igual (membro da Contorno cria tarefa com nome livre, atribui pendência como hoje).
- Commit `abre tarefas e pendências às obras gerais`.

---

### Task 4: Banco: Reunião e avisos por obra, providências e ações do dia completas

**Files:** `supabase/migrations/20261106320000_obras_gerais_avisos_obra.sql`, `supabase/tests/obras_gerais_avisos_obra.test.sql`.

- `config_avisos_obra (obra_id uuid primary key references obra, reuniao_dia, reuniao_hora, manha_ativo, manha_hora, antes_ativo, antes_min, acoes_ativo, acoes_hora, pend_alta_du, pend_media_du, pend_baixa_du, provid_ativo, provid_hora, updated_at, updated_by)` com os mesmos CHECKs da `config_avisos`; RLS select `contro_ve_obra(obra_id)`; escrita só por `salvar_config_avisos_obra(p_obra_id uuid, p_config jsonb)` (obra geral; `contro_planeja_obra`; upsert) e leitura efetiva por `config_avisos_da_obra(p_obra_id) returns jsonb` (linha da obra ou valores da global).
- `contro_prazo_pendencia_du(p_criticidade text, p_apontada_em timestamptz, p_alta int, p_media int, p_baixa int) returns date` (a original fica intacta).
- Providências: gatilho que grava `providenciar_ate` (= `contro_add_du(prazo da atividade, -antecedencia_du)` espelhando `providenciarAteGeral`) em insert/update de `obra_providencia` de obra geral e quando o prazo efetivo da atividade muda (inclui subitens); RLS de criar/remover continua `contro_planeja_obra`.
- `gerar_avisos_gerais` (recriar, a partir da versão de `20261106200000`): ações do dia somam atividades + tarefas abertas + pendências abertas (prazo pela config da obra) + providências pendentes sem tarefa (com `providenciar_ate`) por pessoa, sem contar duas vezes a atividade com tarefa vinculada aberta; horário/ativo por obra (decisão 7); lembretes de reunião `reuniao_manha_geral`/`reuniao_antes_geral` para os participantes e Administradores das obras com reunião no dia (texto "Reunião hoje às 16:00 · {obra}" / "Começa em 30 min · {obra}"; duas obras: "Reuniões hoje: {obra} 16:00 · {obra} 10:00"), URL de reunião; ampliar o CHECK de `aviso_disparo`.
- **pgTAP:** config da obra muda o horário do aviso; sem linha usa a global; Coordenador salva a config da obra dele, Membro não, Coordenador de outra obra não; providência de 3 d.u. ganha `providenciar_ate` e é recalculada ao replanejar; pessoa em duas obras recebe 1 `acoes_geral` com a soma; tarefa vinculada à atividade não conta duas vezes; lembretes de reunião na hora e no dia certos; a Contorno não muda.
- Commit `adiciona reunião e avisos por obra geral`.

---

### Task 5: Banco: boletim por obra geral

**Files:** `supabase/migrations/20261106330000_obras_gerais_boletim.sql`, `supabase/tests/obras_gerais_boletim.test.sql`.

- `config_boletim_obra (obra_id pk, ativo, dia_semana, hora, fechamento_ativo, fechamento_dia, fechamento_hora, updated_at, updated_by)` com os CHECKs da `config_boletim` (ler a migration `20261025000000`); select `contro_ve_obra`; escrita por `salvar_config_boletim_obra(p_obra_id, p_config jsonb)` só Administrador.
- `gerar_disparos_boletim_geral(p_agora)` (espelha `gerar_disparos_boletim` da versão `20261105230000`, só obras gerais ativas com config ativa): grava `boletim_disparo` (mesmo `unique`) e um aviso `boletim_geral` por destinatário (Coordenadores da obra + Administradores; corpo "Boletim pronto · {obra}"; URL de boletim); cron `boletim-geral` idempotente.
- Política de update de `boletim_disparo` (marcar enviado): Contorno como hoje; obra geral = `contro_planeja_obra(obra_id)`.
- **pgTAP:** disparo no dia/hora; sem config não dispara; Coordenador marca enviado na obra dele; Membro não; `gerar_disparos_boletim` da Contorno igual.
- Commit `adiciona o boletim por obra geral`.

---

### Task 6: Web: Reunião e avisos da obra, reunião da obra e Reuniões

- **Reunião e avisos da obra (C13):** mesma aparência de `ConfigAvisosScreen`, parametrizada pela obra (`useConfigAvisosObra(obraId)` lendo `config_avisos_da_obra` e salvando por `salvar_config_avisos_obra`), sem "Providências para todos/gestores" (vai para quem planeja), texto "Vale para esta obra". Acesso pelo perfil: item **"Reunião e avisos"** para Coordenador (suas obras; com mais de uma, escolhe pelo `TrocarObraSheet`) e Administrador em Obras gerais.
- **Reunião da obra:** bloco **Reunião** no topo da obra (próxima reunião "seg 09/11 · 16h" + "Pauta, preparar e atas", como na Contorno) → tela da reunião da obra: pauta com as seções da decisão 2 (`semanaDaReuniaoGeral`), cobrança das tarefas abertas, respostas (`responder_reuniao`), observação, fechar a ata (quem planeja), ata no WhatsApp (`textoAtaWhatsapp` com os dados gerais) e PDF pela impressão como na Contorno; tarefas criadas na ata pela `TarefaSheet` com a lista de pessoas da obra. Reaproveitar componentes de `features/reuniao` que não dependem de cronograma; o restante em `features/obras-gerais/reuniao/`.
- **Reuniões (A15)** para Administradores: lista uma reunião por obra geral (próxima + atas passadas).
- Filtro `obra_id is null` em `reuniaoApi.loadReuniao` e `ReunioesScreen` (decisão 9).
- Deep link `/?ir=geral-reuniao&obra=<id>`.
- Verificar no navegador: Coordenador configura dia/hora e vê o bloco; Membro responde; Coordenador fecha a ata; Contorno: tela de reunião igual. Commit `adiciona a reunião e os avisos por obra geral`.

---

### Task 7: Web: Check list e providências na obra geral

- **Check list:** seção/aba "Check list" na obra geral (mesma `PendenciasAba` com tipo mínimo de obra `{id, nome, fases, atividades}`; Contorno sem mudança), apontar com foto (antes), resolver com foto (depois), Pendências/Resolvidos, PDF por responsável; responsável escolhido entre as pessoas da obra (`ObraGeral.pessoas`) e só por quem planeja; pendências da atividade na ficha geral.
- **Providências:** seção "Para começar" na `FichaAtividadeGeral` (marcar = todos; "+ Contratação/Locação/Compra" e remover = quem planeja) e "+ lembrete de providência" na `NovaAtividadeGeralSheet` (antecedência em d.u.); `NovaProvidenciaSheet` aceitando o tipo mínimo de obra.
- Verificar no navegador; commit `adiciona o check list e as providências na obra geral`.

---

### Task 8: Web: boletim da obra geral

- Ícone de boletim no cabeçalho da obra geral → tela do boletim (`montarBoletimGeral` + `quemFazOQueBoletim` com as ações da obra), "WhatsApp" e "Baixar PDF" (pdf-service atual).
- "Prontos para enviar" na casca de Obras gerais para Coordenador/Administrador (disparos da obra; marcar enviado).
- Configuração do boletim por obra (Administrador): item **"Boletim automático"** no perfil em Obras gerais → escolhe a obra → mesma aparência de `ConfigBoletimScreen`.
- Deep link `/?ir=geral-boletim&obra=<id>`. Verificar e commit `adiciona o boletim da obra geral`.

---

### Task 9: Web: Ações da equipe completas e documentação

- `resumoObrasGerais`/`AcoesObraGeral`/`BlocoAcoesGeral`/Hoje: incluir tarefas, pendências (prazo pela config da obra) e providências pendentes sem tarefa, sem duplicar a atividade com tarefa vinculada; card de tarefa abre a `TarefaSheet` (concluir/avanço; editar só quem planeja); card de pendência abre a pendência; Hoje mostra também as ações vencidas/de hoje dessas origens.
- PRD, SPEC, PLAN (seção "Obras gerais · Etapa 4", decisões 1–9, próximas etapas), CLAUDE.md se alguma regra mudou.
- Commit `completa as ações da equipe e documenta a etapa 4 das obras gerais`.
