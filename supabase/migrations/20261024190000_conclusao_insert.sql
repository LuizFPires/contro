-- M2 · Fecha o caminho de INSERT na proteção de conclusão (review):
-- pelo INSERT direto o cliente poderia criar a atividade já concluída.
create or replace function obdc_protege_conclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.concluida_em is not null
         or new.concluida_por is not null
         or new.foto_conclusao_id is not null then
        raise exception 'Conclusão só por concluir_atividade' using errcode = '42501';
      end if;
    elsif tg_op = 'UPDATE' then
      if new.concluida_em is distinct from old.concluida_em
         or new.concluida_por is distinct from old.concluida_por
         or new.foto_conclusao_id is distinct from old.foto_conclusao_id then
        raise exception 'Conclusão só por concluir_atividade' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists obra_atividade_protege_conclusao on obra_atividade;
create trigger obra_atividade_protege_conclusao before insert or update on obra_atividade
  for each row execute function obdc_protege_conclusao();
