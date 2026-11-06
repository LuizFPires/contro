-- Obras gerais · Etapa 2: Pessoas da obra.
-- O Coordenador (ou o Administrador) adiciona quem já está em Obras gerais,
-- convida pelo e-mail como Membro e remove Membros da obra. Quem sai da obra
-- (por estas RPCs ou pelas do Administrador da etapa 1) deixa as atividades
-- abertas dela sem responsável. Quem tem papel em Obras gerais vê os
-- Administradores, que podem ser responsáveis e aparecem pelo nome na obra.
-- Nada disso toca a Contorno: as RPCs exigem obra geral (23505).

-- 1) Adicionar quem já está em Obras gerais. Não muda o papel de ninguém.
-- Coordenador adiciona sempre como Membro: só o Administrador põe um
-- Coordenador numa obra (daria a ele o planejamento dela).
create or replace function adicionar_membro_obra(p_obra_id uuid, p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.contro_exige_planejar_geral(p_obra_id);
  if not exists (
    select 1 from public.pessoa p
    where p.id = p_pessoa_id and p.deleted_at is null and p.ativo and p.papel_geral is not null
  ) then
    raise exception 'Pessoa precisa estar ativa em Obras gerais' using errcode = '22023';
  end if;
  if not public.contro_e_admin() and exists (
    select 1 from public.pessoa p where p.id = p_pessoa_id and p.papel_geral = 'coordenador'
  ) then
    raise exception 'Só administradores colocam coordenadores numa obra' using errcode = '42501';
  end if;
  insert into public.obra_participante (obra_id, pessoa_id, created_by)
  values (p_obra_id, p_pessoa_id, auth.uid())
  on conflict do nothing;
end;
$$;

-- 2) Convidar pelo e-mail como Membro. Com conta: sem papel geral vira Membro
-- (Coordenador e Membro ficam como estão) e entra na obra; quem nunca foi
-- aprovado (pendente) entra só nas Obras gerais, como em salvar_acesso_geral;
-- desativado ou recusado só volta pelo Administrador. Sem conta: convite como
-- Membro somando a obra (convite de Coordenador continua de Coordenador).
-- Coordenador (conta ou convite em aberto) só entra pelo Administrador.
-- Nunca dá acesso à Contorno nem administrador.
create or replace function convidar_membro_obra(p_obra_id uuid, p_nome text, p_email text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_pessoa public.pessoa%rowtype;
begin
  perform public.contro_exige_planejar_geral(p_obra_id);
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception 'e-mail inválido' using errcode = '22023';
  end if;
  if v_nome = '' or char_length(v_nome) > 80 then
    raise exception 'nome deve ter de 1 a 80 caracteres' using errcode = '22023';
  end if;

  select p.* into v_pessoa
  from auth.users u
  join public.pessoa p on p.user_id = u.id
  where lower(btrim(u.email)) = v_email
  limit 1
  for update of p;

  if found then
    if v_pessoa.papel_geral = 'coordenador' and not public.contro_e_admin() then
      raise exception 'Só administradores colocam coordenadores numa obra' using errcode = '42501';
    end if;
    if v_pessoa.deleted_at is not null or v_pessoa.desativado_em is not null then
      raise exception 'Pessoa desativada: só o administrador devolve o acesso' using errcode = '22023';
    end if;
    update public.pessoa set
      papel_geral = coalesce(papel_geral, 'membro'),
      -- Pendente (nunca aprovado) entra só nas Obras gerais.
      acesso_contorno = case when not v_pessoa.ativo then false else acesso_contorno end,
      ativo = true
    where id = v_pessoa.id;
    insert into public.obra_participante (obra_id, pessoa_id, created_by)
    values (p_obra_id, v_pessoa.id, auth.uid())
    on conflict do nothing;
    return v_pessoa.id;
  end if;

  if not public.contro_e_admin() and exists (
    select 1 from public.convite_geral c
    where c.email = v_email and c.usado_em is null and c.papel = 'coordenador'
  ) then
    raise exception 'Só administradores colocam coordenadores numa obra' using errcode = '42501';
  end if;
  insert into public.convite_geral as c (email, nome, papel, obra_ids, created_by)
  values (v_email, v_nome, 'membro', array[p_obra_id], auth.uid())
  on conflict (email) do update set
    -- Convite em aberto: soma a obra e mantém nome, papel e quem convidou.
    -- Convite já usado (a conta foi apagada): recomeça como este.
    nome = case when c.usado_em is null then c.nome else excluded.nome end,
    papel = case when c.usado_em is null then c.papel else excluded.papel end,
    obra_ids = case when c.usado_em is null
                    then case when p_obra_id = any (c.obra_ids) then c.obra_ids
                              else c.obra_ids || p_obra_id end
                    else excluded.obra_ids end,
    created_by = case when c.usado_em is null then c.created_by else excluded.created_by end,
    created_at = case when c.usado_em is null then c.created_at else now() end,
    usado_em = null;
  return null;
end;
$$;

-- 3) Remover da obra. Coordenador só remove Membro; Administrador remove
-- qualquer um; ninguém remove a si mesmo. Quem não participa: nada a fazer.
create or replace function remover_da_obra(p_obra_id uuid, p_pessoa_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alvo public.pessoa%rowtype;
begin
  perform public.contro_exige_planejar_geral(p_obra_id);
  select * into v_alvo from public.pessoa where id = p_pessoa_id;
  if v_alvo.user_id = auth.uid() then
    raise exception 'Ninguém remove a si mesmo da obra' using errcode = '22023';
  end if;
  if not public.contro_e_admin()
     and (v_alvo.id is null or v_alvo.papel_geral is distinct from 'membro' or v_alvo.administrador) then
    raise exception 'Coordenador só remove membro' using errcode = '42501';
  end if;
  delete from public.obra_participante where obra_id = p_obra_id and pessoa_id = p_pessoa_id;
end;
$$;

revoke execute on function adicionar_membro_obra(uuid, uuid) from public, anon;
revoke execute on function convidar_membro_obra(uuid, text, text) from public, anon;
revoke execute on function remover_da_obra(uuid, uuid) from public, anon;
grant execute on function adicionar_membro_obra(uuid, uuid) to authenticated;
grant execute on function convidar_membro_obra(uuid, text, text) to authenticated;
grant execute on function remover_da_obra(uuid, uuid) to authenticated;

-- 4) Saída da obra: as atividades abertas da pessoa nessa obra ficam sem
-- responsável, com o evento. Vale para toda saída (remover_da_obra,
-- definir_acesso_geral, salvar_acesso_geral). Security definer: o
-- responsável só muda por função (obra_atividade_protege_planejamento).
-- Obra apagada fica como está (a guarda da obra barraria a escrita).
create or replace function contro_obra_participante_sai()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_por uuid;
begin
  if not exists (select 1 from public.obra where id = old.obra_id and deleted_at is null) then
    return old;
  end if;
  select id into v_por from public.pessoa where user_id = auth.uid() and deleted_at is null;
  with alteradas as (
    update public.obra_atividade set responsavel_id = null
    where obra_id = old.obra_id and responsavel_id = old.pessoa_id
      and concluida_em is null and deleted_at is null
    returning id
  )
  insert into public.obra_atividade_evento (atividade_id, tipo, por, antes, depois)
  select id, 'responsavel', v_por,
    jsonb_build_object('responsavel_id', old.pessoa_id),
    jsonb_build_object('responsavel_id', null, 'motivo', 'saiu da obra')
  from alteradas;
  return old;
end;
$$;
revoke execute on function contro_obra_participante_sai() from public, anon, authenticated;
create trigger obra_participante_sai after delete on obra_participante
  for each row execute function contro_obra_participante_sai();

-- Troca das participações (etapa 1) sem apagar e recriar as obras que ficam:
-- com o gatilho de saída, apagar e recriar tiraria o responsável das
-- atividades de quem continua na obra. Só sai quem não está na lista.
create or replace function contro_troca_participacoes(p_pessoa_id uuid, p_obra_ids uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.obra_participante
  where pessoa_id = p_pessoa_id and not (obra_id = any (coalesce(p_obra_ids, '{}'::uuid[])));
  insert into public.obra_participante (obra_id, pessoa_id, created_by)
  select distinct i.id, p_pessoa_id, auth.uid()
  from unnest(coalesce(p_obra_ids, '{}'::uuid[])) as i(id)
  on conflict do nothing;
end;
$$;
revoke execute on function contro_troca_participacoes(uuid, uuid[]) from public, anon, authenticated;

-- 5) pessoa_geral_sel: quem tem papel em Obras gerais também vê os
-- Administradores ativos. A checagem de "eu" fica numa função security
-- definer (ler pessoa dentro da política de pessoa daria recursão).
create or replace function contro_tem_papel_geral()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.pessoa eu
    where eu.user_id = auth.uid() and eu.papel_geral is not null and eu.ativo and eu.deleted_at is null
  );
$$;
revoke execute on function contro_tem_papel_geral() from public, anon;
grant execute on function contro_tem_papel_geral() to authenticated;

drop policy pessoa_geral_sel on pessoa;
create policy pessoa_geral_sel on pessoa for select to authenticated
  using (
    deleted_at is null and (
      contro_e_admin()
      or exists (
        select 1 from public.obra_participante op
        where op.pessoa_id = pessoa.id and public.contro_ve_obra(op.obra_id)
      )
      or (administrador and ativo and (contro_e_admin() or contro_tem_papel_geral()))
    )
  );
