-- M2 · Reforço de segurança (review): eventos append-only, storage imutável e
-- escopado por obra, e proteção das colunas de conclusão (só via RPC).

-- 1) obra_atividade_evento: append-only, escrito só pelos RPCs SECURITY DEFINER.
drop policy if exists obra_atividade_evento_ins on obra_atividade_evento;
drop policy if exists obra_atividade_evento_upd on obra_atividade_evento;
-- (fica só a política de SELECT para membro)

-- 2) Storage de fotos: sem UPDATE (imutável) e caminho = obra válida.
drop policy if exists fotos_upd on storage.objects;
drop policy if exists fotos_sel on storage.objects;
drop policy if exists fotos_ins on storage.objects;
create policy fotos_sel on storage.objects for select to authenticated
  using (
    bucket_id = 'fotos' and public.contro_e_membro()
    and (storage.foldername(name))[1] in (select id::text from public.obra where deleted_at is null)
  );
create policy fotos_ins on storage.objects for insert to authenticated
  with check (
    bucket_id = 'fotos' and public.contro_e_membro()
    and (storage.foldername(name))[1] in (select id::text from public.obra where deleted_at is null)
  );

-- 3) Conclusão só pelo RPC: bloqueia alteração direta (cliente) das colunas de
-- conclusão. Dentro de uma função SECURITY DEFINER (dona = postgres) current_user
-- é a dona, então o concluir_atividade passa; update direto (role authenticated) não.
create or replace function contro_protege_conclusao()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (
    new.concluida_em is distinct from old.concluida_em
    or new.concluida_por is distinct from old.concluida_por
    or new.foto_conclusao_id is distinct from old.foto_conclusao_id
  ) and current_user = 'authenticated' then
    raise exception 'Conclusão só por concluir_atividade' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger obra_atividade_protege_conclusao before update on obra_atividade
  for each row execute function contro_protege_conclusao();
