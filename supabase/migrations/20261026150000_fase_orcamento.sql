-- Nova fase 1 "Orçamento" em todos os modelos e em todas as obras (decisão do
-- usuário, 26/10/2026). As fases existentes são renumeradas (+1).
--   - Uma atividade "Orçamento" com 3 subitens em sequência, 5 dias úteis cada:
--     Recebimento dos projetos → Levantamento de quantitativos → Montagem da EAP no Grana.
--   - Sem predecessoras e ninguém depende dela: corre em paralelo com a
--     Mobilização, sem mudar as datas das demais atividades.
--   - Nas obras já criadas entra ABERTA (a fazer).
-- Idempotente: só age onde ainda não há fase "Orçamento". Também é chamada pelo
-- seed de homologação (os modelos do seed entram depois das migrations).

create or replace function contro_garantir_fase_orcamento()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  r record;
  v_fase uuid;
  v_atv uuid;
  v_ordem int;
  v_sub text;
  v_i int;
  v_subs text[] := array[
    'Recebimento dos projetos',
    'Levantamento de quantitativos',
    'Montagem da EAP no Grana'
  ];
begin
  -- Modelos
  for r in
    select m.id from public.modelo m
    where not exists (
      select 1 from public.modelo_fase f where f.modelo_id = m.id and f.titulo = 'Orçamento'
    )
  loop
    update public.modelo_fase set ordem = ordem + 1 where modelo_id = r.id;
    insert into public.modelo_fase (modelo_id, ordem, titulo)
    values (r.id, 1, 'Orçamento') returning id into v_fase;
    select coalesce(min(ordem), 1) - 1 into v_ordem from public.modelo_atividade where modelo_id = r.id;
    insert into public.modelo_atividade (modelo_id, fase_id, ordem, nome, duracao_du, em_sequencia)
    values (r.id, v_fase, v_ordem, 'Orçamento', 15, true) returning id into v_atv;
    v_i := 0;
    foreach v_sub in array v_subs loop
      v_i := v_i + 1;
      insert into public.modelo_atividade (modelo_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
      values (r.id, v_fase, v_i, v_sub, 5, v_atv, true);
    end loop;
  end loop;

  -- Obras já criadas (cópias): mesma estrutura, aberta.
  for r in
    select o.id from public.obra o
    where not exists (
      select 1 from public.obra_fase f where f.obra_id = o.id and f.titulo = 'Orçamento'
    )
  loop
    update public.obra_fase set ordem = ordem + 1 where obra_id = r.id;
    insert into public.obra_fase (obra_id, ordem, titulo)
    values (r.id, 1, 'Orçamento') returning id into v_fase;
    select coalesce(min(ordem), 1) - 1 into v_ordem from public.obra_atividade where obra_id = r.id;
    insert into public.obra_atividade (obra_id, fase_id, ordem, nome, duracao_du, em_sequencia)
    values (r.id, v_fase, v_ordem, 'Orçamento', 15, true) returning id into v_atv;
    v_i := 0;
    foreach v_sub in array v_subs loop
      v_i := v_i + 1;
      insert into public.obra_atividade (obra_id, fase_id, ordem, nome, duracao_du, pai_id, em_sequencia)
      values (r.id, v_fase, v_i, v_sub, 5, v_atv, true);
    end loop;
  end loop;
end;
$$;

revoke all on function contro_garantir_fase_orcamento() from public, anon, authenticated;

select contro_garantir_fase_orcamento();
