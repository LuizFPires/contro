-- Vocabulário único (05/11/2026): Comprar / Alugar / Contratar, sem dois-pontos.
-- Só troca prefixos conhecidos; preserva descrição, vínculos, estado e prazos.
-- Espelho de packages/core/src/textoProvidencia.ts.
create or replace function public.normalizar_texto_providencia(p_texto text)
returns text
language sql immutable strict
set search_path = ''
as $$
  select case
    when p_texto ~* '^[[:space:]]*(Destravar[[:space:]]+)?(Compra|Comprar|Locação|Locacao|Alugar|Contratação|Contratacao|Contratar)[[:space:]]*:[[:space:]]*[^[:space:]]' then
      rtrim(regexp_replace(regexp_replace(regexp_replace(p_texto,
        '^[[:space:]]*(Destravar[[:space:]]+)?(Compra|Comprar)[[:space:]]*:[[:space:]]*', 'Comprar ', 'i'),
        '^[[:space:]]*(Destravar[[:space:]]+)?(Locação|Locacao|Alugar)[[:space:]]*:[[:space:]]*', 'Alugar ', 'i'),
        '^[[:space:]]*(Destravar[[:space:]]+)?(Contratação|Contratacao|Contratar)[[:space:]]*:[[:space:]]*', 'Contratar ', 'i'))
    else p_texto
  end;
$$;

revoke all on function public.normalizar_texto_providencia(text) from public, anon;
grant execute on function public.normalizar_texto_providencia(text) to authenticated, service_role;

-- Também protege contra versões antigas do app e operações offline pendentes.
create or replace function public.padronizar_texto_tarefa()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.texto := public.normalizar_texto_providencia(new.texto);
  return new;
end;
$$;

revoke all on function public.padronizar_texto_tarefa() from public, anon, authenticated;

drop trigger if exists tarefa_padronizar_texto on public.tarefa;
create trigger tarefa_padronizar_texto
before insert or update of texto on public.tarefa
for each row execute function public.padronizar_texto_tarefa();

-- Inclui abertas, feitas e excluídas (restaurar mantém o padrão). A auditoria
-- guarda o título anterior; nenhum evento histórico existente é reescrito.
with anteriores as materialized (
  select id, texto as antes, public.normalizar_texto_providencia(texto) as depois
  from public.tarefa
  where texto is distinct from public.normalizar_texto_providencia(texto)
), alteradas as (
  update public.tarefa t
     set texto = a.depois
    from anteriores a
   where t.id = a.id
  returning t.id, a.antes, t.texto as depois
)
insert into public.tarefa_evento (tarefa_id, tipo, por, antes, depois)
select id, 'editada', null,
       jsonb_build_object('texto', antes),
       jsonb_build_object('texto', depois, 'motivo', 'padronizacao_providencias_20261105')
from alteradas;
