-- Check-in (17/11/2026): mínimo de 4 fotos por check-in (pedido do usuário,
-- antes era pelo menos 1). O resto de registrar_checkin não muda.
create or replace function registrar_checkin_minimo_fotos() returns integer
language sql immutable set search_path = '' as $$ select 4 $$;
grant execute on function registrar_checkin_minimo_fotos() to authenticated;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'registrar_checkin';
  v_def := replace(
    v_def,
    $a$if jsonb_typeof(p_fotos) is distinct from 'array' or jsonb_array_length(p_fotos) = 0 then
    raise exception 'O check-in precisa de pelo menos uma foto' using errcode = '22023';$a$,
    $b$if jsonb_typeof(p_fotos) is distinct from 'array'
     or jsonb_array_length(p_fotos) < public.registrar_checkin_minimo_fotos() then
    raise exception 'O check-in precisa de pelo menos 4 fotos' using errcode = '22023';$b$
  );
  if position('pelo menos 4 fotos' in v_def) = 0 then
    raise exception 'registrar_checkin: trecho do mínimo de fotos não encontrado';
  end if;
  execute v_def;
end;
$$;
