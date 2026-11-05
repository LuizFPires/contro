# Obras gerais · Etapa 1: ambientes e acesso por obra · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar o ambiente **Obras gerais** isolado da Contorno: ambiente na obra, Administradores, Coordenador/Membro por obra, permissão por obra no banco (RLS, RPCs, Storage, avisos), troca de ambiente no perfil, lista e criação de obras gerais e a tela **Pessoas e acessos** de Obras gerais. A Contorno continua idêntica para quem a usa.

**Architecture:** O banco ganha `obra.ambiente`, `obra.cidade`, `pessoa.administrador`, `pessoa.acesso_contorno`, `pessoa.papel_geral`, as tabelas `obra_participante` e `convite_geral` e a função `contro_ve_obra(obra_id)`, que passa a guardar toda leitura (RLS) e toda escrita (trigger de guarda) em tabelas que pendem de obra. Para obra da Contorno, `contro_ve_obra` = `contro_e_membro()` de hoje, então nada muda para a Contorno. O core ganha `ambiente.ts` (quais ambientes a pessoa tem e qual abre). O web ganha o estado de ambiente, a troca no perfil e a pasta `features/obras-gerais`.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Supabase (Postgres, RLS, pgTAP), Vitest, CSS Modules, tokens em `packages/ui`.

**Spec:** `docs/superpowers/specs/2026-11-05-obras-gerais-design.md` (mapa de telas: `docs/superpowers/specs/2026-11-05-obras-gerais-mapa.html`)

## Roteiro das etapas

Esta é a etapa 1 de 5. Cada etapa tem plano próprio, escrito depois que a anterior entra na `main`:

1. **Ambientes e acesso por obra** (este plano).
2. Obra geral por dentro: fases, atividades com data prevista, subitens (criar, editar), ficha, calendário, avanço, conclusão por qualquer pessoa da obra, Log de quem concluiu, regras Coordenador × Membro nas RPCs, Pessoas da obra do Coordenador, menu Hoje · Obra · Score · Log com o seletor de obra.
3. Hoje, Ações da equipe, avisos (push) e eficiência ("% no prazo") em Obras gerais.
4. Reunião, ata, pendências e boletim por obra; Reunião e avisos por obra (Coordenador configura).
5. Score e Log por participação; sugestões de autocompletar separadas por ambiente.

## Global Constraints

- **A Contorno não muda.** Para quem tem só Contorno, telas, menus, permissões e resultados de consultas ficam iguais. Únicas mudanças visíveis: o item do perfil "Aprovar membros" passa a se chamar **"Pessoas e acessos"** (mesma tela e função) e, para quem tem os dois ambientes, a troca de ambiente no perfil e o nome do ambiente ao lado da marca.
- Ambientes: `'contorno' | 'geral'`. Rótulos na UI: **"Contorno"** e **"Obras gerais"**.
- Papel em Obras gerais: `'coordenador' | 'membro'`, um por pessoa, valendo em todas as obras gerais dela. Rótulos: **"Coordenador"**, **"Membro"**.
- Administradores: Luiz Felipe, Rafael, Rodrigo (Gestores hoje). Marcados por migration de dados, sem UI.
- Só Administrador cria obra geral e só Administrador define papel e obras de alguém (nesta etapa; Coordenador adicionando Membro vem na etapa 2).
- Ninguém pede para entrar em Obras gerais: sem "aguardando", sem aprovação. E-mail liberado entra direto ao se cadastrar.
- Nova pessoa: só **Nome**, **E-mail**, **Papel**, **Obras**. Sem função e sem WhatsApp. Botão **"Dar acesso"**.
- Nova obra geral: gaveta com **Nome da obra** e **Cidade**. Botão **"Criar obra"**.
- Troca de ambiente: topo do perfil, controle segmentado **Contorno | Obras gerais**; o app abre no último ambiente usado; no primeiro acesso, **Contorno** quando a pessoa tem os dois.
- Regra 1 do CLAUDE.md: regra de domínio só em `packages/core`, com teste. Migration sempre com RLS e teste pgTAP no mesmo PR. Exclusão lógica. pt-BR, sem emoji, toque ≥ 44 px, cores CONTRO.
- Commits pt-BR no imperativo. Branch `obras-gerais` (já criada a partir de `main`).
- CLI do Supabase: `npx -y supabase@2 ...` (a v3 rejeita o `config.toml`).

## Review Focus

1. **Membro da Contorno chamando RPC com id de atividade de obra geral** (ex.: `concluir_atividade`): deve falhar com 42501, não gravar. Teste na Task 3.
2. **Administrador na Contorno não vê obra geral** em Minhas obras, Hoje, Tarefas, Score e Log (e vice-versa em Obras gerais). Teste na Task 1 (`obrasDoAmbiente`) e verificação manual na Task 6.
3. **E-mail do convite com maiúsculas ou espaços** ("  Carlos@Email.com ") casa com o cadastro "carlos@email.com". Teste na Task 5.
4. **Pessoa de Obras gerais tirada de todas as obras** continua entrando em Obras gerais (lista vazia), não cai em "Aguardando aprovação" nem vê a Contorno. Teste na Task 1 e na Task 5.
5. **Foto com pasta que não é uuid** no Storage: a política responde "não" sem erro de conversão. Teste na Task 3.

---

### Task 1: Core: ambientes da pessoa

**Files:**
- Create: `packages/core/src/ambiente.ts`
- Create: `packages/core/src/ambiente.test.ts`
- Modify: `packages/core/src/index.ts` (exportar)

**Interfaces:**
- Produces:
  - `type Ambiente = 'contorno' | 'geral'`
  - `type PapelGeral = 'coordenador' | 'membro'`
  - `interface AcessoPessoa { administrador: boolean; acessoContorno: boolean; papelGeral: PapelGeral | null }`
  - `ambientesDaPessoa(p: AcessoPessoa): Ambiente[]` — `'contorno'` se `acessoContorno`; `'geral'` se `administrador` ou `papelGeral !== null`; ordem fixa `['contorno', 'geral']`.
  - `ambienteInicial(disponiveis: Ambiente[], ultimo: Ambiente | null): Ambiente` — `ultimo` se estiver em `disponiveis`; senão `'contorno'` se disponível; senão `'geral'`.
  - `rotuloAmbiente(a: Ambiente): string` — `'Contorno'` | `'Obras gerais'`.
  - `rotuloPapelGeral(p: PapelGeral): string` — `'Coordenador'` | `'Membro'`.
  - `podeGerirObrasGerais(p: AcessoPessoa): boolean` — só `administrador` (criar obra geral e Pessoas e acessos de Obras gerais).
  - `obrasDoAmbiente<T extends { ambiente: Ambiente }>(obras: T[], a: Ambiente): T[]`.

- [ ] **Step 1: Escrever os testes** em `ambiente.test.ts`:
  - `ambientesDaPessoa` → Gestor de hoje (`{administrador:false, acessoContorno:true, papelGeral:null}`) = `['contorno']`; Administrador = `['contorno','geral']`; só Obras gerais (`{false,false,'membro'}`) = `['geral']`; equipe Contorno que virou Membro (`{false,true,'membro'}`) = `['contorno','geral']`; pessoa geral sem nenhuma obra continua `['geral']` (o papel define, não as obras).
  - `ambienteInicial(['contorno','geral'], null)` = `'contorno'`; `(['contorno','geral'], 'geral')` = `'geral'`; `(['geral'], 'contorno')` = `'geral'`; `(['contorno'], 'geral')` = `'contorno'`.
  - `obrasDoAmbiente` com 3 obras (2 contorno, 1 geral) devolve só as do ambiente pedido, na mesma ordem.
  - `podeGerirObrasGerais` verdadeiro só com `administrador: true`.
- [ ] **Step 2: Rodar e ver falhar:** `pnpm vitest run packages/core/src/ambiente.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3: Implementar** as funções acima em `ambiente.ts` e exportar em `index.ts`.
- [ ] **Step 4: Rodar e ver passar:** mesmo comando → PASS; `pnpm typecheck` → sem erros.
- [ ] **Step 5: Commit:** `git commit -m "adiciona ambientes da pessoa no core"`

---

### Task 2: Banco: ambiente, papéis, participação e funções de acesso

**Files:**
- Create: `supabase/migrations/20261105200000_obras_gerais_acesso.sql`
- Create: `supabase/tests/obras_gerais_acesso.test.sql`

**Interfaces:**
- Produces (SQL, todas `stable security definer set search_path = ''`, `grant execute ... to authenticated`):
  - colunas: `obra.ambiente text not null default 'contorno' check (ambiente in ('contorno','geral'))`, `obra.cidade text`; `pessoa.administrador boolean not null default false`, `pessoa.acesso_contorno boolean not null default true`, `pessoa.papel_geral text null check (papel_geral in ('coordenador','membro'))`.
  - tabela `obra_participante (obra_id uuid references obra(id), pessoa_id uuid references pessoa(id), created_at timestamptz default now(), created_by uuid references auth.users(id), primary key (obra_id, pessoa_id))` com índice em `pessoa_id`.
  - tabela `convite_geral (email text primary key check (email = lower(btrim(email))), nome text not null, papel text not null check (papel in ('coordenador','membro')), obra_ids uuid[] not null default '{}', created_at timestamptz default now(), created_by uuid references auth.users(id), usado_em timestamptz)`.
  - `contro_e_membro()` **redefinida** = definição atual `and acesso_contorno` (todas as pessoas de hoje têm `true`, resultado igual).
  - `contro_e_admin() returns boolean` — pessoa atual `ativo`, não excluída, `administrador`.
  - `contro_ve_obra(p_obra_id uuid) returns boolean` — obra não excluída e: `ambiente = 'contorno' and contro_e_membro()`, ou `ambiente = 'geral' and (contro_e_admin() or exists obra_participante da pessoa atual ativa)`.
  - `contro_coordena_obra(p_obra_id uuid) returns boolean` — obra geral e (`contro_e_admin()` ou participante com `papel_geral = 'coordenador'`).
  - `contro_tem_acesso() returns boolean` — `contro_e_membro() or contro_e_admin() or` pessoa atual ativa com `papel_geral` não nulo.
  - RLS: `obra_participante` select = `contro_ve_obra(obra_id)`; sem insert/update/delete direto (só RPC, Task 5). `convite_geral` select = `contro_e_admin()`; sem escrita direta.
  - Dados: `update pessoa set administrador = true where perfil = 'gestor' and deleted_at is null and split_part(lower(btrim(nome)), ' ', 1) in ('luiz','rafael','rodrigo');`

- [ ] **Step 1: Escrever o pgTAP** `obras_gerais_acesso.test.sql` no padrão de `rls_obra.test.sql` (usuários fixos em `auth.users`, `pessoa ... on conflict (user_id) do update set ... ativo = true`): pessoas **M** (equipe Contorno), **A** (gestor + `administrador`), **C** (`acesso_contorno=false`, `papel_geral='coordenador'`, participante de G1), **J** (`acesso_contorno=false`, `papel_geral='membro'`, sem obra), **X** (sem pessoa); obras **K** (contorno), **G1**, **G2** (geral). Asserções:
  - como M: `contro_ve_obra(K)` true, `(G1)` false, `contro_e_membro()` true;
  - como A: `contro_ve_obra` true para K, G1, G2; `contro_e_admin()` true;
  - como C: `(G1)` true, `(G2)` false, `(K)` false, `contro_e_membro()` false, `contro_tem_acesso()` true, `contro_coordena_obra(G1)` true;
  - como J: `contro_tem_acesso()` true, `contro_ve_obra(G1)` false;
  - como X: tudo false;
  - como C: `select count(*) from obra_participante` = 1; `from convite_geral` = 0; como A, `convite_geral` visível.
- [ ] **Step 2: Rodar e ver falhar:** `npx -y supabase@2 test db` → FAIL no arquivo novo (colunas/funções não existem).
- [ ] **Step 3: Escrever a migration** com o que está em Interfaces. `contro_e_membro()` copiada de `20261024090000_init.sql:71` com o `and acesso_contorno` a mais.
- [ ] **Step 4: Rodar a suíte inteira:** `npx -y supabase@2 db reset` e `npx -y supabase@2 test db` → todos PASS (os testes antigos provam que a Contorno não mudou).
- [ ] **Step 5: Commit:** `git commit -m "adiciona ambiente da obra, papéis de obras gerais e funções de acesso"`

---

### Task 3: Banco: permissão por obra em tabelas, Storage e escrita por RPC

**Files:**
- Create: `supabase/migrations/20261105210000_obras_gerais_rls.sql`
- Create: `supabase/tests/obras_gerais_rls.test.sql`

**Interfaces:**
- Consumes: `contro_ve_obra`, `contro_e_admin`, `contro_tem_acesso` (Task 2).
- Produces:
  - Leitura: toda política de **select** que hoje é `contro_e_membro()` numa tabela que pende de obra passa a ser `contro_ve_obra(<obra>)`, mantendo os outros predicados de cada política (ex.: `deleted_at is null`, `criado_por = auth.uid()`). Tabelas com `obra_id`: `obra_fase`, `foto`, `obra_atividade`, `obra_dependencia`, `obra_providencia`, `obra_mapa_libera`, `mapa_proposta`, `pendencia`, `tarefa`, `reuniao_obra`, `reuniao_resposta`, `boletim_disparo`; `obra` usa `contro_ve_obra(id)`; `obra_atividade_evento`, `pendencia_evento`, `tarefa_evento` usam o `obra_id` do item pai (`exists` no pai). Políticas de insert/update/delete diretas nessas tabelas: mesmo troca. `obra_ins` passa a `contro_e_membro() and ambiente = 'contorno'` (obra geral só nasce por RPC, Task 5). Listar as políticas atuais com `select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public'` antes de escrever, e recriar cada uma.
  - `pessoa`: nova política de select `pessoa_geral_sel` — `deleted_at is null and (contro_e_admin() or exists (participação em comum: obra_participante da pessoa linha e da pessoa atual na mesma obra))`.
  - Storage `fotos`: `fotos_sel`/`fotos_ins` = `bucket_id = 'fotos' and exists (select 1 from public.obra o where o.id::text = (storage.foldername(name))[1] and public.contro_ve_obra(o.id))` (compara texto, nunca faz cast de pasta para uuid).
  - Trigger de guarda `contro_guarda_obra()` (`security definer`), `before insert or update` em todas as tabelas com `obra_id` acima (e em `obra`, usando `new.id`): se `auth.uid() is not null and not public.contro_ve_obra(new.obra_id)` → `raise exception 'sem acesso a esta obra' using errcode = '42501'`. Cron e triggers internos (`auth.uid()` nulo) passam. Assim as RPCs `security definer` existentes ficam obra-a-obra sem reescrever cada uma.

- [ ] **Step 1: Escrever o pgTAP** `obras_gerais_rls.test.sql` com o mesmo elenco da Task 2, mais uma fase e uma atividade em K e em G1, uma tarefa em G1 e uma foto em G1:
  - M: `select count(*) from obra_fase where obra_id = G1` = 0; vê a fase de K;
  - C: vê a fase e a atividade de G1; 0 linhas de K em `obra`, `obra_fase`, `obra_atividade`, `tarefa`;
  - A: vê K e G1;
  - M: `throws_ok($$ select public.concluir_atividade(<atividade de G1>, ...) $$, '42501')` (usar a assinatura atual de `concluir_atividade`); `throws_ok` em `insert into obra_fase (obra_id, ...) values (G1, ...)`;
  - M: `insert into obra (... ambiente) values (... 'geral')` falha por RLS;
  - Storage: como M, `select count(*) from storage.objects where bucket_id='fotos' and name like G1||'/%'` = 0; como C = 1; uma linha com pasta `'nao-e-uuid/x.jpg'` não gera erro (a consulta como C devolve sem exceção);
  - C vê a própria pessoa e a de outro participante de G1, não vê M.
- [ ] **Step 2: Rodar e ver falhar:** `npx -y supabase@2 test db` → FAIL no arquivo novo.
- [ ] **Step 3: Escrever a migration** conforme Interfaces.
- [ ] **Step 4: Suíte inteira:** `npx -y supabase@2 db reset && npx -y supabase@2 test db` → todos PASS.
- [ ] **Step 5: Commit:** `git commit -m "restringe leitura e escrita de cada obra a quem participa dela"`

---

### Task 4: Banco: rotinas globais só olham a Contorno

**Files:**
- Create: `supabase/migrations/20261105220000_obras_gerais_rotinas.sql`
- Create: `supabase/tests/obras_gerais_rotinas.test.sql`

**Interfaces:**
- Consumes: `obra.ambiente`, `pessoa.acesso_contorno` (Task 2).
- Produces: redefinição (`create or replace`, copiando o corpo da versão mais recente) de:
  - `gerar_avisos()` (última em `20261104700000_pre_obra_como_acao.sql`): toda leitura de `obra` filtra `ambiente = 'contorno'`; destinatários só pessoas com `acesso_contorno`.
  - `abrir_reuniao(...)` (última em `20261028200000_reuniao_avisos.sql`): `reuniao_obra` só para obras `ambiente = 'contorno'`.
  - `gerar_disparos_boletim()` (última em `20261025010000_boletim_disparo.sql` ou posterior; conferir com `grep -l "function gerar_disparos_boletim" supabase/migrations`): só obras `ambiente = 'contorno'`.
  - Avisos e boletim de obras gerais ficam para as etapas 3 e 4.

- [ ] **Step 1: Escrever o pgTAP** com uma obra geral G1 que tem tarefa atrasada e uma pessoa só de Obras gerais com `user_id` e `push_subscription`:
  - depois de `select gerar_avisos()`, nenhum `aviso_disparo` para a pessoa só de Obras gerais;
  - o total do aviso `acoes_equipe` do gestor é o mesmo com e sem a tarefa de G1 (comparar com uma execução sem G1, ou contar a tarefa de G1 ausente no texto);
  - `abrir_reuniao` não cria `reuniao_obra` para G1;
  - `gerar_disparos_boletim` não cria `boletim_disparo` para G1.
- [ ] **Step 2: Rodar e ver falhar:** `npx -y supabase@2 test db` → FAIL.
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: Suíte inteira:** reset + test db → todos PASS (inclui `acoes_avisos`, `reuniao_avisos`, `gerar_disparos_boletim`).
- [ ] **Step 5: Commit:** `git commit -m "mantém avisos, reunião e boletim da Contorno fora das obras gerais"`

---

### Task 5: Banco: criar obra geral, dar acesso e convite pelo e-mail

**Files:**
- Create: `supabase/migrations/20261105230000_obras_gerais_rpcs.sql`
- Create: `supabase/tests/obras_gerais_rpcs.test.sql`

**Interfaces:**
- Consumes: Task 2.
- Produces (todas `security definer`, `set search_path = ''`, só `contro_e_admin()`, senão 42501; `grant execute to authenticated`):
  - `criar_obra_geral(p_nome text, p_cidade text, p_id uuid default gen_random_uuid()) returns uuid` — nome `btrim`, 1–80 caracteres; cidade `btrim`, 0–60 (vazio vira null); insere `obra` com `ambiente='geral'`, `inicio=current_date`, `modelo_rotulo=''`, `status='ativa'`; idempotente por `p_id` (já existe → devolve o id).
  - `salvar_acesso_geral(p_email text, p_nome text, p_papel text, p_obra_ids uuid[]) returns uuid` — normaliza e-mail (`lower(btrim)`), valida papel e que todo id é obra `geral` não excluída. Se existe `auth.users` com esse e-mail e pessoa: grava `papel_geral`, `nome` (só se a pessoa ainda não tinha papel geral), `ativo = true`; se a pessoa estava pendente na Contorno (`ativo=false`, `desativado_em is null`), passa `acesso_contorno=false`; troca as linhas de `obra_participante` pela lista; devolve `pessoa.id`. Se não existe: `insert ... on conflict (email) do update` em `convite_geral`; devolve null.
  - `definir_acesso_geral(p_pessoa_id uuid, p_papel text, p_obra_ids uuid[]) returns void` — mesma validação; grava papel e substitui as participações (lista vazia = sem obra, a pessoa continua em Obras gerais).
  - `listar_pessoas_gerais() returns table (id uuid, nome text, email text, papel text, obra_ids uuid[])` — pessoas ativas com `papel_geral` não nulo, e-mail de `auth.users`, obras de `obra_participante` (só obras gerais não excluídas), ordenado por nome.
  - `handle_new_user()` redefinida (copiar de `20261025050000_auth_cadastro.sql:5-27`): se existe `convite_geral` com `lower(btrim(new.email))` e `usado_em is null`, a pessoa nasce `ativo=true`, `acesso_contorno=false`, `papel_geral=convite.papel`, `nome=convite.nome`, ganha as participações das obras do convite que ainda são gerais e não excluídas, e o convite recebe `usado_em = now()`. Sem convite: igual a hoje.

- [ ] **Step 1: Escrever o pgTAP:**
  - como M (não admin): `criar_obra_geral` e `salvar_acesso_geral` → `throws_ok ... '42501'`;
  - como A: `criar_obra_geral('Galpão SMS', 'Betim')` devolve id; a obra tem `ambiente='geral'`, `cidade='Betim'`; chamar de novo com o mesmo `p_id` não duplica;
  - `criar_obra_geral('  ', 'x')` → erro de validação;
  - `salvar_acesso_geral('  Carlos@Email.COM ', 'Carlos', 'coordenador', array[G1])` sem usuário → devolve null e cria `convite_geral` com `email='carlos@email.com'`;
  - inserir `auth.users (email='carlos@email.com')` → a pessoa nasce `ativo=true`, `acesso_contorno=false`, `papel_geral='coordenador'`, participante de G1; convite com `usado_em` preenchido;
  - `salvar_acesso_geral` com id de obra **contorno** → erro;
  - `definir_acesso_geral(C, 'membro', '{}')` → sem participações, `papel_geral='membro'`; como C, `contro_tem_acesso()` true e `contro_ve_obra(G1)` false;
  - cadastro sem convite continua nascendo `ativo=false` (igual a hoje);
  - como M, `listar_pessoas_gerais()` → 42501; como A, devolve Carlos com `email='carlos@email.com'`, `papel='coordenador'`, `obra_ids = {G1}`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: Suíte inteira:** reset + test db → todos PASS (inclui `auth_cadastro.test.sql`).
- [ ] **Step 5: Commit:** `git commit -m "adiciona criar obra geral e acesso por e-mail às obras gerais"`

---

### Task 6: Web: ambiente atual, troca no perfil e Contorno filtrada

**Files:**
- Modify: `apps/web/src/features/perfil/usePerfil.ts` (campos novos)
- Create: `apps/web/src/features/perfil/useAmbiente.ts`
- Create: `apps/web/src/features/perfil/PerfilSheet.tsx` (+ `.module.css`), extraído do `BottomSheet` de `apps/web/src/screens/MinhasObras.tsx:281-352`
- Modify: `apps/web/src/screens/MinhasObras.tsx` (usar `PerfilSheet`; nome do ambiente ao lado da marca)
- Modify: `apps/web/src/App.tsx:143-215` (escolher o ambiente)
- Modify: `apps/web/src/features/obras/api.ts:185-230` (`listarObras`), `apps/web/src/features/log/dadosLogScore.ts:119-127`
- Modify: `apps/web/src/features/membros/AprovarMembros.tsx:24` (título "Pessoas e acessos")

**Interfaces:**
- Consumes: Task 1 (`ambientesDaPessoa`, `ambienteInicial`, `rotuloAmbiente`, `obrasDoAmbiente`), colunas da Task 2.
- Produces:
  - `PessoaAtual` ganha `administrador: boolean; acessoContorno: boolean; papelGeral: PapelGeral | null` (select `administrador, acesso_contorno, papel_geral`, mapeados para camelCase).
  - `useAmbiente(pessoa: PessoaAtual): { ambiente: Ambiente; disponiveis: Ambiente[]; trocar: (a: Ambiente) => void }` — guarda o último em `useLembrado('app:ambiente', null)`; trocar também volta a tela para `'inicio'` e invalida `['obras']`.
  - `PerfilSheet` props: `{ aberto: boolean; onFechar: () => void; pessoa: PessoaAtual; ambiente: Ambiente; disponiveis: Ambiente[]; onTrocarAmbiente: (a: Ambiente) => void; itensDoAmbiente: ReactNode; onSair: () => void }`. Blocos na ordem: cabeçalho (nome e papel) → **Ambiente** (segmentado, só com 2 disponíveis) → `itensDoAmbiente` → **Sua conta** (Editar meu nome, Avisos neste celular, Trocar senha, Atualizar o app · versão, Sair — os mesmos de hoje).
  - Na Contorno, `itensDoAmbiente` = os três de hoje para o gestor (Reunião e avisos, Boletim automático e **"Pessoas e acessos"** no lugar de "Aprovar membros", com o mesmo selo "N aguardando").
  - `listarObras(ambiente: Ambiente)` filtra `obra.ambiente` e restringe as tabelas filhas aos ids dessas obras (`.in('obra_id', ids)`); `useObras` passa o ambiente atual e usa a chave `['obras', ambiente]`. `loadDadosLogScore` filtra `ambiente = 'contorno'` nesta etapa.
  - `App.tsx`: depois do teste de `ativo`, se `ambiente === 'geral'` renderiza `ObrasGeraisInicio` (Task 7); senão, o fluxo atual. Telas da Contorno só renderizam se `disponiveis` inclui `'contorno'`.

- [ ] **Step 1: Ajustar `usePerfil` e criar `useAmbiente`.**
- [ ] **Step 2: Extrair `PerfilSheet`** sem mudar a aparência dos itens de hoje; trocar o rótulo "Aprovar membros" por "Pessoas e acessos" (menu e título da tela).
- [ ] **Step 3: Filtrar `listarObras` e `loadDadosLogScore` por ambiente** usando `obrasDoAmbiente` onde a lista é montada.
- [ ] **Step 4: Rotear em `App.tsx`** e mostrar o nome do ambiente ao lado da marca (texto 12 px, peso 800, cor preta 55%) só quando `disponiveis.length > 1`.
- [ ] **Step 5: Verificar:** `pnpm lint && pnpm typecheck && pnpm test` → sem erros. `pnpm dev` com `pnpm db:reset`: entrar como gestor de seed → a tela é igual à de antes, exceto o rótulo "Pessoas e acessos"; marcar esse gestor como `administrador` no banco local → aparecem a troca de ambiente e o nome do ambiente; em Contorno, nenhuma obra geral aparece em Minhas obras, Hoje, Tarefas, Score e Log.
- [ ] **Step 6: Commit:** `git commit -m "adiciona a troca de ambiente no perfil e separa a Contorno das obras gerais no app"`

---

### Task 7: Web: início de Obras gerais e nova obra

**Files:**
- Create: `apps/web/src/features/obras-gerais/ObrasGeraisInicio.tsx` (+ `.module.css`)
- Create: `apps/web/src/features/obras-gerais/NovaObraGeralSheet.tsx`
- Create: `apps/web/src/features/obras-gerais/api.ts`
- Create: `apps/web/src/features/obras-gerais/useObrasGerais.ts`

**Interfaces:**
- Consumes: `PerfilSheet`, `useAmbiente` (Task 6); RPC `criar_obra_geral` (Task 5); `podeGerirObrasGerais`, `rotuloPapelGeral` (Task 1).
- Produces:
  - `listarObrasGerais(): Promise<ObraGeral[]>` com `ObraGeral { id: string; nome: string; cidade: string | null; pessoas: number }` (obras `ambiente='geral'`, `status='ativa'`, não excluídas, ordenadas por nome; `pessoas` = contagem em `obra_participante`). Hook `useObrasGerais()` com chave `['obras-gerais']`.
  - `criarObraGeral(nome: string, cidade: string, id: string): Promise<string>`.
  - `ObrasGeraisInicio` props `{ pessoa: PessoaAtual; ambiente: Ambiente; disponiveis: Ambiente[]; onTrocarAmbiente: (a: Ambiente) => void; onSair: () => void; onPessoas: () => void }`.
- Tela (mapa: A13 sem os blocos de reunião e ações, que vêm na etapa 4): cabeçalho com marca + "Obras gerais" (quando houver troca) e o botão de perfil; título **"Minhas obras"** com **"+"** só para Administrador; um card por obra com nome, cidade e "N pessoas". Toque no card nesta etapa não abre a obra (a obra por dentro é a etapa 2); o card não tem seta. Vazio: "Nenhuma obra geral ainda." e, para Administrador, "Toque no + para criar a primeira."
- `NovaObraGeralSheet`: gaveta de baixo para cima com **Nome da obra** e **Cidade** e o botão **"Criar obra"** (desabilitado com nome vazio). Ao criar: fecha, a lista atualiza, toast "Obra criada." com **Desfazer** (5 s) que chama `excluir_obra` (já existe, só gestor, e Administrador é gestor).
- Perfil em Obras gerais: `itensDoAmbiente` = **"Pessoas e acessos"** (só Administrador; chama `onPessoas`).

- [ ] **Step 1: Implementar `api.ts` e `useObrasGerais`.**
- [ ] **Step 2: Implementar `ObrasGeraisInicio` e `NovaObraGeralSheet`** com os textos acima.
- [ ] **Step 3: Verificar:** `pnpm lint && pnpm typecheck && pnpm test`; `pnpm dev`: como Administrador, trocar para Obras gerais, criar "Galpão SMS" / "Betim", ver o card, Desfazer apaga; como pessoa só de Obras gerais (criada pela Task 8 ou via `salvar_acesso_geral` local), a tela abre direto em Obras gerais, sem troca de ambiente e sem "+".
- [ ] **Step 4: Commit:** `git commit -m "adiciona o início de Obras gerais e a criação de obra geral"`

---

### Task 8: Web: Pessoas e acessos de Obras gerais

**Files:**
- Create: `apps/web/src/features/obras-gerais/PessoasAcessos.tsx` (+ `.module.css`)
- Create: `apps/web/src/features/obras-gerais/FichaPessoaGeral.tsx`
- Create: `apps/web/src/features/obras-gerais/NovaPessoaGeral.tsx`
- Create: `apps/web/src/features/obras-gerais/usePessoasGerais.ts`
- Modify: `apps/web/src/App.tsx` (tela `'pessoas-gerais'`, só Administrador)

**Interfaces:**
- Consumes: RPCs `salvar_acesso_geral`, `definir_acesso_geral`, `listar_pessoas_gerais` (Task 5); `useObrasGerais` (Task 7); `rotuloPapelGeral` (Task 1).
- Produces:
  - `usePessoasGerais(): { pessoas: PessoaGeral[]; convites: ConviteGeral[] }` com `PessoaGeral { id: string; nome: string; email: string; papel: PapelGeral; obraIds: string[] }` (de `listar_pessoas_gerais`) e `ConviteGeral { email: string; nome: string; papel: PapelGeral; obraIds: string[] }` (de `convite_geral` com `usado_em is null`). Chave `['pessoas-gerais']`, invalidada depois de cada RPC.
- Telas (mapa A7, A8, A9):
  - **Lista:** título "Pessoas e acessos", subtítulo "Obras gerais", botão "+"; uma linha por pessoa: nome, "Coordenador · e-mail" ou "Membro · e-mail", chips com as obras ou "sem obra"; convites pendentes aparecem com "ainda não entrou".
  - **Ficha:** nome e e-mail no topo; **Papel** segmentado Coordenador | Membro; **Obras** com uma chave por obra geral; salva ao tocar, com toast **Desfazer** (5 s) que regrava o estado anterior.
  - **Nova pessoa:** **Nome**, **E-mail**, nota "O nome é o que aparece no app.", **Papel** (padrão Membro), **Em quais obras** (chaves), botão **"Dar acesso"**, nota "Se ainda não tem conta, ao se cadastrar com esse e-mail já entra nas obras marcadas." Validação: nome e e-mail obrigatórios, e-mail com "@".

- [ ] **Step 1: Implementar `usePessoasGerais`.**
- [ ] **Step 2: Implementar as três telas.**
- [ ] **Step 3: Verificar:** `pnpm lint && pnpm typecheck && pnpm test && npx -y supabase@2 test db`; `pnpm dev`: como Administrador, dar acesso a um e-mail novo como Coordenador em "Galpão SMS"; cadastrar com esse e-mail em outra janela → entra direto em Obras gerais, vê só "Galpão SMS", sem troca de ambiente; na ficha, desligar a obra → ele vê a lista vazia; trocar papel para Membro → reflete na lista.
- [ ] **Step 4: Commit:** `git commit -m "adiciona Pessoas e acessos de Obras gerais"`

---

### Task 9: Documentos

**Files:**
- Modify: `PRD.md`, `SPEC.md` (§3.1 cadastro, §3.3 obra, §7 permissões, §10.1 rotas), `PLAN.md` (nova seção "Obras gerais · Etapa 1 (05/11/2026)" com checklist desta etapa e entradas em "Decisões"), `CLAUDE.md` (regra 11: perfis passam a incluir Administrador e, em Obras gerais, Coordenador e Membro; "Aprovar membros" → "Pessoas e acessos")

- [ ] **Step 1: Atualizar os quatro arquivos** com o que esta etapa entregou e as decisões do spec que ela implementa (ambientes, papéis, isolamento por RLS, convite por e-mail, rótulo "Pessoas e acessos").
- [ ] **Step 2: Commit:** `git commit -m "documenta ambientes e acesso das obras gerais"`

---

### Entrega

- [ ] Revisão final do branch inteiro (subagente revisor), corrigir o que vier.
- [ ] `git push -u origin obras-gerais`.
- [ ] `npx -y supabase@2 db push --linked` como comando próprio; ler a saída; repetir em erro de transporte. Conferir com `npx -y supabase@2 migration list --linked` que as quatro migrations novas estão aplicadas.
- [ ] Conferir em produção quem ficou `administrador`: `select nome from pessoa where administrador` deve listar Luiz Felipe, Rafael e Rodrigo. Se a lista não for exatamente essa, parar e perguntar ao usuário antes do merge.
- [ ] Abrir o PR e fazer o merge com `gh pr merge --merge --delete-branch`.
