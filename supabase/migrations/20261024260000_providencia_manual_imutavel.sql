-- M3 · Correção do review de segurança: `manual` é server-controlled e IMUTÁVEL.
-- A policy obra_providencia_upd é aberta (qualquer membro atualiza). Sem esta trava,
-- um membro poderia UPDATE manual=true numa providência copiada do modelo e então
-- deletá-la (policy de DELETE exige manual), removendo um bloqueio de liberação
-- sem providenciar. `manual` só é definido no INSERT: gerar_obra copia com false
-- (default) e o lembrete adicionado pelo cliente entra com true.
create or replace function public.obra_providencia_manual_imutavel()
returns trigger
language plpgsql
as $$
begin
  if new.manual is distinct from old.manual then
    raise exception 'manual é imutável';
  end if;
  return new;
end;
$$;

create trigger obra_providencia_manual_imutavel
  before update on public.obra_providencia
  for each row execute function public.obra_providencia_manual_imutavel();
