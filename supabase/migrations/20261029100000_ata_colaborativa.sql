-- Ata colaborativa (decisão do usuário, 29/10/2026).
--   1. reuniao_resposta: cada resposta da pauta fica gravada (antes "Começou" e
--      "Segue o plano" só pintavam o botão, sumiam ao recarregar e a ata
--      mostrava "Começou" como não feito). Uma linha por reunião/seção/item;
--      resposta nula apaga (Desfazer). Reunião fechada não muda.
--   2. tarefa ganha avanço (0–99; 100 é concluir) e comentário: o responsável
--      informa durante a semana em "Minhas ações" e a cobrança da próxima
--      reunião já chega com isso. Qualquer membro informa (sistema
--      colaborativo); cada mudança vira evento ('avanco').

create table reuniao_resposta (
  reuniao_id uuid not null references reuniao (id) on delete cascade,
  obra_id uuid not null references obra (id) on delete cascade,
  secao text not null check (secao in (
    'cobranca', 'passada_concluir', 'passada_comecar',
    'semana_concluir', 'semana_comecar', 'semana_providencia')),
  item_id uuid not null, -- atividade, providência (lembrete) ou tarefa (cobrança)
  resposta text not null check (resposta in (
    'feita', 'nao_feita', 'terminou', 'nao_terminou', 'comecou', 'nao_comecou',
    'segue', 'acao', 'ja_providenciado')),
  respondido_por uuid references pessoa (id),
  respondido_em timestamptz not null default now(),
  primary key (reuniao_id, secao, item_id)
);
create index on reuniao_resposta (reuniao_id, obra_id);

alter table reuniao_resposta enable row level security;
create policy reuniao_resposta_sel on reuniao_resposta
  for select to authenticated using (contro_e_membro());

-- Grava (ou apaga, com p_resposta nula) a resposta de um item da pauta.
create or replace function responder_reuniao(
  p_reuniao_id uuid,
  p_obra_id uuid,
  p_secao text,
  p_item_id uuid,
  p_resposta text,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_status text;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  -- Trava a reunião (como salvar_observacao_reuniao) contra fechar ao mesmo tempo.
  select status into v_status from public.reuniao where id = p_reuniao_id for update;
  if v_status is null then
    raise exception 'Reunião inválida' using errcode = '23503';
  end if;
  if v_status = 'fechada' then
    raise exception 'Reunião fechada' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.reuniao_obra where reuniao_id = p_reuniao_id and obra_id = p_obra_id
  ) then
    raise exception 'Obra não está na pauta' using errcode = '23503';
  end if;

  if p_resposta is null then
    delete from public.reuniao_resposta
    where reuniao_id = p_reuniao_id and secao = p_secao and item_id = p_item_id;
    return;
  end if;

  insert into public.reuniao_resposta (reuniao_id, obra_id, secao, item_id, resposta, respondido_por)
  values (p_reuniao_id, p_obra_id, p_secao, p_item_id, p_resposta, public.contro_pessoa_atual())
  on conflict (reuniao_id, secao, item_id) do update
    set resposta = excluded.resposta,
        respondido_por = excluded.respondido_por,
        respondido_em = now();
end;
$$;

revoke execute on function responder_reuniao(uuid, uuid, text, uuid, text, uuid) from public, anon;
grant execute on function responder_reuniao(uuid, uuid, text, uuid, text, uuid) to authenticated;

-- ---------- Avanço e comentário da ação (tarefa) ----------

alter table tarefa
  add column avanco_pct smallint not null default 0 check (avanco_pct between 0 and 100),
  add column comentario text,
  add column avanco_em timestamptz,
  add column avanco_por uuid references pessoa (id);

create or replace function informar_avanco_tarefa(
  p_id uuid,
  p_pct int,
  p_comentario text default null,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_t public.tarefa;
  v_com text := nullif(trim(coalesce(p_comentario, '')), '');
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if p_pct is null or p_pct < 0 or p_pct > 99 then
    raise exception 'Avanço de 0 a 99%% (100%% é concluir)' using errcode = '22023';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;

  select * into v_t from public.tarefa where id = p_id and deleted_at is null for update;
  if v_t.id is null then
    raise exception 'Tarefa inválida' using errcode = '23503';
  end if;
  if v_t.status = 'feita' then
    raise exception 'Tarefa já concluída' using errcode = '23505';
  end if;
  if v_t.avanco_pct = p_pct and v_t.comentario is not distinct from v_com then
    return;
  end if;

  v_pessoa := public.contro_pessoa_atual();
  update public.tarefa
  set avanco_pct = p_pct, comentario = v_com, avanco_em = now(), avanco_por = v_pessoa
  where id = p_id;
  insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
  values (p_id, 'avanco', v_pessoa,
          jsonb_build_object('pct', v_t.avanco_pct, 'comentario', v_t.comentario),
          jsonb_build_object('pct', p_pct, 'comentario', v_com));
end;
$$;

revoke execute on function informar_avanco_tarefa(uuid, int, text, uuid) from public, anon;
grant execute on function informar_avanco_tarefa(uuid, int, text, uuid) to authenticated;
