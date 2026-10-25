-- M5 · Editar o cronograma da OBRA (duração e predecessoras da cópia), por
-- gestor e equipe. Duração e predecessoras já têm policy de UPDATE/INSERT aberta
-- a membros (do M2). Faltam: trigger anti-ciclo em obra_dependencia (hoje só o
-- modelo tem) e a policy de DELETE para remover uma predecessora.

-- Trigger anti-ciclo: rejeita a dependência que fecharia um ciclo na obra.
-- (self-dependência também é rejeitada, pois a cadeia parte da predecessora.)
create or replace function obdc_checa_ciclo_obra_dependencia()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    with recursive anc as (
      select new.predecessora_id as id
      union
      select d.predecessora_id
      from public.obra_dependencia d
      join anc on d.atividade_id = anc.id and d.obra_id = new.obra_id
    )
    select 1 from anc where id = new.atividade_id
  ) then
    raise exception 'Ciclo de dependências na obra' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger obra_dependencia_anti_ciclo before insert or update on obra_dependencia
  for each row execute function obdc_checa_ciclo_obra_dependencia();

-- Remover predecessora (editar cronograma): membro pode apagar a dependência.
create policy obra_dependencia_del on obra_dependencia
  for delete to authenticated using (obdc_e_membro());
