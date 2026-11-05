-- Obras gerais · Etapa 1: cada obra só para quem participa dela.
-- Antes: qualquer membro lia e escrevia toda obra (contro_e_membro()).
-- Agora: contro_ve_obra(obra) — Contorno para membros da Contorno (resultado
-- igual ao de hoje), geral para o administrador e os participantes da obra.
-- Os outros predicados de cada política ficam como estavam.

-- 0) Uma regra só de quem vê a obra. contro_ve_obra_mesmo_apagada ignora a
-- exclusão lógica (restaurar_obra mexe em obra apagada); contro_ve_obra é ela
-- mais a obra não apagada.
create or replace function contro_ve_obra_mesmo_apagada(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.obra o
    where o.id = p_obra_id
      and (
        (o.ambiente = 'contorno' and public.contro_e_membro())
        or (o.ambiente = 'geral' and (
          public.contro_e_admin()
          or exists (
            select 1 from public.obra_participante op
            join public.pessoa p on p.id = op.pessoa_id
            where op.obra_id = o.id and p.user_id = auth.uid()
              and p.deleted_at is null and p.ativo
          )
        ))
      )
  );
$$;

create or replace function contro_ve_obra(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.obra o where o.id = p_obra_id and o.deleted_at is null
  ) and public.contro_ve_obra_mesmo_apagada(p_obra_id);
$$;

grant execute on function contro_ve_obra_mesmo_apagada(uuid) to authenticated;

-- 1) Leitura e escrita direta (RLS) nas tabelas que pendem de obra.

-- obra: obra geral só nasce por RPC (criar_obra_geral, Task 5).
drop policy obra_sel on obra;
drop policy obra_ins on obra;
drop policy obra_upd on obra;
create policy obra_sel on obra for select to authenticated
  using (contro_ve_obra(id));
create policy obra_ins on obra for insert to authenticated
  with check (contro_e_membro() and ambiente = 'contorno');
create policy obra_upd on obra for update to authenticated
  using (contro_ve_obra(id)) with check (contro_ve_obra(id));

-- Tabelas com obra_id e políticas sel/ins/upd = contro_e_membro().
do $$
declare t text;
begin
  foreach t in array array['obra_fase','foto','obra_atividade','obra_dependencia','obra_providencia'] loop
    execute format('drop policy %I on %I', t || '_sel', t);
    execute format('drop policy %I on %I', t || '_ins', t);
    execute format('drop policy %I on %I', t || '_upd', t);
    execute format('create policy %I on %I for select to authenticated using (contro_ve_obra(obra_id))', t || '_sel', t);
    execute format('create policy %I on %I for insert to authenticated with check (contro_ve_obra(obra_id))', t || '_ins', t);
    execute format('create policy %I on %I for update to authenticated using (contro_ve_obra(obra_id)) with check (contro_ve_obra(obra_id))', t || '_upd', t);
  end loop;
end $$;

drop policy obra_dependencia_del on obra_dependencia;
create policy obra_dependencia_del on obra_dependencia for delete to authenticated
  using (contro_ve_obra(obra_id));

drop policy obra_mapa_libera_sel on obra_mapa_libera;
drop policy obra_mapa_libera_ins on obra_mapa_libera;
drop policy obra_mapa_libera_del on obra_mapa_libera;
create policy obra_mapa_libera_sel on obra_mapa_libera for select to authenticated
  using (contro_ve_obra(obra_id));
create policy obra_mapa_libera_ins on obra_mapa_libera for insert to authenticated
  with check (contro_ve_obra(obra_id));
create policy obra_mapa_libera_del on obra_mapa_libera for delete to authenticated
  using (contro_ve_obra(obra_id));

drop policy mapa_proposta_sel on mapa_proposta;
drop policy mapa_proposta_ins on mapa_proposta;
drop policy mapa_proposta_upd on mapa_proposta;
create policy mapa_proposta_sel on mapa_proposta for select to authenticated
  using (contro_ve_obra(obra_id));
create policy mapa_proposta_ins on mapa_proposta for insert to authenticated
  with check (contro_ve_obra(obra_id) and criado_por = auth.uid());
create policy mapa_proposta_upd on mapa_proposta for update to authenticated
  using (contro_ve_obra(obra_id)) with check (contro_ve_obra(obra_id));

-- Só leitura direta (escrita por RPC).
do $$
declare t text;
begin
  foreach t in array array['pendencia','tarefa','reuniao_obra','reuniao_resposta','boletim_disparo'] loop
    execute format('drop policy %I on %I', t || '_sel', t);
    execute format('create policy %I on %I for select to authenticated using (contro_ve_obra(obra_id))', t || '_sel', t);
  end loop;
end $$;

-- Eventos: a obra é a do item pai. O exists passa pela RLS do pai
-- (contro_ve_obra(obra_id)), então a obra é avaliada uma vez só.
drop policy obra_atividade_evento_sel on obra_atividade_evento;
create policy obra_atividade_evento_sel on obra_atividade_evento for select to authenticated
  using (exists (
    select 1 from public.obra_atividade a where a.id = obra_atividade_evento.atividade_id
  ));
drop policy pendencia_evento_sel on pendencia_evento;
create policy pendencia_evento_sel on pendencia_evento for select to authenticated
  using (exists (
    select 1 from public.pendencia p where p.id = pendencia_evento.pendencia_id
  ));
drop policy tarefa_evento_sel on tarefa_evento;
create policy tarefa_evento_sel on tarefa_evento for select to authenticated
  using (exists (
    select 1 from public.tarefa t where t.id = tarefa_evento.tarefa_id
  ));

-- 2) pessoa: participante de obra geral vê quem participa de obra em comum.
-- obra_participante já filtra pelas obras que eu vejo (sem recursão em pessoa).
create policy pessoa_geral_sel on pessoa for select to authenticated
  using (
    deleted_at is null and (
      contro_e_admin()
      or exists (
        select 1 from public.obra_participante op
        where op.pessoa_id = pessoa.id and public.contro_ve_obra(op.obra_id)
      )
    )
  );

-- 3) Storage de fotos: a pasta é a obra. Compara texto (pasta que não é uuid
-- não gera erro, só não casa).
drop policy fotos_sel on storage.objects;
drop policy fotos_ins on storage.objects;
create policy fotos_sel on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and exists (
      select 1 from public.obra o
      where o.id::text = (storage.foldername(name))[1] and public.contro_ve_obra(o.id)
    )
  );
create policy fotos_ins on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos' and exists (
      select 1 from public.obra o
      where o.id::text = (storage.foldername(name))[1] and public.contro_ve_obra(o.id)
    )
  );

-- 4) Guarda: as RPCs security definer ficam obra a obra sem reescrever cada uma.
-- Com auth.uid() (cliente ou RPC chamada pelo cliente), só escreve em obra que vê
-- e só aponta para itens (fase, atividade, foto, providência, tarefa) da mesma obra.
-- Cron e rotinas internas (auth.uid() nulo) e o dono/service_role passam.
-- anon também passa (uid nulo): depende do controle de cada RPC, e anon não tem
-- política de escrita nessas tabelas.
create or replace function contro_guarda_obra()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_new jsonb;
  v_old jsonb;
  v_refs text[];
  v_par text[];
  v_ruim boolean;
begin
  -- Passa: sem usuário (cron, rotinas internas) ou sessão que não age como
  -- cliente (dono/service_role, que já ignoram a RLS). O GUC role é o do
  -- SET ROLE da requisição e não muda dentro de função security definer.
  if auth.uid() is null
     or coalesce(current_setting('role', true), 'none') not in ('authenticated', 'anon') then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if tg_table_name = 'obra' then
    -- Só update (Ruling 1: insert da obra é governado pela RLS e pelas RPCs).
    -- Mesmo apagada: restaurar_obra mexe em obra apagada.
    if not public.contro_ve_obra_mesmo_apagada(old.id) then
      raise exception 'sem acesso a esta obra' using errcode = '42501';
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.contro_ve_obra(new.obra_id) then
      raise exception 'sem acesso a esta obra' using errcode = '42501';
    end if;
  else
    -- UPDATE ou DELETE: a linha de hoje tem de ser de obra que vejo.
    if not public.contro_ve_obra(old.obra_id) then
      raise exception 'sem acesso a esta obra' using errcode = '42501';
    end if;
    if tg_op = 'DELETE' then
      return old;
    end if;
    -- UPDATE que muda de obra: a de destino também.
    if new.obra_id is distinct from old.obra_id and not public.contro_ve_obra(new.obra_id) then
      raise exception 'sem acesso a esta obra' using errcode = '42501';
    end if;
  end if;

  -- Referências a outros itens: têm de ser da mesma obra. Lidas por jsonb
  -- (cada tabela tem colunas próprias). Item inexistente fica para a FK.
  v_new := to_jsonb(new);
  v_old := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_refs := case tg_table_name
    when 'obra_atividade' then array[['fase_id','obra_fase'],['pai_id','obra_atividade'],['foto_conclusao_id','foto']]
    when 'obra_dependencia' then array[['atividade_id','obra_atividade'],['predecessora_id','obra_atividade']]
    when 'obra_providencia' then array[['atividade_id','obra_atividade']]
    when 'pendencia' then array[['atividade_id','obra_atividade'],['foto_antes_id','foto'],['foto_depois_id','foto']]
    when 'mapa_proposta' then array[['atividade_id','obra_atividade']]
    when 'obra_mapa_libera' then array[['mapa_id','obra_atividade'],['atividade_id','obra_atividade']]
    when 'tarefa' then array[
      ['efeito_providencia_id','obra_providencia'],
      ['vinculo_id', case v_new->>'vinculo_tipo'
                       when 'atividade' then 'obra_atividade'
                       when 'providencia' then 'obra_providencia' end]]
    when 'reuniao_resposta' then array[['tarefa_id','tarefa']]
  end;
  if v_refs is not null then
    foreach v_par slice 1 in array v_refs loop
      continue when v_par[2] is null or v_new->>v_par[1] is null;
      -- UPDATE sem mudar a referência nem a obra: nada a checar.
      continue when tg_op = 'UPDATE'
        and v_new->>'obra_id' is not distinct from v_old->>'obra_id'
        and v_new->>v_par[1] is not distinct from v_old->>v_par[1]
        and v_new->>'vinculo_tipo' is not distinct from v_old->>'vinculo_tipo';
      execute format(
        'select exists (select 1 from public.%I where id = $1 and obra_id is distinct from $2)', v_par[2])
        into v_ruim using (v_new->>v_par[1])::uuid, new.obra_id;
      if v_ruim then
        raise exception 'item de outra obra (%)', v_par[1] using errcode = '42501';
      end if;
    end loop;
  end if;
  return new;
end;
$$;

-- Nome a_guarda_obra: os triggers BEFORE rodam em ordem alfabética, e a guarda
-- (acesso) vem antes das validações de negócio de cada tabela.
create trigger a_guarda_obra before update on obra
  for each row execute function contro_guarda_obra();

-- O ambiente não muda por escrita direta do cliente (mudar K para geral a
-- esconderia da Contorno; mudar G para contorno a abriria a todos). Sem
-- security definer de propósito: current_user é o do cliente (como em
-- contro_protege_exclusao_obra); RPCs security definer passam.
create or replace function contro_protege_ambiente_obra()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' and new.ambiente is distinct from old.ambiente then
    raise exception 'ambiente da obra só muda por função' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger obra_protege_ambiente before update on obra
  for each row execute function contro_protege_ambiente_obra();

do $$
declare t text;
begin
  foreach t in array array[
    'obra_fase','foto','obra_atividade','obra_dependencia','obra_providencia',
    'obra_mapa_libera','mapa_proposta','pendencia','tarefa',
    'reuniao_obra','reuniao_resposta','boletim_disparo'
  ] loop
    execute format(
      'create trigger a_guarda_obra before insert or update or delete on %I for each row execute function contro_guarda_obra()',
      t);
  end loop;
end $$;

-- 5) A reunião semanal é da Contorno: a pauta só puxa obras Contorno (sem isso,
-- abrir a pauta com uma obra geral ativa esbarraria na guarda).
create or replace function abrir_reuniao(p_data date)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid; v_status text;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  -- Idempotente e à prova de corrida (dois membros abrindo a tela ao mesmo tempo).
  insert into public.reuniao (data, hora)
  values (p_data, coalesce((select reuniao_hora from public.config_avisos where id), '16:00'))
  on conflict (data) do nothing;
  select id, status into v_id, v_status from public.reuniao where data = p_data for update;
  -- Só completa a pauta enquanto a reunião não está fechada (não muta a ata histórica).
  if v_status <> 'fechada' then
    insert into public.reuniao_obra (reuniao_id, obra_id)
    select v_id, o.id from public.obra o
    where o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
    on conflict (reuniao_id, obra_id) do nothing;
  end if;
  return v_id;
end;
$$;

create or replace function reabrir_reuniao(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_n int;
begin
  if public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Só o gestor reabre a pauta' using errcode = '42501';
  end if;
  update public.reuniao
  set status = 'pauta', fechada_em = null, fechada_por = null
  where id = p_id and status = 'fechada';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'Reunião não está fechada' using errcode = '42501';
  end if;
  insert into public.reuniao_obra (reuniao_id, obra_id)
  select p_id, o.id from public.obra o
  where o.status = 'ativa' and o.deleted_at is null and o.ambiente = 'contorno'
  on conflict (reuniao_id, obra_id) do nothing;
end;
$$;
