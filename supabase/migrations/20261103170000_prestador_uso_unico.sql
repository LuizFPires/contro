-- Prestador conta um uso só (correção, 03/11/2026). Desde 20261103140000 o
-- gatilho que padroniza o nome do prestador (antes de gravar) também criava a
-- sugestão; em seguida o gatilho antigo (depois de gravar) somava +1. Resultado:
-- nome novo nascia com 2 usos. Agora o gatilho de antes só padroniza o nome
-- (usa a grafia já cadastrada, mesmo excluída do autocompletar) e quem registra
-- o uso continua sendo contro_sugestao_prestador. As propostas do mapa seguem
-- usando contro_nome_prestador, que cria a sugestão.

create or replace function public.contro_normalizar_prestador_atividade()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chave text := public.contro_chave_prestador(new.prestador);
  v_nome text;
begin
  if nullif(v_chave, '') is null then
    new.prestador := null;
    return new;
  end if;
  select texto into v_nome from public.sugestao
  where tipo = 'prestador' and public.contro_chave_prestador(texto) = v_chave
  order by created_at, texto
  limit 1;
  new.prestador := coalesce(v_nome, regexp_replace(trim(new.prestador), '\s+', ' ', 'g'));
  return new;
end;
$$;
