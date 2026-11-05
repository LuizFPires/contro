-- Score diário (05/11/2026): o score com que cada pessoa (aba equipe) e cada
-- prestador (aba prestadores) fechou o dia, para o gráfico de evolução no
-- detalhe do Score. O app calcula o score com o core e grava a linha do dia
-- (a última gravação do dia vence). O dia é sempre o de hoje no fuso
-- America/Sao_Paulo, decidido pelo servidor: dia passado não muda mais.

create table public.score_diario (
  dia date not null,
  aba text not null check (aba in ('equipe', 'prestadores')),
  -- responsavelId | `nome:${nome}` (equipe) ou nome normalizado (prestador)
  chave text not null check (length(chave) between 1 and 200),
  nome text not null check (length(nome) between 1 and 200),
  score30 smallint check (score30 between 0 and 100),
  score90 smallint check (score90 between 0 and 100),
  atualizado_em timestamptz not null default now(),
  primary key (aba, chave, dia)
);

alter table public.score_diario enable row level security;

-- Todo membro ativo lê (o Score é de todos os perfis). Escrita só pela função.
create policy score_diario_sel on public.score_diario
  for select to authenticated using (contro_e_membro());

revoke insert, update, delete on public.score_diario from anon, authenticated;

-- Grava (ou atualiza) as linhas de hoje. p_linhas: [{aba, chave, nome, score30, score90}].
create or replace function public.gravar_score_diario(p_linhas jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia date := (now() at time zone 'America/Sao_Paulo')::date;
  v_n integer;
begin
  if not contro_e_membro() then
    raise exception 'sem permissão' using errcode = '42501';
  end if;
  if jsonb_typeof(p_linhas) is distinct from 'array' then
    raise exception 'p_linhas deve ser uma lista' using errcode = '22023';
  end if;
  if jsonb_array_length(p_linhas) > 1000 then
    raise exception 'linhas demais' using errcode = '22023';
  end if;

  insert into score_diario (dia, aba, chave, nome, score30, score90, atualizado_em)
  select distinct on (l->>'aba', l->>'chave')
    v_dia, l->>'aba', l->>'chave', l->>'nome',
    (l->>'score30')::smallint, (l->>'score90')::smallint, now()
  from jsonb_array_elements(p_linhas) l
  order by l->>'aba', l->>'chave'
  on conflict (aba, chave, dia) do update
    set nome = excluded.nome,
        score30 = excluded.score30,
        score90 = excluded.score90,
        atualizado_em = excluded.atualizado_em;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.gravar_score_diario(jsonb) from public, anon;
grant execute on function public.gravar_score_diario(jsonb) to authenticated;
