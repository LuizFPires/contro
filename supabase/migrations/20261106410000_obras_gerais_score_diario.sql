-- Obras gerais · Etapa 5: o histórico do Score passa a ser por ambiente.
-- As linhas existentes ficam 'contorno'. Em Obras gerais o histórico só é
-- gravado pelo Administrador (visão de todas as obras gerais), para o gráfico
-- não oscilar conforme quem abre o Score; quem tem papel em Obras gerais lê.

alter table public.score_diario
  add column ambiente text not null default 'contorno' check (ambiente in ('contorno', 'geral'));

alter table public.score_diario drop constraint score_diario_pkey;
alter table public.score_diario add primary key (ambiente, aba, chave, dia);

drop policy score_diario_sel on public.score_diario;
create policy score_diario_sel on public.score_diario
  for select to authenticated using (
    case ambiente
      when 'contorno' then public.contro_e_membro()
      -- Obras gerais: o Administrador lê tudo; os demais leem só a aba equipe de
      -- pessoas que a própria RLS de pessoa deixa ver (quem divide obra com
      -- eles). Prestadores e nomes livres (nome:...) ficam só com o Administrador.
      else public.contro_e_admin()
        or (public.contro_tem_papel_geral()
            and aba = 'equipe'
            and exists (select 1 from public.pessoa p where p.id::text = score_diario.chave))
    end
  );

-- Grava (ou atualiza) as linhas de hoje. p_linhas: [{aba, chave, nome, score30, score90}].
drop function public.gravar_score_diario(jsonb);
create or replace function public.gravar_score_diario(p_linhas jsonb, p_ambiente text default 'contorno')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n integer;
begin
  if p_ambiente is distinct from 'contorno' and p_ambiente is distinct from 'geral' then
    raise exception 'ambiente inválido' using errcode = '22023';
  end if;
  if p_ambiente = 'contorno' then
    if not public.contro_e_membro() then
      raise exception 'sem permissão' using errcode = '42501';
    end if;
  elsif not public.contro_e_admin() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'p_linhas deve ser uma lista' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) > 1000 then
    raise exception 'linhas demais' using errcode = '22023';
  end if;

  insert into public.score_diario (ambiente, dia, aba, chave, nome, score30, score90, atualizado_em)
  select distinct on (l->>'aba', l->>'chave')
    p_ambiente, v_dia, l->>'aba', l->>'chave', l->>'nome',
    (l->>'score30')::smallint, (l->>'score90')::smallint, now()
  from jsonb_array_elements(p_linhas) l
  order by l->>'aba', l->>'chave'
  on conflict (ambiente, aba, chave, dia) do update
    set nome = excluded.nome,
        score30 = excluded.score30,
        score90 = excluded.score90,
        atualizado_em = excluded.atualizado_em;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.gravar_score_diario(jsonb, text) from public, anon;
grant execute on function public.gravar_score_diario(jsonb, text) to authenticated;
