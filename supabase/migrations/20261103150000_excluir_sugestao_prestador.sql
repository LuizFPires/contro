-- Exclusão só do autocomplete: preserva atividades e propostas existentes.
alter table public.sugestao add column deleted_at timestamptz;

create or replace function public.excluir_sugestao_prestador(p_nome text)
returns void language plpgsql security definer set search_path = '' as $$
declare v_chave text := public.contro_chave_prestador(p_nome);
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if nullif(v_chave, '') is null then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_chave, 7351));
  update public.sugestao set deleted_at = now()
    where tipo = 'prestador' and public.contro_chave_prestador(texto) = v_chave
      and deleted_at is null;
end;
$$;
revoke all on function public.excluir_sugestao_prestador(text) from public;
grant execute on function public.excluir_sugestao_prestador(text) to authenticated;
