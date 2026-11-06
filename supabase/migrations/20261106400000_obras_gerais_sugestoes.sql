-- Obras gerais · Etapa 5: sugestões por ambiente e nome livre em tarefa geral.
--
-- sugestao ganha ambiente ('contorno' | 'geral'). As existentes ficam
-- 'contorno'. A unicidade passa a ser por (ambiente, tipo, texto): o mesmo
-- nome pode existir nos dois ambientes, cada um com seus usos. Quem tem papel
-- em Obras gerais (ou é Administrador) lê e grava as sugestões de Obras gerais
-- (de todas as obras gerais); a Contorno lê e grava só as da Contorno.
--
-- Funções recriadas (cópia literal da versão mais recente + ambiente):
--   contro_nome_prestador                 20261103140000_propostas_mapa.sql
--   contro_normalizar_prestador_atividade 20261106100000_obras_gerais_planejamento.sql
--   contro_sugestao_prestador             20261106100000_obras_gerais_planejamento.sql
--   excluir_sugestao_prestador            20261103150000_excluir_sugestao_prestador.sql
--   salvar_tarefa                         20261106310000_obras_gerais_tarefas_pendencias.sql
-- Todo "on conflict (tipo, texto)" em vigor passa a (ambiente, tipo, texto).

-- 1) Coluna e unicidade --------------------------------------------------------

alter table public.sugestao
  add column ambiente text not null default 'contorno'
  check (ambiente in ('contorno', 'geral'));
alter table public.sugestao drop constraint sugestao_tipo_texto_key;
alter table public.sugestao add constraint sugestao_ambiente_tipo_texto_key unique (ambiente, tipo, texto);

-- 2) RLS por ambiente ----------------------------------------------------------

drop policy sugestao_sel on public.sugestao;
drop policy sugestao_ins on public.sugestao;
drop policy sugestao_upd on public.sugestao;
create policy sugestao_sel on public.sugestao
  for select to authenticated using (
    (ambiente = 'contorno' and public.contro_e_membro())
    or (ambiente = 'geral' and (public.contro_e_admin() or public.contro_tem_papel_geral()))
  );
create policy sugestao_ins on public.sugestao
  for insert to authenticated with check (
    (ambiente = 'contorno' and public.contro_e_membro())
    or (ambiente = 'geral' and (public.contro_e_admin() or public.contro_tem_papel_geral()))
  );
create policy sugestao_upd on public.sugestao
  for update to authenticated
  using (
    (ambiente = 'contorno' and public.contro_e_membro())
    or (ambiente = 'geral' and (public.contro_e_admin() or public.contro_tem_papel_geral()))
  )
  with check (
    (ambiente = 'contorno' and public.contro_e_membro())
    or (ambiente = 'geral' and (public.contro_e_admin() or public.contro_tem_papel_geral()))
  );

-- 3) Prestador do mapa de cotação (só Contorno): sugestões 'contorno' ---------

create or replace function public.contro_nome_prestador(p_nome text)
returns text language plpgsql security definer set search_path = '' as $$
declare v_nome text; v_chave text := public.contro_chave_prestador(p_nome);
begin
  if not public.contro_e_membro() then raise exception 'Apenas membros' using errcode = '42501'; end if;
  if nullif(v_chave, '') is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_chave, 7351));
  select texto into v_nome from public.sugestao
    where ambiente = 'contorno' and tipo = 'prestador' and public.contro_chave_prestador(texto) = v_chave
    order by created_at, texto limit 1;
  if v_nome is null then
    v_nome := regexp_replace(trim(p_nome), '\s+', ' ', 'g');
    insert into public.sugestao(ambiente, tipo, texto) values ('contorno', 'prestador', v_nome)
    on conflict (ambiente, tipo, texto) do nothing;
  end if;
  return v_nome;
end;
$$;

-- 4) Prestador da atividade: padroniza pela grafia das sugestões do ambiente
-- da obra (a obra geral deixa de só aparar e passa a usar as sugestões 'geral').
create or replace function public.contro_normalizar_prestador_atividade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chave text := public.contro_chave_prestador(new.prestador);
  v_nome text;
  v_ambiente text;
begin
  if nullif(v_chave, '') is null then
    new.prestador := null;
    return new;
  end if;
  select coalesce((select ambiente from public.obra where id = new.obra_id), 'contorno') into v_ambiente;
  select texto into v_nome from public.sugestao
  where ambiente = v_ambiente and tipo = 'prestador' and public.contro_chave_prestador(texto) = v_chave
  order by created_at, texto
  limit 1;
  new.prestador := coalesce(v_nome, regexp_replace(trim(new.prestador), '\s+', ' ', 'g'));
  return new;
end;
$$;

-- 5) Prestador usado vira sugestão do ambiente da obra.
create or replace function contro_sugestao_prestador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_nome text := nullif(trim(coalesce(new.prestador, '')), '');
  v_ambiente text;
begin
  if v_nome is not null and v_nome is distinct from nullif(trim(coalesce(old.prestador, '')), '') then
    select coalesce((select ambiente from public.obra where id = new.obra_id), 'contorno') into v_ambiente;
    insert into public.sugestao (ambiente, tipo, texto) values (v_ambiente, 'prestador', v_nome)
    on conflict (ambiente, tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;
  return new;
end;
$$;

-- 6) Excluir sugestão de prestador, por ambiente. Contorno: membro (igual a
-- antes). Obras gerais: quem planeja alguma obra geral (Coordenador de alguma
-- obra geral ou Administrador). A assinatura muda: a antiga sai.
drop function public.excluir_sugestao_prestador(text);
create or replace function public.excluir_sugestao_prestador(p_nome text, p_ambiente text default 'contorno')
returns void language plpgsql security definer set search_path = '' as $$
declare v_chave text := public.contro_chave_prestador(p_nome);
begin
  if p_ambiente is null or p_ambiente not in ('contorno', 'geral') then
    raise exception 'Ambiente inválido' using errcode = '22023';
  end if;
  if p_ambiente = 'contorno' and not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if p_ambiente = 'geral' and not (
    public.contro_e_admin()
    or exists (
      select 1 from public.obra o
      where o.ambiente = 'geral' and o.deleted_at is null and public.contro_coordena_obra(o.id)
    )
  ) then
    raise exception 'Só quem planeja obra geral' using errcode = '42501';
  end if;
  if nullif(v_chave, '') is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_chave, 7351));
  update public.sugestao set deleted_at = now()
    where ambiente = p_ambiente and tipo = 'prestador' and public.contro_chave_prestador(texto) = v_chave
      and deleted_at is null;
end;
$$;
revoke all on function public.excluir_sugestao_prestador(text, text) from public;
grant execute on function public.excluir_sugestao_prestador(text, text) to authenticated;

-- 7) Tarefa: obra geral aceita nome livre (vira sugestão 'geral'); Contorno
-- igual (sugestão 'contorno'). Responsável escolhido continua validado.
create or replace function salvar_tarefa(
  p_id uuid,
  p_obra_id uuid,
  p_texto text,
  p_responsavel_id uuid,
  p_prazo date,
  p_vinculo_tipo text default null,
  p_vinculo_id uuid default null,
  p_origem_texto text default null,
  p_client_op_id uuid default null,
  p_observacao text default null,
  p_responsavel_nome text default null,
  p_motivo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_id uuid; v_old public.tarefa;
  v_nome text := nullif(trim(coalesce(p_responsavel_nome, '')), '');
  v_obs text := nullif(trim(coalesce(p_observacao, '')), '');
  v_obra uuid;
  v_ambiente text := 'contorno';
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return p_id; end if;
  if coalesce(trim(p_texto), '') = '' then
    raise exception 'Texto obrigatório' using errcode = '23514';
  end if;
  if p_prazo is null then
    raise exception 'Prazo obrigatório' using errcode = '23514';
  end if;
  v_pessoa := public.contro_pessoa_atual();
  if p_responsavel_id is not null then v_nome := null; end if;

  -- Tarefa já existente? (quando p_id é nulo, é sempre nova)
  if p_id is not null then
    select * into v_old from public.tarefa where id = p_id and deleted_at is null;
  end if;

  -- A obra é a da tarefa existente (edição) ou a informada (criação).
  v_obra := coalesce(v_old.obra_id, p_obra_id);
  if not public.contro_planeja_obra(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if exists (select 1 from public.obra where id = v_obra and ambiente = 'geral') then
    v_ambiente := 'geral';
    perform public.contro_valida_responsavel_geral(v_obra, p_responsavel_id);
  end if;

  -- Nome digitado (sem login no app) vira sugestão de autocompletar do ambiente.
  if v_nome is not null then
    insert into public.sugestao (ambiente, tipo, texto) values (v_ambiente, 'pessoa', v_nome)
    on conflict (ambiente, tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;

  if v_old.id is null then
    -- O vínculo tem de ser da MESMA obra (evita efeito cruzado entre obras).
    if p_vinculo_tipo = 'providencia' and not exists (
      select 1 from public.obra_providencia where id = p_vinculo_id and obra_id = p_obra_id
    ) then
      raise exception 'Vínculo (providência) não é desta obra' using errcode = '23503';
    end if;
    if p_vinculo_tipo = 'atividade' and not exists (
      select 1 from public.obra_atividade where id = p_vinculo_id and obra_id = p_obra_id
    ) then
      raise exception 'Vínculo (atividade) não é desta obra' using errcode = '23503';
    end if;
    insert into public.tarefa (id, obra_id, texto, responsavel_id, responsavel_nome, observacao, prazo, vinculo_tipo, vinculo_id, origem_texto)
    values (coalesce(p_id, gen_random_uuid()), p_obra_id, p_texto, p_responsavel_id, v_nome, v_obs, p_prazo,
            p_vinculo_tipo, p_vinculo_id, p_origem_texto)
    on conflict (id) do nothing
    returning id into v_id;
    -- Chegar aqui com o id ocupado (e não ser reenvio, cortado pelo guard) é
    -- colisão/reuso do id do cliente: aborta e não grava evento órfão.
    if v_id is null then
      raise exception 'Tarefa com esse id já existe' using errcode = '23505';
    end if;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (v_id, 'criada', v_pessoa);
    return v_id;
  end if;

  if v_old.status = 'aberta' and p_prazo is distinct from v_old.prazo then
    update public.tarefa
    set texto = p_texto, responsavel_id = p_responsavel_id, responsavel_nome = v_nome,
        observacao = v_obs, prazo = p_prazo,
        prazo_original = coalesce(prazo_original, v_old.prazo),
        replanejamentos = replanejamentos + 1
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
    values (p_id, 'replanejada', v_pessoa,
            jsonb_build_object('prazo', v_old.prazo),
            jsonb_build_object('prazo', p_prazo, 'motivo', nullif(left(btrim(p_motivo), 120), '')));
  else
    update public.tarefa
    set texto = p_texto, responsavel_id = p_responsavel_id, responsavel_nome = v_nome,
        observacao = v_obs, prazo = p_prazo
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'editada', v_pessoa);
  end if;
  return p_id;
end;
$$;
