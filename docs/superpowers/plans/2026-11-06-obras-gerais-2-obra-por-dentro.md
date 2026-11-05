# Obras gerais · Etapa 2: a obra geral por dentro · Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Abrir a obra geral e conduzi-la: trilha de fases, nova fase, atividades com responsável e **data prevista digitada**, subitens (criar, editar, marcar), ficha com o rodapé 25 · 50 · 75 · Pronta · Foto, replanejamento rastreado, conclusão por qualquer pessoa da obra (o evento guarda de quem era), regras Coordenador × Membro no banco (RPC **e** RLS) e "Pessoas da obra" para o Coordenador.

**Architecture:**
- **Banco:** `obra_atividade` ganha `data_prevista`, `data_prevista_original`, `replanejamentos` e `responsavel_id`. A nova função `contro_planeja_obra(obra)` vale `contro_ve_obra` na Contorno (nada muda lá) e Coordenador/Administrador na obra geral. A escrita direta (RLS) nas tabelas de planejamento passa a exigir essa função. RPCs novas e só da obra geral fazem o planejamento. As RPCs de campo que já existem (concluir, desfazer, avanço, subitem, foto, providência) passam a aceitar quem participa da obra.
- **Core:** ganha `obraGeral.ts` (prazo, estado, textos da trilha, atalhos de data, quem planeja).
- **Web:** ganha `ObraGeralDetalhe` e `FichaAtividadeGeral` em `features/obras-gerais/`. Elas reaproveitam `AnelAvanco`, `useObraCampo`, a fila offline, `Camera`, `EscolherData`, `BottomSheet` e o rodapé de avanço, que sai de `FichaAtividade` para um componente comum.

**Tech Stack:** React 18 + TypeScript, TanStack Query, Dexie (fila offline), Supabase (Postgres, RLS, pgTAP), Vitest, CSS Modules, `@contro/ui`.

**Spec:** `docs/superpowers/specs/2026-11-05-obras-gerais-design.md`. Mapa de telas: `docs/superpowers/specs/2026-11-05-obras-gerais-mapa.html`, telas C1–C4, C6–C12, J2–J4.

## Roteiro das etapas

1. Ambientes e acesso por obra: feita (PR #126).
2. **A obra geral por dentro** (este plano).
3. Hoje, menu de baixo Hoje · Obra · Score · Log com o seletor de obra no topo, Ações da equipe, avisos (push, inclusive "mudou a data" e "tirado da obra") e eficiência "% no prazo".
4. Reunião, ata, pendências (Check list) e boletim por obra; tela "Reunião e avisos" por obra.
5. Score e Log por participação (mostrar "concluiu · responsável: X", que esta etapa já grava); sugestões de autocompletar separadas por ambiente.

**Movido da etapa 2 para a 3:** o menu de baixo das Obras gerais. Hoje, Score e Log de Obras gerais ainda não existem, e um menu com três itens vazios seria pior que nenhum. Nesta etapa a pessoa entra pela lista "Minhas obras" (que já existe) e toca na obra. O seletor de obra (C2) entra já, no nome da obra no topo.

## Global Constraints

- **A Contorno não muda.** Para obra da Contorno, o resultado de toda política, RPC e tela fica igual. A extração do rodapé de avanço é uma refatoração: a ficha da Contorno continua pixel a pixel igual.
- **Papéis:**
  - "Planeja" (cria fase, cria e exclui atividade e subitem, muda data, nome, responsável e prestador) = Administrador ou Coordenador **participante da obra**.
  - Membro conclui, avança, marca subitem, anexa foto e marca providência, de qualquer atividade da obra.
  - Na Contorno, "planeja" = membro da Contorno, como hoje.
- **Erros das RPCs:**
  - `42501` sem acesso ou sem papel;
  - `22023` dado inválido (nome vazio, data nula onde é obrigatória);
  - `23503` item ou fase inexistente ou de outra obra;
  - `23505` obra que não é do tipo esperado (RPC de obra geral com obra Contorno), como na etapa 1.
- **Data:**
  - formato curto "qua 04/11": dia da semana em 3 letras minúsculas (`dom seg ter qua qui sex sáb`), espaço, `dd/mm`;
  - atalhos com inicial maiúscula ("Seg 09/11");
  - atraso pela regra existente `atrasoDU` (mínimo 1 dia útil depois do prazo);
  - o calendário deixa escolher qualquer dia, inclusive fim de semana.
- **Atividade com subitens:** a data da atividade é a do **último subitem com data**. Sem nenhum subitem com data, vale a `data_prevista` da própria atividade. Um nível só.
- **Replanejamento:**
  - mudar a data de atividade ou subitem **aberto** que **já tinha data** preserva `data_prevista_original` (só na primeira vez) e soma 1 em `replanejamentos`;
  - grava o evento `replanejada` com `antes: {data}` e `depois: {data, motivo?}`;
  - dar a primeira data grava o evento `data_definida`, sem contar replanejamento.
- **Conclusão:** o evento `concluida` passa a gravar também `responsavel_id` (o dono da atividade naquele momento), nos dois ambientes. É o "de quem era" do Log.
- **Responsável:** uma pessoa que participa da obra ou um Administrador. Sem nome livre nesta etapa: empresa ou prestador continua no campo "Empresa ou prestador".
- **Prestador em obra geral:**
  - não consulta nem alimenta `sugestao`;
  - o nome é só aparado e com espaços únicos;
  - a separação das sugestões por ambiente fica para a etapa 5.
- **Textos da UI** (pt-BR, exatos):
  - "+ fase", "Nova fase", "Nome da fase", "Criar fase";
  - "+ Adicionar atividade", "Nova atividade · {fase}", "Quem", "Para quando", "Dividir em subitens", "+ subitem", "Data da atividade: a do último subitem", "Adicionar";
  - "Data prevista", "Mudar", "Responsável", "Trocar", "Sem responsável", "Empresa ou prestador", "opcional";
  - "Subitens · {feitos} de {total}", "+ Adicionar subitem", "Editar subitem", "Texto", "Salvar", "Excluir subitem";
  - "A data da atividade acompanha a do último subitem.";
  - "Entrega da obra";
  - "Pessoas da obra", "Na obra", "Adicionar membro", "Adicionar ao {obra}", "Pessoa nova", "nome e e-mail de login", "Adicionar como membro", "Administradores sempre veem";
  - nota do Membro na ficha: "Data e responsável são definidos pelo coordenador. Se não vai dar no prazo, fale com ele para ajustar.".
- **Regras do CLAUDE.md:**
  - regra 1: domínio só em `packages/core`, com teste;
  - migration com RLS e teste pgTAP no mesmo PR;
  - exclusão lógica, eventos, Desfazer de 5 s;
  - ação de campo otimista e offline; planejamento por RPC direta, como "adicionar atividade" na Contorno;
  - toque ≥ 44 px, cores CONTRO (vermelho só atraso, âmbar só vence hoje), sem emoji, ícones SVG lineares.
- **Git e CLI:**
  - commits em pt-BR no imperativo;
  - branch `obras-gerais-2` na pasta `../16 OBDC-obras-gerais-2`, com Supabase local próprio (ver a memória `sessoes-paralelas-worktree`);
  - CLI `npx -y supabase@2`.
- **Migrations:** `20261106100000_obras_gerais_planejamento.sql`, `20261106110000_obras_gerais_campo.sql` e `20261106120000_obras_gerais_pessoas_da_obra.sql`.

## Review Focus

1. **Membro chamando RPC de planejamento**, ou escrevendo direto pela API (`update obra_atividade set data_prevista`, `insert obra_fase`): falha com 42501 e não grava nada. Os testes ficam na Task 2.
2. **Pessoa só da Contorno chamando as RPCs de campo** com id de atividade de obra geral: continua 42501, como na etapa 1. Testes na Task 3.
3. **Datas da atividade com subitens:**
   - subitens sem data, com data parcial, ou todos concluídos: o prazo segue a regra (último subitem com data, senão a da atividade);
   - atividade sem data nenhuma aparece "sem data" e nunca atrasada.
   - Testes na Task 1.
4. **Tirar alguém da obra** (pela tela do Coordenador ou por "Pessoas e acessos" do Administrador): as atividades abertas dessa pessoa nessa obra ficam sem responsável; as concluídas mantêm o dono. Testes na Task 4.
5. **Mudar a data de atividade concluída:** não conta replanejamento (só ajusta a data). **Mudar para a mesma data:** não grava nada. Testes na Task 2.

---

### Task 1: Core: regras da obra geral

**Files:**
- Create: `packages/core/src/obraGeral.ts`
- Create: `packages/core/src/obraGeral.test.ts`
- Modify: `packages/core/src/index.ts` (exportar)

**Interfaces:**
- Consumes:
  - `atrasoDU(prazo, dia)` de `datas.ts`;
  - `addDU`, `DataISO` de `calendar.ts`;
  - `AcessoPessoa` de `ambiente.ts`.
- Produces:
  - `interface AtividadeGeral { id: string; fase_id: string; pai_id: string | null; ordem: number; nome: string; data_prevista: DataISO | null; replanejamentos: number; responsavel_id: string | null; concluida_em: string | null; avanco_pct: number; foto_conclusao_id: string | null; prestador: string | null }`
  - `interface FaseGeralEntrada { id: string; ordem: number; titulo: string }`
  - `type StatusGeral = 'concluida' | 'atrasada' | 'vence_hoje' | 'aberta'`
  - `diaCurto(iso: DataISO): string`: "qua 04/11".
  - `prazoAtividadeGeral(a: AtividadeGeral, subitens: AtividadeGeral[]): DataISO | null`: a maior `data_prevista` entre os subitens não nulos; sem nenhum, `a.data_prevista`.
  - `statusAtividadeGeral(concluidaEm: string | null, prazo: DataISO | null, hoje: DataISO): StatusGeral`:
    - concluída vence tudo;
    - sem prazo → `'aberta'`;
    - `atrasoDU(prazo, hoje) > 0` → `'atrasada'`;
    - `prazo === hoje` → `'vence_hoje'`;
    - senão `'aberta'`.
  - `interface SubitemGeral { id: string; nome: string; feito: boolean; prazo: DataISO | null; prazoTxt: string | null }`
  - `interface AtividadeGeralTrilha { id: string; nome: string; status: StatusGeral; prazo: DataISO | null; responsavelId: string | null; quem: string; sub: string; avancoPct: number; semFoto: boolean; prestador: string | null; subitens: SubitemGeral[] }`
  - `interface FaseGeral { id: string; n: number; titulo: string; total: number; concluidas: number; atrasadas: number; venceHoje: number; concluida: boolean; atividades: AtividadeGeralTrilha[] }`
  - `trilhaObraGeral(e: { fases: FaseGeralEntrada[]; atividades: AtividadeGeral[]; hoje: DataISO; pessoaId: string | null; nomes: Record<string, string> }): FaseGeral[]`
  - `resumoObraGeral(fases: FaseGeral[]): string`
  - `atalhosDataPrevista(hoje: DataISO): { valor: DataISO; rotulo: string }[]`
  - `podePlanejarObraGeral(p: AcessoPessoa): boolean`: `administrador || papelGeral === 'coordenador'`. Só esconde e mostra botões; quem decide de verdade é o banco (`contro_planeja_obra`, que também exige participar da obra).

Regras de `trilhaObraGeral`:
- Fases por `ordem`, com `n` = 1..N. Atividades de topo (`pai_id` nulo) por `ordem`, e os subitens de cada uma também por `ordem`.
- `quem`:
  - `'Você'` quando `responsavel_id === pessoaId`;
  - senão `nomes[responsavel_id]`;
  - sem responsável, ou com nome desconhecido: `'Sem responsável'`.
- `sub` = `` `${quem} · ${detalhe}` ``, sendo o `detalhe`:
  - concluída: `'concluída sem foto'` se `foto_conclusao_id` for nulo, senão `'concluída'`;
  - atrasada: `` `era para ${diaCurto(prazo)}` ``;
  - vence hoje: `'vence hoje'`;
  - aberta com prazo: `diaCurto(prazo)`;
  - aberta sem prazo: `'sem data'`.
- `semFoto` = concluída e sem foto.
- `total` conta só as atividades de topo; `concluida` = `total > 0 && concluidas === total`.
- `subitens[].prazoTxt` = `diaCurto(prazo)` ou `null`.

`resumoObraGeral`:
- sem fases → `'Nenhuma fase ainda'`;
- todas concluídas → `'Todas as fases concluídas'`;
- senão `` `Fase ${n} de ${N}` `` (n = primeira fase não concluída) mais, quando há atrasadas na obra, `' · 1 atividade atrasada'` ou `` ` · ${k} atividades atrasadas` ``.

`atalhosDataPrevista`: `Hoje` (hoje), `Amanhã` (hoje + 1 dia corrido) e os 2 dias úteis seguintes a amanhã, com o rótulo de `diaCurto` em maiúscula inicial (ex.: hoje qui 05/11 → `Hoje`, `Amanhã` 06/11, `Seg 09/11`, `Ter 10/11`).

- [ ] **Step 1: Escrever os testes** em `obraGeral.test.ts`. Os nomes e as asserções são estes (hoje = `'2026-11-05'`, quinta):
  - `diaCurto('2026-11-04')` → `'qua 04/11'`; `diaCurto('2026-11-07')` → `'sáb 07/11'`.
  - `prazoAtividadeGeral`:
    - com subitens nas datas `'2026-11-06'`, `null` e `'2026-11-09'` → `'2026-11-09'`;
    - com subitens todos sem data e atividade em `'2026-11-10'` → `'2026-11-10'`;
    - sem subitens e sem data → `null`.
  - `statusAtividadeGeral`:
    - `(null, '2026-11-04', hoje)` → `'atrasada'`;
    - `(null, '2026-11-05', hoje)` → `'vence_hoje'`;
    - `(null, '2026-11-06', hoje)` → `'aberta'`;
    - `(null, null, hoje)` → `'aberta'`;
    - `('2026-11-01T10:00:00Z', '2026-10-01', hoje)` → `'concluida'`;
    - prazo sexta `'2026-11-06'` com hoje sábado `'2026-11-07'` → `'atrasada'`.
  - `trilhaObraGeral`, com uma fase e três atividades (de Carlos, atrasada; da pessoa atual, vence hoje; sem responsável, sem data) → `sub`:
    - `'Carlos · era para qua 04/11'`;
    - `'Você · vence hoje'`;
    - `'Sem responsável · sem data'`;
    - e `atrasadas` = 1, `venceHoje` = 1, `total` = 3.
  - Concluída sem foto → `sub` termina em `'concluída sem foto'` e `semFoto` = true. Subitens fora de ordem saem ordenados, com `prazoTxt`.
  - `resumoObraGeral`: as quatro formas acima, incluindo o singular e o plural.
  - `atalhosDataPrevista('2026-11-05')` → `[{valor:'2026-11-05',rotulo:'Hoje'},{valor:'2026-11-06',rotulo:'Amanhã'},{valor:'2026-11-09',rotulo:'Seg 09/11'},{valor:'2026-11-10',rotulo:'Ter 10/11'}]`. Com hoje sexta `'2026-11-06'`: Amanhã = `'2026-11-07'` e depois `'Seg 09/11'`, `'Ter 10/11'`.
  - `podePlanejarObraGeral`: Administrador → true; Coordenador → true; Membro → false.
- [ ] **Step 2: Rodar e ver falhar:** `pnpm --filter @contro/core test obraGeral`.
- [ ] **Step 3: Implementar** em `obraGeral.ts` e exportar no `index.ts`.
- [ ] **Step 4: Rodar e ver passar** (o mesmo comando, depois `pnpm --filter @contro/core typecheck`).
- [ ] **Step 5: Commit:** `git commit -m "adiciona as regras da obra geral no core"`

---

### Task 2: Banco: planejamento da obra geral

**Files:**
- Create: `supabase/migrations/20261106100000_obras_gerais_planejamento.sql`
- Create: `supabase/tests/obras_gerais_planejamento.test.sql`

**Interfaces:**
- Consumes (etapa 1): `contro_ve_obra(uuid)`, `contro_coordena_obra(uuid)`, `contro_e_admin()`, `contro_tem_acesso()`, `obra_participante`, o gatilho `a_guarda_obra` (`contro_guarda_obra()`).
- Produces:
  - Colunas em `obra_atividade`: `data_prevista date`, `data_prevista_original date`, `replanejamentos int not null default 0`, `responsavel_id uuid references pessoa(id)`.
  - `contro_planeja_obra(p_obra_id uuid) returns boolean` (stable, security definer, grant para authenticated):
    - obra Contorno: `contro_ve_obra(id)`;
    - obra geral: `contro_coordena_obra(id)`.
  - `adicionar_fase_geral(p_obra_id uuid, p_titulo text, p_id uuid default null) returns uuid`
  - `adicionar_atividade_geral(p_obra_id uuid, p_fase_id uuid, p_nome text, p_responsavel_id uuid, p_data_prevista date, p_subitens jsonb default '[]', p_id uuid default null) returns uuid`. `p_subitens` = `[{ "id": uuid?, "nome": text, "data_prevista": "YYYY-MM-DD" | null }]`.
  - `adicionar_subitem_geral(p_atividade_id uuid, p_nome text, p_data_prevista date, p_id uuid default null) returns uuid`
  - `editar_subitem_geral(p_subitem_id uuid, p_nome text, p_data_prevista date) returns void`
  - `definir_data_prevista(p_atividade_id uuid, p_data date, p_motivo text default null) returns void`. Vale para atividade de topo e para subitem.
  - `definir_responsavel_atividade(p_atividade_id uuid, p_responsavel_id uuid) returns void`. `null` tira o responsável.

Regras:
- **RLS.** Troque as políticas `_ins`/`_upd` de `obra_fase`, `obra_atividade`, `obra_dependencia` e `obra_providencia`, e a `obra_dependencia_del`, de `contro_ve_obra(obra_id)` para `contro_planeja_obra(obra_id)`. A `_sel` e a `foto` ficam como estão. Na Contorno o resultado é idêntico, porque `contro_planeja_obra` = `contro_ve_obra` ali.
- **RPCs de obra geral:**
  - todas são security definer e começam com `contro_tem_acesso()`;
  - localizam a obra do item: obra Contorno → 23505, e a Contorno segue pelas RPCs dela;
  - exigem `contro_planeja_obra(obra)`, senão 42501;
  - nome aparado e não vazio (22023);
  - `p_id` repetido devolve o id existente (offline e duplo toque).
- `adicionar_fase_geral`: `ordem` = máximo + 1, `preliminar = false`.
- `adicionar_atividade_geral`:
  - a fase tem de ser da obra (23503);
  - responsável, quando vier, tem de participar da obra ou ser Administrador ativo (22023);
  - `duracao_du` fica no padrão 1 (não é usado na obra geral);
  - os subitens viram linhas com `pai_id`, `ordem` 1..N e a mesma fase;
  - grava o evento `criada` com `{nome, data_prevista, responsavel_id}`.
- `adicionar_subitem_geral` e `editar_subitem_geral`:
  - o pai é atividade de topo aberta e não excluída (23503);
  - editar a data passa pela mesma regra de `definir_data_prevista`, e o nome grava o evento `editada`.
- `definir_data_prevista`:
  - mesma data: nada a fazer;
  - item aberto que já tinha data: `data_prevista_original = coalesce(data_prevista_original, data antiga)`, `replanejamentos + 1` e evento `replanejada`;
  - sem data antes: evento `data_definida`;
  - item concluído: só troca a data e grava `data_definida`.
- `definir_responsavel_atividade`: mesma validação do responsável; grava o evento `responsavel` com `antes`/`depois` = `{responsavel_id}`.
- **Excluir e restaurar:** `excluir_atividade_obra` e `restaurar_atividade_obra` (de `20261027140000_adicionar_excluir_atividade.sql`) são recriados como cópia literal. Muda só a entrada: `contro_tem_acesso()` e, depois de achar a obra do item, `contro_planeja_obra(obra)` (42501).
- **Prestador:** recrie `contro_normalizar_prestador_atividade()` (a versão de `20261103170000_prestador_uso_unico.sql`) e `contro_sugestao_prestador()` (de `20261026120000_sugestao_prestador.sql`). Quando a obra da linha for geral, a primeira só faz `regexp_replace(trim(prestador), '\s+', ' ', 'g')` (vazio vira null) e a segunda não grava nada em `sugestao`.
- **Guarda:** em `contro_guarda_obra()`, inclua `['mapa_alvo_id','obra_atividade']` na lista de `obra_atividade`. O resto da função fica literal.
- `revoke ... from public, anon` e `grant execute ... to authenticated` para cada função nova.

- [ ] **Step 1: Escrever `obras_gerais_planejamento.test.sql`** (pgTAP). Siga as ajudas de login dos testes `obras_gerais_rpcs.test.sql` (pessoas de teste: Administrador, Coordenador da obra G, Membro da obra G, Coordenador de outra obra, membro da Contorno). Os testes:
  - Coordenador: cria uma fase (ordem 1, depois 2), uma atividade com 2 subitens e define a data; Membro chama cada RPC de planejamento → `throws_ok` com `'42501'`.
  - Membro faz `update obra_atividade set data_prevista = ...` direto → nenhuma linha muda (RLS). `insert into obra_fase` direto → erro de RLS.
  - Coordenador de outra obra geral → 42501. RPC de obra geral com obra Contorno → 23505.
  - Responsável que não participa e não é Administrador → 22023. Administrador como responsável → ok.
  - `definir_data_prevista`:
    - primeira data → `replanejamentos` 0 e evento `data_definida`;
    - segunda data → `replanejamentos` 1, `data_prevista_original` = primeira e evento `replanejada`;
    - terceira data → `replanejamentos` 2 e original ainda a primeira;
    - mesma data → nada muda e nenhum evento novo;
    - atividade concluída → replanejamentos não muda.
  - `editar_subitem_geral` muda nome e data e replaneja. `adicionar_subitem_geral` em atividade concluída → 23503.
  - `p_id` repetido em `adicionar_atividade_geral` devolve o mesmo id e não duplica.
  - Contorno sem mudança: membro da Contorno ainda faz `update obra_atividade set nome` direto em obra Contorno (1 linha) e ainda chama `excluir_atividade_obra` numa atividade Contorno.
  - Prestador `'  Concreteira   Alfa '` em obra geral vira `'Concreteira Alfa'` e não cria `sugestao`. Na Contorno, o mesmo nome continua criando a sugestão.
  - Guarda: `mapa_alvo_id` apontando para atividade de outra obra → 42501.
- [ ] **Step 2: Rodar e ver falhar:** `npx -y supabase@2 db reset` e depois `npx -y supabase@2 test db`.
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: Rodar a suíte inteira e ver passar:** `npx -y supabase@2 db reset && npx -y supabase@2 test db`. Todos os arquivos passam, inclusive `rls_obra`, `adicionar_excluir_atividade`, `sugestao_prestador` e os de obras gerais.
- [ ] **Step 5: Commit:** `git commit -m "adiciona o planejamento da obra geral no banco"`

---

### Task 3: Banco: ações de campo de quem participa da obra

**Files:**
- Create: `supabase/migrations/20261106110000_obras_gerais_campo.sql`
- Create: `supabase/tests/obras_gerais_campo.test.sql`

**Interfaces:**
- Consumes: `contro_tem_acesso()`, `contro_ve_obra(uuid)`.
- Produces: as mesmas assinaturas de hoje para `concluir_atividade(uuid, uuid, uuid)`, `desfazer_conclusao`, `anexar_foto_conclusao`, `definir_avanco(uuid, int, uuid)`, `marcar_subitem(uuid, boolean, uuid)` e `marcar_providencia`, agora abertas a quem participa da obra.

Regras:
- Cada função é recriada como **cópia literal da versão mais recente**. Ache-a com `grep -l "function \(public\.\)\?NOME(" supabase/migrations/*` e use o último arquivo. As únicas mudanças:
  1. A entrada `if not public.contro_e_membro()` vira `if not public.contro_tem_acesso()`.
  2. Logo depois de achar a obra do item (a obra da atividade, do subitem pai ou da providência), entra `if not public.contro_ve_obra(v_obra) then raise exception 'sem acesso a esta obra' using errcode = '42501'; end if;`. Quando a função não guarda a obra numa variável, acrescente o `select obra_id into v_obra` do item.
  3. Em `concluir_atividade`, o `jsonb_build_object` do evento `concluida` ganha `'responsavel_id'` com o `responsavel_id` da atividade.
- Na Contorno o comportamento é igual, porque `contro_ve_obra` de obra Contorno = `contro_e_membro()`. A ordem dos erros pode mudar só para quem não tem acesso.
- Comentário no topo da migration listando de qual arquivo veio cada cópia.

- [ ] **Step 1: Escrever `obras_gerais_campo.test.sql`:**
  - Membro da obra G conclui uma atividade de **outra pessoa** sem foto; o evento `concluida` tem `por` = Membro e `depois->>'responsavel_id'` = o dono.
  - Membro desfaz, avança 50 (`definir_avanco`), marca subitem e marca providência na obra G.
  - Membro de outra obra geral e membro só da Contorno → 42501 em cada uma.
  - Membro da Contorno ainda conclui, desfaz, avança e marca subitem em obra Contorno.
  - `concluir_atividade` repetido com o mesmo `client_op_id` continua idempotente.
- [ ] **Step 2: Rodar e ver falhar** (comandos da Task 2).
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: Rodar a suíte inteira e ver passar.** Atenção a `concluir_atividade_fecha_tarefa`, `conclusao_sem_foto`, `avanco_parcial`, `sem_bloqueio`, `mapa_check` e `obras_gerais_rls`.
- [ ] **Step 5: Commit:** `git commit -m "libera as ações de campo da obra geral para quem participa dela"`

---

### Task 4: Banco: Pessoas da obra para o Coordenador

**Files:**
- Create: `supabase/migrations/20261106120000_obras_gerais_pessoas_da_obra.sql`
- Create: `supabase/tests/obras_gerais_pessoas_da_obra.test.sql`

**Interfaces:**
- Consumes: `contro_planeja_obra(uuid)` (Task 2), `convite_geral`, `obra_participante` e `handle_new_user` (etapa 1, que já consome o convite).
- Produces:
  - `adicionar_membro_obra(p_obra_id uuid, p_pessoa_id uuid) returns void`
  - `convidar_membro_obra(p_obra_id uuid, p_nome text, p_email text) returns uuid`: devolve o id da pessoa, ou `null` quando ficou como convite.
  - `remover_da_obra(p_obra_id uuid, p_pessoa_id uuid) returns void`
  - gatilho `obra_participante_sai` (after delete).
  - política `pessoa_geral_sel` ampliada.

Regras:
- As três RPCs exigem obra geral (23505) e `contro_planeja_obra(obra)` (42501).
- `adicionar_membro_obra`:
  - a pessoa tem de estar ativa e já em Obras gerais (`papel_geral` não nulo), senão 22023;
  - insere a participação (`on conflict do nothing`) e **não muda o papel** de ninguém.
- `convidar_membro_obra`:
  - o e-mail é normalizado (`lower(btrim)`) e validado, como em `salvar_acesso_geral`;
  - pessoa com conta e esse e-mail:
    - `papel_geral` nulo vira `'membro'`;
    - Coordenador ou Membro não muda;
    - entra na obra;
  - sem conta: cria ou atualiza `convite_geral` com `papel = 'membro'` e soma a obra em `obra_ids`, sem duplicar. Um convite que já era `'coordenador'` continua `'coordenador'`.
  - Nunca dá `acesso_contorno` nem `administrador`.
- `remover_da_obra`:
  - Coordenador só remove Membro; Administrador remove qualquer um;
  - remover Coordenador sem ser Administrador → 42501;
  - remover a si mesmo → 22023.
- `obra_participante_sai`: em toda saída da obra, inclusive pelas RPCs de Administrador da etapa 1, faz `update obra_atividade set responsavel_id = null where obra_id = old.obra_id and responsavel_id = old.pessoa_id and concluida_em is null and deleted_at is null` e grava o evento `responsavel` com `depois = {responsavel_id: null, motivo: 'saiu da obra'}`. O aviso ao Coordenador é da etapa 3.
- `pessoa_geral_sel`: além do que já vê, quem tem papel em Obras gerais vê os **Administradores** ativos, porque eles podem ser responsáveis e aparecem pelo nome na obra. O predicado novo é `administrador and ativo and (contro_e_admin() or exists (select 1 from pessoa eu where eu.user_id = auth.uid() and eu.papel_geral is not null and eu.ativo and eu.deleted_at is null))`. Escreva-o numa função `security definer` se a autorreferência na política der recursão.

- [ ] **Step 1: Escrever `obras_gerais_pessoas_da_obra.test.sql`:**
  - Coordenador adiciona um Membro de outra obra, e ele passa a ver a obra (`contro_ve_obra`).
  - Coordenador convida `'  Gus@Email.com '` sem conta: o convite fica com `'gus@email.com'`, `'membro'` e a obra. Ao se cadastrar (simule com `handle_new_user`, como nos testes da etapa 1), a pessoa já participa.
  - Convidar o mesmo e-mail para uma segunda obra soma as obras.
  - Convidar e-mail de pessoa só da Contorno: ela ganha `papel_geral = 'membro'`, continua com `acesso_contorno` e entra na obra.
  - Membro chamando as três RPCs → 42501. Coordenador removendo Coordenador → 42501. Administrador remove → ok.
  - Remover: a atividade aberta da pessoa nessa obra fica sem responsável (evento `responsavel` gravado), a concluída mantém o dono e a atividade dela em **outra** obra não muda. O mesmo vale quando a saída vem de `definir_acesso_geral`.
  - Membro vê o nome de um Administrador (`select nome from pessoa where id = admin`) e **não** vê um gestor que não é Administrador (Matheus).
  - Membro só da Contorno continua sem ver pessoas só de Obras gerais (`pessoa_sel` da etapa 1).
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: Rodar a suíte inteira e ver passar.**
- [ ] **Step 5: Commit:** `git commit -m "adiciona pessoas da obra para o coordenador"`

---

### Task 5: Web: carregar a obra geral e o rodapé de avanço comum

**Files:**
- Create: `apps/web/src/features/obras-gerais/obraGeral.ts` (carga e tipos)
- Create: `apps/web/src/features/obras-gerais/useObraGeral.ts`
- Create: `apps/web/src/features/obras-gerais/planejamento.ts` (chamadas das RPCs da Task 2 e da Task 4)
- Create: `apps/web/src/features/obras-gerais/obraGeral.test.ts`
- Create: `apps/web/src/features/obras/RodapeAvanco.tsx` (+ `.module.css` com as regras movidas)
- Modify: `apps/web/src/features/obras/FichaAtividade.tsx` (usar `RodapeAvanco`)
- Modify: `apps/web/src/features/obras/useConcluirAtividade.ts` e `useAvanco.ts` (aceitar a obra geral)

**Interfaces:**
- Consumes:
  - core `AtividadeGeral`, `FaseGeralEntrada`, `trilhaObraGeral`;
  - `useObraCampo(obraId)` (fila: `concluir`, `desfazer`, `avanco`, `subitem`, `anexarFoto`, `renomear`, `prestador`, `excluir`, `restaurar`).
- Produces:
  - `interface ObraGeral { id: string; nome: string; cidade: string | null; fases: (FaseGeralEntrada & { preliminar: false })[]; atividades: (AtividadeGeral & { mapa_antecedencia_du: null })[]; pessoas: { id: string; nome: string; papel: 'coordenador' | 'membro' | 'administrador' }[]; providencias: ProvidenciaGeral[] }`. `ProvidenciaGeral` traz os mesmos campos que `detalhe.ts` lê de `obra_providencia`.
  - `carregarObraGeral(id: string): Promise<ObraGeral | null>`: `Promise.all` com a obra, as fases, as atividades não excluídas (colunas da interface), os participantes (`obra_participante` → `pessoa(id,nome,papel_geral)`), os Administradores (`pessoa` com `administrador = true`) e as providências. Sem N+1.
  - `useObraGeral(id)`: `queryKey ['obra', id]`, a mesma chave que `invalidar` da fila já usa.
  - Em `planejamento.ts`, uma função por RPC das Tasks 2 e 4, com nomes iguais em camelCase: `adicionarFaseGeral`, `adicionarAtividadeGeral`, `adicionarSubitemGeral`, `editarSubitemGeral`, `definirDataPrevista`, `definirResponsavelAtividade`, `adicionarMembroObra`, `convidarMembroObra`, `removerDaObra`. Todas geram o `p_id` no cliente quando a RPC aceita. Erros saem pelo `mensagemErroAcesso` existente, ampliado para 23503 ("Esse item não existe mais.").
  - `RodapeAvanco` com props `{ avancoPct: number; desabilitado: boolean; onPasso(pct: 25 | 50 | 75): void; onPronta(): void; onFoto(): void }`: o bloco 25% · 50% · 75% · Pronta · Foto tirado de `FichaAtividade.tsx`, com o mesmo markup e as mesmas classes.
  - `useConcluirAtividade` e `useAvanco` passam a tipar a obra como `Pick` mínimo do que leem (id, fases, atividades com `fase_id`, `pai_id`, `concluida_em`, `avanco_pct`, `mapa_antecedencia_du`), e `ObraCompleta` e `ObraGeral` servem nos dois. Se `numeracaoObra` exigir `ObraCompleta`, a obra geral usa o nome sem `#N`.

- [ ] **Step 1: Teste** `obraGeral.test.ts`, com o `supabase` simulado como nos testes vizinhos (`campo.test.ts`). Verifica que:
  - `carregarObraGeral` monta `pessoas` com participantes e Administradores sem repetir;
  - um Administrador que também participa sai com `papel: 'administrador'`;
  - obra inexistente → `null`.
- [ ] **Step 2: Implementar** `obraGeral.ts`, `useObraGeral.ts`, `planejamento.ts` e `RodapeAvanco`. Troque o bloco em `FichaAtividade` por `<RodapeAvanco>` e ajuste os tipos dos dois hooks.
- [ ] **Step 3: Verificar:**
  - `pnpm lint && pnpm typecheck && pnpm test`;
  - no `pnpm dev`, a ficha de uma atividade Contorno continua idêntica (25/50/75/Pronta/Foto e o rodapé "Mapa pronto" do mapa de coleta). Compare um print antes e depois.
- [ ] **Step 4: Commit:** `git commit -m "carrega a obra geral e separa o rodapé de avanço"`

---

### Task 6: Web: tela da obra geral (trilha, fases, seletor de obra)

**Files:**
- Create: `apps/web/src/features/obras-gerais/ObraGeralDetalhe.tsx` (+ `.module.css`)
- Create: `apps/web/src/features/obras-gerais/TrocarObraSheet.tsx`
- Create: `apps/web/src/features/obras-gerais/NovaFaseSheet.tsx`
- Modify: `apps/web/src/features/obras-gerais/ObrasGeraisInicio.tsx` (card abre a obra; a obra aberta é lembrada)

**Interfaces:**
- Consumes: `useObraGeral`, `trilhaObraGeral`, `resumoObraGeral`, `podePlanejarObraGeral`, `useAvanco(obra, aoConcluir)` (anel), `AnelAvanco`, `useObrasGerais()` (lista para o seletor), `adicionarFaseGeral`.
- Produces: `ObraGeralDetalhe` com props `{ id: string; pessoa: PessoaAtual; onVoltar(): void; onTrocarObra(id: string): void; onAbrirPessoas(): void }`. A ficha (Task 7) e a nova atividade (Task 8) abrem por estado interno, `fichaId` e `novaAtividadeFaseId`, lembrados por obra como na Contorno (`obrageral:${id}:fase`, `obrageral:${id}:ficha`).

Comportamento (telas C1, C2, C8, C9, J2, J3):
- **Cabeçalho:** "‹" volta para Minhas obras. O **nome da obra** com "▾" abre `TrocarObraSheet` quando a pessoa tem mais de uma obra geral; com uma só, o nome aparece sem a setinha. Abaixo, a linha `resumoObraGeral`. Sem barra de %, sem relógio, sem boletim, sem "⋯".
- **`TrocarObraSheet`:** título "Suas obras"; uma linha por obra com nome e papel ("Coordenador", "Membro" ou "Administrador"); a atual marcada.
- **Trilha:** acordeão de fases, só uma aberta (lembrada).
  - O botão da fase mostra o número ou o ícone de concluída, o título e "concluída", ou `concluidas/total` com " · N atrasada(s)" em vermelho e " · N vence(m) hoje" em âmbar.
  - Aberta, lista as atividades na ordem: `AnelAvanco` (tocar avança 25%; o quarto toque conclui; Desfazer 5 s), o nome e o `sub`. O `sub` é vermelho quando atrasada e âmbar quando vence hoje, sempre com texto.
  - Abaixo do nome, os subitens em linha ("✓ nome" feito, "› nome" aberto).
  - Concluída sem foto mostra o link "anexar foto", que abre a câmera de anexar (fluxo da Contorno).
  - Tocar no nome abre a ficha (Task 7).
  - "+ Adicionar atividade" no fim da fase, só quando `podePlanejarObraGeral`.
- Depois das fases: "+ fase" (só quem planeja), que abre `NovaFaseSheet` (C8: "Nova fase", campo "Nome da fase", botão "Criar fase" desabilitado com o campo vazio; ao criar, a fase nova abre). Em seguida, a tarja preta "Entrega da obra", sem data.
- **Obra vazia:** "Nenhuma fase ainda." e, para quem planeja, "Toque em + fase para começar.".
- **`ObrasGeraisInicio`:** o card vira botão com seta "›" e abre `ObraGeralDetalhe`. Use `useLembrado('obrasgerais:obra', null)` para reabrir na obra ao voltar ao app, como `inicio:obra` na Contorno.

- [ ] **Step 1: Implementar as três telas e o toque no card.** Reaproveite as classes de `ObraDetalhe.module.css` onde o visual é o mesmo (fase, atividade, tarja), importando o módulo em vez de copiar CSS.
- [ ] **Step 2: Verificar:**
  - `pnpm lint && pnpm typecheck && pnpm test`;
  - no `pnpm dev`, com Supabase local e seed, crie pelo SQL uma obra geral com um Coordenador e um Membro (`criar_obra_geral` e `salvar_acesso_geral`);
  - como Coordenador: criar duas fases e ver a ordem; trocar de obra pelo nome;
  - como Membro: sem "+ fase" e sem "+ Adicionar atividade"; o anel avança e conclui com Desfazer.
  - Prints em 390 px.
- [ ] **Step 3: Commit:** `git commit -m "adiciona a tela da obra geral com trilha, fases e troca de obra"`

---

### Task 7: Web: ficha da atividade geral e edição de subitem

**Files:**
- Create: `apps/web/src/features/obras-gerais/FichaAtividadeGeral.tsx` (+ `.module.css`)
- Create: `apps/web/src/features/obras-gerais/EditarSubitemSheet.tsx`
- Create: `apps/web/src/features/obras-gerais/EscolherResponsavel.tsx` (chips "Eu" + pessoas da obra; usado também na Task 8)
- Modify: `ObraGeralDetalhe.tsx` (abrir a ficha)

**Interfaces:**
- Consumes:
  - `ObraGeral`, `trilhaObraGeral` (linha da atividade), `RodapeAvanco`;
  - `useAvanco(obra).card`, `useConcluirAtividade`, `Camera`;
  - `EscolherData` (`apps/web/src/components/EscolherData.tsx`, com `sugestoes = atalhosDataPrevista(hoje)`);
  - `definirDataPrevista`, `definirResponsavelAtividade`, `adicionarSubitemGeral`, `editarSubitemGeral`;
  - `useObraCampo` (`subitem`, `renomear`, `prestador`, `excluir`, `restaurar`), `TextoEditavel`, `useToast`.
- Produces:
  - `FichaAtividadeGeral` com props `{ obra: ObraGeral; atividadeId: string; pessoa: PessoaAtual; onClose(): void }`;
  - `EscolherResponsavel` com props `{ pessoas: ObraGeral['pessoas']; pessoaId: string | null; valor: string | null; onEscolher(id: string | null): void; permitirNenhum?: boolean }`.

Comportamento (C4, C12, J4):
- **Topo:** "‹ {fase}", o nome (editável com `TextoEditavel` só para quem planeja) e "⋯" (quem planeja) com "Editar nome" e "Excluir atividade". Excluir tem Desfazer de 5 s (`excluir`/`restaurar` da fila de hoje).
- **Linha "Data prevista":**
  - mostra `diaCurto(prazo)` + " · vence hoje" (âmbar) ou " · atrasada" (vermelho); sem data, "sem data";
  - com replanejamentos > 0, acrescenta " · replanejada N×";
  - "Mudar" (só quem planeja) abre um `BottomSheet` com `EscolherData` e chama `definirDataPrevista`, com toast "Data alterada." e Desfazer, que volta a data antiga com a mesma RPC;
  - atividade com subitens: "Mudar" não aparece e a linha diz "A data da atividade acompanha a do último subitem.".
- **Linha "Responsável":** nome, "(você)" quando é a própria pessoa, ou "Sem responsável". "Trocar" (só quem planeja) abre `EscolherResponsavel` com `permitirNenhum`. Toast "Responsável alterado." com Desfazer.
- **"Empresa ou prestador":** `TextoEditavel` com o placeholder "opcional", editável só por quem planeja (op `prestador` da fila).
- **Membro:** sem "Mudar", "Trocar" e "⋯"; abaixo do Responsável, a nota do Membro (texto exato nas Global Constraints).
- **"Subitens · {feitos} de {total}":**
  - a caixinha marca e desmarca (op `subitem`, otimista);
  - o texto mostra nome e `prazoTxt`; tocar no texto abre `EditarSubitemSheet` (só quem planeja; para o Membro o texto não é botão);
  - "+ Adicionar subitem" (quem planeja) abre o mesmo sheet vazio.
- **`EditarSubitemSheet` (C12):** título "Editar subitem" (ou "Novo subitem"); campo "Texto"; "Data prevista" com `EscolherData`; a nota "A data da atividade acompanha a do último subitem."; "Salvar" com toast e Desfazer (volta nome e data antigos); "Excluir subitem" (só ao editar) com Desfazer.
- **Rodapé:** `RodapeAvanco`. "Pronta" conclui sem foto; "Foto" abre a `Camera`; concluída sem foto mostra "Anexar foto". Fica igual para Coordenador e Membro.

- [ ] **Step 1: Implementar** `EscolherResponsavel`, `EditarSubitemSheet` e `FichaAtividadeGeral`, e ligar a ficha na trilha.
- [ ] **Step 2: Verificar:**
  - `pnpm lint && pnpm typecheck && pnpm test`;
  - no `pnpm dev`, como Coordenador: mudar a data duas vezes (a ficha mostra "replanejada 2×"), trocar o responsável, Desfazer, criar e editar subitem (a data da atividade acompanha), excluir subitem com Desfazer;
  - como Membro: concluir com "Pronta" uma atividade de outra pessoa;
  - na tabela `obra_atividade_evento`, `concluida` traz `responsavel_id`;
  - prints em 390 px.
- [ ] **Step 3: Commit:** `git commit -m "adiciona a ficha da atividade geral e a edição de subitem"`

---

### Task 8: Web: nova atividade com data prevista e subitens

**Files:**
- Create: `apps/web/src/features/obras-gerais/NovaAtividadeGeralSheet.tsx` (+ `.module.css`)
- Modify: `ObraGeralDetalhe.tsx` (abrir pelo "+ Adicionar atividade")

**Interfaces:**
- Consumes: `EscolherResponsavel`, `EscolherData`, `atalhosDataPrevista`, `adicionarAtividadeGeral`, `useRascunho` e `AvisoRascunho` (como em `NovaAtividadeSheet`).
- Produces: `NovaAtividadeGeralSheet` com props `{ obra: ObraGeral; faseId: string; pessoa: PessoaAtual; onFechar(): void }`.

Comportamento (C3, C10, C11):
- Título "Nova atividade · {fase}". Campo do nome. Campos:
  - "Quem" com `EscolherResponsavel`, onde "Eu" vem primeiro e o padrão é nenhum;
  - "Para quando" com `EscolherData` (atalhos + "Outra data").
- Chave "Dividir em subitens" (`role="switch"`, a mesma aparência da chave do assistente de modelos):
  - ligada, some o "Para quando" e aparece a lista: cada linha com o nome, a data (`prazoTxt` ou o ícone de calendário quando vazia; tocar abre `EscolherData` num sheet) e "×";
  - "+ subitem" inclui uma linha;
  - abaixo, "Data da atividade: a do último subitem".
  - Ao ligar, nasce uma linha vazia.
- "+ lembrete de providência" e "+ nota" **não** entram nesta etapa: providência e nota já se fazem pela ficha da Contorno e entram na obra geral na etapa 4, junto com o Check list.
- **"Adicionar":**
  - fica desabilitado com o nome vazio;
  - subitens de nome vazio são ignorados;
  - chama `adicionarAtividadeGeral` com `p_id` gerado no cliente;
  - fecha, limpa o rascunho, mostra o toast "Atividade adicionada." com Desfazer (`excluir_atividade_obra`) e a fase continua aberta.

- [ ] **Step 1: Implementar** e ligar ao "+ Adicionar atividade".
- [ ] **Step 2: Verificar:**
  - `pnpm lint && pnpm typecheck && pnpm test`;
  - no `pnpm dev`, criar "Contratar o empreiteiro civil" com 4 subitens (um sem data) e ver na trilha que a data é a do último subitem com data;
  - criar outra atividade com "Amanhã" e Júlia; Desfazer apaga;
  - fechar o sheet no meio e reabrir mostra o rascunho;
  - prints em 390 px.
- [ ] **Step 3: Commit:** `git commit -m "adiciona a nova atividade da obra geral com data prevista e subitens"`

---

### Task 9: Web: Pessoas da obra (Coordenador)

**Files:**
- Create: `apps/web/src/features/obras-gerais/PessoasDaObra.tsx` (+ `.module.css`)
- Create: `apps/web/src/features/obras-gerais/AdicionarMembroSheet.tsx`
- Modify: `apps/web/src/features/perfil/PerfilSheet.tsx` (item "Pessoas da obra" para o Coordenador em Obras gerais)
- Modify: `apps/web/src/features/obras-gerais/ObrasGeraisInicio.tsx` e `App.tsx` (rota da tela)

**Interfaces:**
- Consumes: `ObraGeral.pessoas`, `adicionarMembroObra`, `convidarMembroObra`, `removerDaObra`, `usePessoasGerais` (só para o Administrador) e a lista de pessoas que o Coordenador vê (`pessoa` com `papel_geral` não nulo, por RLS).
- Produces: `PessoasDaObra` com props `{ obraId: string; pessoa: PessoaAtual; onVoltar(): void }`.

Comportamento (C5, C6, C7):
- **Perfil do Coordenador em Obras gerais:** o bloco do ambiente mostra "Pessoas da obra". Com uma obra, abre direto nela; com mais, a pessoa escolhe a obra antes, com o mesmo `TrocarObraSheet`. O Membro não tem o item. O Administrador continua com "Pessoas e acessos" e chega a "Pessoas da obra" pelo seletor ou pela obra.
- **Tela "Pessoas da obra":**
  - "‹ {obra}", título, a nota "Administradores sempre veem" e a seção "Na obra", com uma linha por participante: iniciais, nome, "(você)" e o papel, mais o e-mail para os Membros, quando visível;
  - tocar num Membro (ou em qualquer um, para o Administrador) abre a confirmação "Tirar {nome} da obra?", com o texto "As atividades abertas dele ficam sem responsável." e Desfazer de 5 s, que chama `adicionarMembroObra`;
  - botão "Adicionar membro".
- **`AdicionarMembroSheet`:**
  - título "Adicionar ao {obra}" e uma busca pelo nome entre as pessoas de Obras gerais visíveis que ainda não estão na obra, cada uma com "+";
  - abaixo, "Pessoa nova" com os campos nome e e-mail ("nome e e-mail de login") e o botão "Adicionar como membro";
  - ao concluir, o toast é "{nome} entrou na obra." ou, sem conta, "Convite salvo. {nome} entra na obra ao se cadastrar com esse e-mail.".

- [ ] **Step 1: Implementar** e ligar no perfil e no `App.tsx`.
- [ ] **Step 2: Verificar:**
  - `pnpm lint && pnpm typecheck && pnpm test`;
  - no `pnpm dev`, como Coordenador: adicionar um membro existente, convidar um e-mail novo, tirar um membro que tinha atividade aberta (a atividade fica "Sem responsável");
  - como Membro, o item não aparece;
  - prints em 390 px.
- [ ] **Step 3: Commit:** `git commit -m "adiciona pessoas da obra para o coordenador"`

---

### Task 10: Documentação

**Files:**
- Modify: `PRD.md`, `SPEC.md`, `PLAN.md`, `CLAUDE.md`

- [ ] **Step 1: PRD.** Na seção de Obras gerais: a obra por dentro, com data prevista, subitens, ficha, quem planeja × Membro e Pessoas da obra.
- [ ] **Step 2: SPEC.** Inclui:
  - as colunas novas de `obra_atividade`, `contro_planeja_obra` e as RPCs das Tasks 2–4;
  - os eventos `data_definida`, `replanejada`, `responsavel` e `concluida.responsavel_id`;
  - o core `obraGeral.ts`;
  - as telas `ObraGeralDetalhe`, `FichaAtividadeGeral`, `NovaAtividadeGeralSheet` e `PessoasDaObra`.
- [ ] **Step 3: PLAN.md.** Seção "Obras gerais · Etapa 2" com os itens 1–10 marcados. Em "Decisões" (data 2026-11-06):
  - o menu de baixo foi para a etapa 3;
  - responsável só pessoa da obra ou Administrador;
  - prestador em obra geral sem sugestões;
  - providência e nota na nova atividade foram para a etapa 4;
  - RLS por papel nas tabelas de planejamento (fecha a pendência da etapa 1);
  - saída da obra deixa as atividades sem responsável;
  - Administradores visíveis para quem está em Obras gerais.
  - Decisões que continuam abertas: desativar na Contorno tira as Obras gerais; texto de cadastro do convidado; participação apagada sem histórico; devolver a Contorno a quem é só de Obras gerais.
- [ ] **Step 4: CLAUDE.md.** Na regra 11, uma linha: "Em Obras gerais, planejar (fases, atividades, datas, responsáveis, subitens, pessoas da obra) é do Coordenador e do Administrador, e o Membro faz o campo. Vale na UI, nas RPCs e na RLS."
- [ ] **Step 5: Commit:** `git commit -m "documenta a obra geral por dentro"`

---

### Task 11: Banco: excluir subitem na Contorno (correção pedida pelo usuário em 06/11/2026)

Defeito encontrado durante a etapa: na ficha da Contorno (`FichaAtividade.tsx`), a lixeira do subitem chama `excluir_atividade_obra`, que só aceita atividade de topo (`pai_id is null`), e o usuário vê "Não foi possível excluir o item.". O usuário pediu a correção. Executar antes da Task 10.

**Files:**
- Create: `supabase/migrations/20261106130000_excluir_subitem.sql`
- Create: `supabase/tests/excluir_subitem.test.sql`

**Interfaces:**
- Consumes: `excluir_atividade_obra(uuid)` e `restaurar_atividade_obra(uuid)` na versão da Task 2 (`20261106100000_obras_gerais_planejamento.sql`, entrada `contro_tem_acesso` + `contro_planeja_obra`).
- Produces: as mesmas assinaturas, agora aceitando também id de subitem.

Regras:
- Recriar as duas funções a partir da versão da Task 2, sem mudar a entrada.
- `excluir_atividade_obra`:
  - Atividade de topo: como hoje (leva os subitens junto).
  - Subitem não excluído: exclui só ele (`deleted_at = now()`) e grava o evento `excluida` com `depois = {subitens: []}`.
  - Id inexistente ou já excluído: 23503, como hoje.
- `restaurar_atividade_obra`:
  - Atividade de topo: como hoje.
  - Subitem: restaura só ele, e o pai tem de estar não excluído (23503).
- Nenhuma mudança no web: a ficha da Contorno já chama essas RPCs e já tem o Desfazer.

- [ ] **Step 1: Escrever `excluir_subitem.test.sql`:**
  - Membro da Contorno exclui um subitem: só ele some, o pai e os irmãos ficam, e o evento `excluida` é gravado.
  - Restaurar devolve o subitem.
  - Restaurar subitem cujo pai foi excluído → 23503.
  - Excluir atividade de topo continua levando os subitens, e restaurar traz todos de volta.
  - Membro de obra geral (não Coordenador) excluindo subitem → 42501.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Escrever a migration.**
- [ ] **Step 4: Rodar a suíte inteira e ver passar.**
- [ ] **Step 5: Commit:** `git commit -m "corrige excluir subitem na ficha da obra"`
