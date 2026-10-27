-- 1) Reabrir atividade concluída (pedido do usuário, 26/10/2026): qualquer
--    membro da obra pode voltar a atividade para pendente (clicou sem querer,
--    ou precisa refazer). Antes só quem concluiu desfazia, e só pelo toast. A
--    reabertura fica no evento 'reaberta' com quem fez (regra 7).
create or replace function desfazer_conclusao(
  p_atividade_id uuid,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pessoa uuid;
  v_obra uuid;
  v_fase uuid;
  v_por uuid;
  v_foto uuid;
  v_xp int := 50;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then
    return;
  end if;

  perform 1 from public.obra_atividade
  where id = p_atividade_id or pai_id = p_atividade_id
  order by id
  for update;

  select obra_id, fase_id, concluida_por, foto_conclusao_id
  into v_obra, v_fase, v_por, v_foto
  from public.obra_atividade
  where id = p_atividade_id and deleted_at is null and pai_id is null and concluida_em is not null;
  if v_obra is null then
    raise exception 'Atividade não está concluída' using errcode = '42501';
  end if;
  select id into v_pessoa from public.pessoa where user_id = auth.uid() and deleted_at is null;
  -- Fase toda concluída = esta conclusão tinha fechado a fase (+200).
  if not exists (
    select 1 from public.obra_atividade
    where fase_id = v_fase and pai_id is null and deleted_at is null and concluida_em is null
  ) then
    v_xp := v_xp + 200;
  end if;

  update public.obra_atividade
  set concluida_em = null, concluida_por = null, foto_conclusao_id = null
  where id = p_atividade_id;
  update public.obra set xp = greatest(0, xp - v_xp) where id = v_obra;
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes)
  values (p_atividade_id, 'reaberta', v_pessoa, jsonb_build_object('foto_id', v_foto));
end;
$$;

-- 2) "Demolições e retiradas" sem subitens, como todas as outras atividades
--    (os subitens vieram do seed). Modelos: apaga os subitens. Obras: exclusão
--    lógica (regra 7). A duração da atividade continua a gravada (5 du).
delete from modelo_atividade s
using modelo_atividade p
where s.pai_id = p.id and p.nome = 'Demolições e retiradas' and p.pai_id is null;

update obra_atividade s
set deleted_at = now()
from obra_atividade p
where s.pai_id = p.id and p.nome = 'Demolições e retiradas' and p.pai_id is null
  and s.deleted_at is null;
