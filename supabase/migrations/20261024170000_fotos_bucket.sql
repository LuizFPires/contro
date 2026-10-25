-- M2 · Bucket privado de fotos + políticas de storage.
-- Membro ativo lê e envia; caminho obra_id/… (escopo por obra fica para depois).
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'fotos_sel') then
    create policy fotos_sel on storage.objects for select to authenticated
      using (bucket_id = 'fotos' and public.obdc_e_membro());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'fotos_ins') then
    create policy fotos_ins on storage.objects for insert to authenticated
      with check (bucket_id = 'fotos' and public.obdc_e_membro());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and policyname = 'fotos_upd') then
    create policy fotos_upd on storage.objects for update to authenticated
      using (bucket_id = 'fotos' and public.obdc_e_membro())
      with check (bucket_id = 'fotos' and public.obdc_e_membro());
  end if;
end $$;
