-- Ficha da atividade (vídeo do usuário, 24/11/2026):
-- 1) Obras gerais: data de início prevista na atividade de topo, ao lado da
--    data prevista (término). Mudar um início que já existia é replanejar
--    (evento `inicio_ajustado`, com motivo opcional); o primeiro início é
--    `inicio_definido`. Desfazer em 10 min, como a data prevista.
-- 2) Anotação do andamento ("choveu, não deu para trabalhar"): qualquer pessoa
--    que vê a obra (Contorno ou geral) registra um texto livre; evento
--    `anotacao` com o texto e o avanço da hora. Fila offline (client_op_id).
-- 3) O término não fica antes do início (definir_data_prevista recriada).

alter table obra_atividade add column data_inicio date;

-- O início entra no rastro protegido: só muda pelas RPCs.
create or replace function contro_protege_planejamento_atividade()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.data_prevista is not null
         or new.data_prevista_original is not null
         or new.replanejamentos <> 0
         or new.responsavel_id is not null
         or new.data_inicio is not null then
        raise exception 'data prevista e responsável só mudam por função' using errcode = '42501';
      end if;
    elsif new.data_prevista is distinct from old.data_prevista
       or new.data_prevista_original is distinct from old.data_prevista_original
       or new.replanejamentos is distinct from old.replanejamentos
       or new.responsavel_id is distinct from old.responsavel_id
       or new.data_inicio is distinct from old.data_inicio then
      raise exception 'data prevista e responsável só mudam por função' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Término da atividade de topo: a maior data dos subitens; sem subitem com
-- data, a dela (como prazoAtividadeGeral no core).
create or replace function contro_termino_atividade(p_atividade_id uuid)
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select max(s.data_prevista) from public.obra_atividade s
     where s.pai_id = p_atividade_id and s.deleted_at is null),
    (select a.data_prevista from public.obra_atividade a where a.id = p_atividade_id));
$$;
revoke execute on function contro_termino_atividade(uuid) from public, anon, authenticated;

-- Início previsto (só obra geral, só quem planeja). Mesma data: null. Item
-- aberto que já tinha início e recebe outro: `inicio_ajustado` (com motivo);
-- senão `inicio_definido`. Aberto com início não volta a "sem início" (22023;
-- o Desfazer usa desfazer_inicio_previsto). Devolve o id do evento.
create or replace function definir_inicio_previsto(p_atividade_id uuid, p_data date, p_motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atv public.obra_atividade%rowtype;
  v_pessoa uuid;
  v_evento uuid;
  v_fim date;
  v_motivo text := left(nullif(btrim(coalesce(p_motivo, '')), ''), 120);
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_atv from public.obra_atividade
  where id = p_atividade_id and pai_id is null and deleted_at is null
  for update;
  if not found then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_atv.obra_id);
  if p_data is not distinct from v_atv.data_inicio then
    return null;
  end if;
  if p_data is null and v_atv.concluida_em is null then
    raise exception 'Não dá para tirar a data; use Desfazer' using errcode = '22023';
  end if;
  v_fim := public.contro_termino_atividade(p_atividade_id);
  if p_data is not null and v_fim is not null and p_data > v_fim then
    raise exception 'O início fica depois do término' using errcode = '22023';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  update public.obra_atividade set data_inicio = p_data where id = p_atividade_id;
  if v_atv.concluida_em is null and v_atv.data_inicio is not null then
    insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
    values (p_atividade_id, 'inicio_ajustado', v_pessoa, clock_timestamp(),
      jsonb_build_object('inicio', v_atv.data_inicio),
      jsonb_strip_nulls(jsonb_build_object('inicio', p_data, 'motivo', v_motivo)))
    returning id into v_evento;
  else
    insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
    values (p_atividade_id, 'inicio_definido', v_pessoa, clock_timestamp(),
      jsonb_build_object('inicio', v_atv.data_inicio),
      jsonb_build_object('inicio', p_data))
    returning id into v_evento;
  end if;
  return v_evento;
end;
$$;
revoke execute on function definir_inicio_previsto(uuid, date, text) from public, anon;
grant execute on function definir_inicio_previsto(uuid, date, text) to authenticated;

-- Desfazer do início (toast de 5 s): volta o início de antes. Só quem planeja,
-- só o próprio evento, até 10 min e só o último evento de início do item.
create or replace function desfazer_inicio_previsto(p_evento_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ev public.obra_atividade_evento%rowtype;
  v_atv public.obra_atividade%rowtype;
  v_pessoa uuid;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select * into v_ev from public.obra_atividade_evento where id = p_evento_id;
  if not found then
    raise exception 'Não dá mais para desfazer' using errcode = '22023';
  end if;
  select * into v_atv from public.obra_atividade where id = v_ev.atividade_id for update;
  perform public.contro_exige_planejar_geral(v_atv.obra_id);
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  if v_ev.tipo not in ('inicio_definido', 'inicio_ajustado')
     or v_ev.por is distinct from v_pessoa
     or v_ev.em < now() - interval '10 minutes'
     or not (coalesce(v_ev.antes, '{}'::jsonb) ? 'inicio')
     or exists (
       select 1 from public.obra_atividade_evento e
       where e.atividade_id = v_ev.atividade_id and e.id <> v_ev.id
         and e.tipo in ('inicio_definido', 'inicio_ajustado', 'inicio_desfeito')
         and e.em >= v_ev.em
     ) then
    raise exception 'Não dá mais para desfazer' using errcode = '22023';
  end if;
  update public.obra_atividade set data_inicio = (v_ev.antes ->> 'inicio')::date where id = v_atv.id;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, em, antes, depois)
  values (v_atv.id, 'inicio_desfeito', v_pessoa, clock_timestamp(),
    jsonb_build_object('inicio', v_atv.data_inicio),
    v_ev.antes || jsonb_build_object('evento_id', v_ev.id));
end;
$$;
revoke execute on function desfazer_inicio_previsto(uuid) from public, anon;
grant execute on function desfazer_inicio_previsto(uuid) to authenticated;

-- Data prevista (término): igual a antes, mas o término da atividade de topo
-- não fica antes do início dela.
create or replace function definir_data_prevista(p_atividade_id uuid, p_data date, p_motivo text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_inicio date;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  select obra_id, data_inicio into v_obra, v_inicio
  from public.obra_atividade where id = p_atividade_id and deleted_at is null;
  if v_obra is null then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  perform public.contro_exige_planejar_geral(v_obra);
  if p_data is not null and v_inicio is not null and p_data < v_inicio then
    raise exception 'O término fica antes do início' using errcode = '22023';
  end if;
  return public.contro_aplica_data_prevista(p_atividade_id, p_data, left(p_motivo, 120));
end;
$$;

-- Anotação do andamento: texto livre (até 500 caracteres) de quem vê a obra,
-- na atividade de topo (aberta ou concluída). Guarda o avanço da hora (aberta).
create or replace function anotar_atividade(
  p_atividade_id uuid,
  p_texto text,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atv public.obra_atividade%rowtype;
  v_pessoa uuid;
  v_texto text := btrim(coalesce(p_texto, ''));
begin
  if not public.contro_tem_acesso() then
    raise exception 'Sem acesso' using errcode = '42501';
  end if;
  if v_texto = '' then
    raise exception 'Escreva a anotação' using errcode = '22023';
  end if;
  if length(v_texto) > 500 then
    raise exception 'Anotação com até 500 caracteres' using errcode = '22023';
  end if;
  select * into v_atv from public.obra_atividade
  where id = p_atividade_id and pai_id is null and deleted_at is null;
  if not found then
    raise exception 'Atividade inválida' using errcode = '23503';
  end if;
  if not public.contro_ve_obra(v_atv.obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, depois)
  values (p_atividade_id, 'anotacao', v_pessoa,
    jsonb_strip_nulls(jsonb_build_object(
      'texto', v_texto,
      'pct', case when v_atv.concluida_em is null then v_atv.avanco_pct end)));
end;
$$;
revoke execute on function anotar_atividade(uuid, text, uuid) from public, anon;
grant execute on function anotar_atividade(uuid, text, uuid) to authenticated;
