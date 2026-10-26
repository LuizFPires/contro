-- Prestador da atividade vira sugestão (cadastro pelo uso): ao gravar um nome
-- novo ou diferente em obra_atividade.prestador, registra/incrementa a
-- sugestao tipo 'prestador'. Trigger, para valer em qualquer caminho de escrita.

create or replace function contro_sugestao_prestador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_nome text := nullif(trim(coalesce(new.prestador, '')), '');
begin
  if v_nome is not null and v_nome is distinct from nullif(trim(coalesce(old.prestador, '')), '') then
    insert into public.sugestao (tipo, texto) values ('prestador', v_nome)
    on conflict (tipo, texto) do update set usos = public.sugestao.usos + 1, ultimo_uso = now();
  end if;
  return new;
end;
$$;

create trigger obra_atividade_sugestao_prestador
  after update of prestador on obra_atividade
  for each row execute function contro_sugestao_prestador();
