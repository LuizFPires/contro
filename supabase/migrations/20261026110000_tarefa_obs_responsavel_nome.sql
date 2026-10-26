-- Pauta guiada da reunião (opção A): a providência ganha observação livre e
-- responsável digitado por nome (quem não tem login no app). O nome digitado
-- vira sugestão (cadastro pelo uso). Muda a assinatura de salvar_tarefa: os
-- dois parâmetros novos entram no fim, com default, e a versão de 9 args sai.

alter table tarefa add column observacao text;
alter table tarefa add column responsavel_nome text;

drop function if exists public.salvar_tarefa(uuid, uuid, text, uuid, date, text, uuid, text, uuid);

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
  p_responsavel_nome text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_pessoa uuid; v_id uuid; v_old public.tarefa;
  v_nome text := nullif(trim(coalesce(p_responsavel_nome, '')), '');
  v_obs text := nullif(trim(coalesce(p_observacao, '')), '');
begin
  if not public.contro_e_membro() then
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
  -- Nome digitado (sem login no app) vira sugestão de autocompletar.
  if p_responsavel_id is not null then v_nome := null; end if;
  if v_nome is not null then
    insert into public.sugestao (tipo, texto) values ('pessoa', v_nome)
    on conflict (tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;

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
            jsonb_build_object('prazo', p_prazo));
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

grant execute on function salvar_tarefa(uuid, uuid, text, uuid, date, text, uuid, text, uuid, text, text) to authenticated;
