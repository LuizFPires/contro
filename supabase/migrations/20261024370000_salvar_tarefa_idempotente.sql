-- M9-offline (fatia 5c) · salvar_tarefa idempotente, aceitando id gerado no
-- cliente (para inserir offline). Compatível com o caminho online (reunião):
--   - p_id nulo        → nova tarefa com id do servidor (como antes).
--   - p_id inexistente → nova tarefa com o id do cliente (insert idempotente).
--   - p_id existente   → edição (replaneja/edita), como antes.
-- O guard obdc_op_nova no topo corta o reenvio da MESMA op (sem evento nem
-- replanejamento duplicados); com p_client_op_id nulo (reunião) ele não atua.
--
-- O novo parâmetro muda a assinatura: removemos a versão antiga de 8 args.

drop function if exists public.salvar_tarefa(uuid, uuid, text, uuid, date, text, uuid, text);

create or replace function salvar_tarefa(
  p_id uuid,
  p_obra_id uuid,
  p_texto text,
  p_responsavel_id uuid,
  p_prazo date,
  p_vinculo_tipo text default null,
  p_vinculo_id uuid default null,
  p_origem_texto text default null,
  p_client_op_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_id uuid; v_old public.tarefa;
begin
  if not public.obdc_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.obdc_op_nova(p_client_op_id) then return p_id; end if;
  if coalesce(trim(p_texto), '') = '' then
    raise exception 'Texto obrigatório' using errcode = '23514';
  end if;
  if p_prazo is null then
    raise exception 'Prazo obrigatório' using errcode = '23514';
  end if;
  v_pessoa := public.obdc_pessoa_atual();

  -- Tarefa já existente? (quando p_id é nulo, é sempre nova)
  if p_id is not null then
    select * into v_old from public.tarefa where id = p_id and deleted_at is null;
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
    insert into public.tarefa (id, obra_id, texto, responsavel_id, prazo, vinculo_tipo, vinculo_id, origem_texto)
    values (coalesce(p_id, gen_random_uuid()), p_obra_id, p_texto, p_responsavel_id, p_prazo,
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
    set texto = p_texto, responsavel_id = p_responsavel_id, prazo = p_prazo,
        prazo_original = coalesce(prazo_original, v_old.prazo),
        replanejamentos = replanejamentos + 1
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
    values (p_id, 'replanejada', v_pessoa,
            jsonb_build_object('prazo', v_old.prazo),
            jsonb_build_object('prazo', p_prazo));
  else
    update public.tarefa
    set texto = p_texto, responsavel_id = p_responsavel_id, prazo = p_prazo
    where id = p_id;
    insert into public.tarefa_evento (tarefa_id, tipo, por) values (p_id, 'editada', v_pessoa);
  end if;
  return p_id;
end;
$$;
