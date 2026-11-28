-- Obra concluída e início da obra (pedidos do João e do Matheus, 28/11/2026).
-- 1) Mudar o início da obra (Contorno, qualquer membro): a obra inteira anda
--    junto. O core calcula as datas manuais deslocadas (início manual da
--    atividade, "na obra em" da providência) e a inauguração planejada; esta
--    função grava tudo de uma vez e registra o evento `inicio_alterado`.
-- 2) Concluir a obra (Gestor e Coordenador, perfil `gestor`): status
--    'concluida', sai de Minhas obras, Hoje, ações, avisos, reunião e boletim
--    (todos já filtram status = 'ativa'). Não trava por pendência: as abertas
--    são dadas como resolvidas no ato (evento `resolvida` com
--    `conclusao_obra`). A obra sai das reuniões ainda não fechadas.
-- 3) Reabrir a obra: volta a 'ativa' e à pauta das reuniões abertas. O
--    Desfazer (logo depois de concluir) também reabre as pendências fechadas
--    naquele ato; reabrir mais tarde não mexe nelas.
-- 4) Data livre do início manual (core): a data escolhida vale mesmo antes do
--    fim das predecessoras. A única atividade em produção cujo início manual
--    ficava antes das predecessoras recebe a data em que já estava, para o
--    cronograma não mudar sozinho.

alter table obra add column concluida_em timestamptz;
alter table obra add column concluida_por uuid references pessoa (id);

create table obra_evento (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id) on delete cascade,
  tipo text not null, -- 'inicio_alterado' | 'concluida' | 'reaberta'
  por uuid references pessoa (id),
  em timestamptz not null default now(),
  antes jsonb,
  depois jsonb
);
create index on obra_evento (obra_id, em);

-- RLS: quem vê a obra lê os eventos; escrita só pelas funções abaixo.
alter table obra_evento enable row level security;
create policy obra_evento_sel on obra_evento for select to authenticated
  using (public.contro_ve_obra(obra_id));

-- Status, conclusão e início só mudam pelas funções (a policy de update da
-- obra é aberta a membros, para o nome).
create or replace function contro_protege_status_obra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.status <> 'ativa' or new.concluida_em is not null or new.concluida_por is not null then
        raise exception 'Obra nasce ativa' using errcode = '42501';
      end if;
    elsif new.status is distinct from old.status
       or new.concluida_em is distinct from old.concluida_em
       or new.concluida_por is distinct from old.concluida_por
       or new.inicio is distinct from old.inicio then
      raise exception 'Situação e início da obra só mudam por função' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger obra_protege_status before insert or update on obra
  for each row execute function contro_protege_status_obra();

-- 1) Mudar o início da obra.
create or replace function mudar_inicio_obra(
  p_obra_id uuid,
  p_inicio date,
  p_entrega_original date default null,
  p_atividades jsonb default '[]'::jsonb,
  p_providencias jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra public.obra; v_pessoa uuid; v_antes_atv jsonb; v_antes_prov jsonb;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select * into v_obra from public.obra where id = p_obra_id and deleted_at is null for update;
  if v_obra.id is null then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_obra.ambiente <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  if v_obra.status <> 'ativa' then
    raise exception 'Obra concluída: reabra para mudar o início' using errcode = '22023';
  end if;
  if p_inicio is null or extract(isodow from p_inicio) > 5 then
    raise exception 'A obra começa em dia útil' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_atividades) x
    where not exists (
      select 1 from public.obra_atividade a
      where a.id = (x ->> 'id')::uuid and a.obra_id = p_obra_id and a.deleted_at is null
    )
  ) or exists (
    select 1 from jsonb_array_elements(p_providencias) x
    where not exists (
      select 1 from public.obra_providencia p
      where p.id = (x ->> 'id')::uuid and p.obra_id = p_obra_id
    )
  ) then
    raise exception 'Atividade ou providência de outra obra' using errcode = '23503';
  end if;

  v_pessoa := public.contro_pessoa_atual();
  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'inicio_manual', a.inicio_manual)), '[]')
    into v_antes_atv
  from public.obra_atividade a
  where a.id in (select (x ->> 'id')::uuid from jsonb_array_elements(p_atividades) x);
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'na_obra_em', p.na_obra_em)), '[]')
    into v_antes_prov
  from public.obra_providencia p
  where p.id in (select (x ->> 'id')::uuid from jsonb_array_elements(p_providencias) x);

  update public.obra
  set inicio = p_inicio, entrega_original = coalesce(p_entrega_original, entrega_original)
  where id = p_obra_id;
  update public.obra_atividade a
  set inicio_manual = (x ->> 'inicio_manual')::date
  from jsonb_array_elements(p_atividades) x
  where a.id = (x ->> 'id')::uuid;
  update public.obra_providencia p
  set na_obra_em = (x ->> 'na_obra_em')::date
  from jsonb_array_elements(p_providencias) x
  where p.id = (x ->> 'id')::uuid;

  insert into public.obra_evento (obra_id, tipo, por, antes, depois)
  values (
    p_obra_id, 'inicio_alterado', v_pessoa,
    jsonb_build_object('inicio', v_obra.inicio, 'entrega_original', v_obra.entrega_original,
                       'atividades', v_antes_atv, 'providencias', v_antes_prov),
    jsonb_build_object('inicio', p_inicio,
                       'entrega_original', coalesce(p_entrega_original, v_obra.entrega_original),
                       'atividades', p_atividades, 'providencias', p_providencias)
  );
end;
$$;

-- 2) Concluir a obra. Devolve quantas pendências foram dadas como resolvidas.
create or replace function concluir_obra(p_obra_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra public.obra; v_pessoa uuid; v_pends uuid[];
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor ou o coordenador conclui a obra' using errcode = '42501';
  end if;
  select * into v_obra from public.obra where id = p_obra_id and deleted_at is null for update;
  if v_obra.id is null then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_obra.ambiente <> 'contorno' then
    raise exception 'Use as funções da obra geral' using errcode = '23505';
  end if;
  if v_obra.status <> 'ativa' then
    raise exception 'Obra já concluída' using errcode = '22023';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  -- Pendências abertas: dadas como resolvidas neste ato (sem foto do depois).
  select coalesce(array_agg(id), '{}') into v_pends
  from public.pendencia
  where obra_id = p_obra_id and deleted_at is null and status in ('aberta', 'em_vistoria');
  update public.pendencia
  set status = 'fechada', resolvida_por = v_pessoa, resolvida_em = now()
  where id = any (v_pends);
  insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
  select x, 'resolvida', v_pessoa, jsonb_build_object('conclusao_obra', true)
  from unnest(v_pends) x;

  update public.obra
  set status = 'concluida', concluida_em = now(), concluida_por = v_pessoa
  where id = p_obra_id;
  -- Sai das reuniões da Contorno ainda não fechadas (a ata fechada não muda).
  delete from public.reuniao_obra ro
  using public.reuniao r
  where ro.reuniao_id = r.id and ro.obra_id = p_obra_id
    and r.status <> 'fechada' and r.obra_id is null;

  insert into public.obra_evento (obra_id, tipo, por, depois)
  values (p_obra_id, 'concluida', v_pessoa, jsonb_build_object('pendencias', to_jsonb(v_pends)));
  return coalesce(array_length(v_pends, 1), 0);
end;
$$;

-- 3) Reabrir a obra. p_desfazer = Desfazer logo depois de concluir: reabre
--    também as pendências que a conclusão fechou.
create or replace function reabrir_obra(p_obra_id uuid, p_desfazer boolean default false)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_obra public.obra; v_pessoa uuid; v_pends uuid[];
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor ou o coordenador reabre a obra' using errcode = '42501';
  end if;
  select * into v_obra from public.obra where id = p_obra_id and deleted_at is null for update;
  if v_obra.id is null then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_obra.status <> 'concluida' then
    raise exception 'Obra não está concluída' using errcode = '22023';
  end if;
  v_pessoa := public.contro_pessoa_atual();

  if p_desfazer then
    select coalesce(array(select jsonb_array_elements_text(depois -> 'pendencias')::uuid), '{}')
      into v_pends
    from public.obra_evento
    where obra_id = p_obra_id and tipo = 'concluida'
    order by em desc limit 1;
    update public.pendencia
    set status = 'aberta', resolvida_por = null, resolvida_em = null
    where id = any (coalesce(v_pends, '{}')) and status = 'fechada' and foto_depois_id is null;
    insert into public.pendencia_evento (pendencia_id, tipo, por, dados)
    select x, 'reaberta', v_pessoa, jsonb_build_object('conclusao_obra_desfeita', true)
    from unnest(coalesce(v_pends, '{}')) x;
  end if;

  update public.obra
  set status = 'ativa', concluida_em = null, concluida_por = null
  where id = p_obra_id;
  -- Volta à pauta das reuniões da Contorno ainda não fechadas.
  insert into public.reuniao_obra (reuniao_id, obra_id)
  select r.id, p_obra_id from public.reuniao r
  where r.status <> 'fechada' and r.obra_id is null
  on conflict (reuniao_id, obra_id) do nothing;

  insert into public.obra_evento (obra_id, tipo, por, depois)
  values (p_obra_id, 'reaberta', v_pessoa, jsonb_build_object('desfazer', p_desfazer));
end;
$$;

revoke execute on function mudar_inicio_obra(uuid, date, date, jsonb, jsonb) from public, anon;
revoke execute on function concluir_obra(uuid) from public, anon;
revoke execute on function reabrir_obra(uuid, boolean) from public, anon;
grant execute on function mudar_inicio_obra(uuid, date, date, jsonb, jsonb) to authenticated;
grant execute on function concluir_obra(uuid) to authenticated;
grant execute on function reabrir_obra(uuid, boolean) to authenticated;

-- 4) Data livre: CDC - Ipatinga · Impermeabilização dos Vestiários tinha início
--    manual em 09/11, mas as predecessoras a levavam a 23/11. Fica em 23/11.
update obra_atividade set inicio_manual = '2026-11-23'
where id = 'e6ed4a06-cf88-5789-bb52-1d0bf5772aa5' and inicio_manual = '2026-11-09';
