-- Coordenador da Contorno e boletim do Coordenador de Obras gerais (06/11/2026).
--
-- 1) Contorno ganha o Coordenador: perfil 'gestor' (plenos poderes, inclusive criar
--    obras e editar modelos) marcado por pessoa.coordenador_contorno. A única
--    diferença para o Gestor é desligar pessoas: o Coordenador só desliga quem é da
--    Equipe; Gestor e outro Coordenador, não. Matheus passa a Coordenador.
-- 2) Obras gerais: o Coordenador configura o boletim automático das obras dele
--    (antes só o Administrador). Tirar da obra continua como estava: o Coordenador
--    só tira quem é da Equipe.

alter table pessoa add column coordenador_contorno boolean not null default false;

-- Igual a 20261105200000, com coordenador_contorno entre os campos protegidos.
create or replace function pessoa_protege_papeis()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user = 'authenticated' then
    if tg_op = 'INSERT' then
      if new.administrador is distinct from false
         or new.acesso_contorno is distinct from true
         or new.papel_geral is not null
         or new.coordenador_contorno is distinct from false then
        raise exception 'campos de papel e acesso só mudam por função' using errcode = '42501';
      end if;
    elsif new.administrador is distinct from old.administrador
       or new.acesso_contorno is distinct from old.acesso_contorno
       or new.papel_geral is distinct from old.papel_geral
       or new.coordenador_contorno is distinct from old.coordenador_contorno then
      raise exception 'campos de papel e acesso só mudam por função' using errcode = '42501';
    elsif new.user_id is distinct from old.user_id then
      -- Trocar o login de um cadastro daria a alguém o papel de outra pessoa.
      raise exception 'o login da pessoa não muda' using errcode = '42501';
    elsif old.administrador and not public.contro_e_admin() then
      -- Cadastro de administrador só é alterado por administrador.
      raise exception 'só administrador altera cadastro de administrador' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- Igual a 20261103130000, mais: o Coordenador da Contorno só desliga ou religa
-- quem é da Equipe (nunca Gestor nem outro Coordenador).
create or replace function public.definir_membro_ativo(p_id uuid, p_ativo boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.contro_e_membro() or public.contro_perfil() is distinct from 'gestor' then
    raise exception 'Apenas gestores ativos podem gerenciar membros' using errcode='42501';
  end if;
  if p_ativo is null then raise exception 'Informe o estado do membro'; end if;
  if p_id = public.contro_pessoa_atual() and not p_ativo then
    raise exception 'Você não pode desativar seu próprio acesso' using errcode='23514';
  end if;
  if exists (
       select 1 from public.pessoa eu
       where eu.id = public.contro_pessoa_atual() and eu.coordenador_contorno
     )
     and exists (
       select 1 from public.pessoa alvo
       where alvo.id = p_id and alvo.deleted_at is null
         and (alvo.perfil = 'gestor' or alvo.coordenador_contorno or alvo.administrador
              or alvo.papel_geral = 'coordenador')
     ) then
    raise exception 'O Coordenador só desliga quem é da Equipe' using errcode='42501';
  end if;
  update public.pessoa set ativo=p_ativo, desativado_em=case when p_ativo then null else now() end
    where id=p_id and deleted_at is null;
  if not found then raise exception 'Membro não encontrado' using errcode='23503'; end if;
end;
$$;
revoke all on function public.definir_membro_ativo(uuid,boolean) from public,anon;
grant execute on function public.definir_membro_ativo(uuid,boolean) to authenticated;

-- Igual a 20261106330000, com a permissão aberta ao Coordenador da obra
-- (contro_coordena_obra já inclui o Administrador).
create or replace function salvar_config_boletim_obra(p_obra_id uuid, p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ambiente text;
  v jsonb;
  r public.config_boletim_obra%rowtype;
begin
  if not public.contro_tem_acesso() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  select ambiente into v_ambiente from public.obra where id = p_obra_id and deleted_at is null;
  if v_ambiente is null or not public.contro_ve_obra(p_obra_id) then
    raise exception 'Obra inválida' using errcode = '23503';
  end if;
  if v_ambiente <> 'geral' then
    raise exception 'Obra da Contorno: use a configuração da Contorno' using errcode = '23505';
  end if;
  if not public.contro_coordena_obra(p_obra_id) then
    raise exception 'Só o Gestor ou o Coordenador da obra configura o boletim' using errcode = '42501';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Configuração inválida' using errcode = '22023';
  end if;

  v := coalesce(
    (select to_jsonb(c) from public.config_boletim_obra c where c.obra_id = p_obra_id),
    jsonb_build_object('ativo', true, 'dia_semana', 1, 'hora', '06:30',
      'fechamento_ativo', false, 'fechamento_dia', 5, 'fechamento_hora', '17:00'))
    || (p_config - 'obra_id' - 'updated_at' - 'updated_by');
  begin
    insert into public.config_boletim_obra (
      obra_id, ativo, dia_semana, hora, fechamento_ativo, fechamento_dia, fechamento_hora, updated_by)
    values (
      p_obra_id,
      (v ->> 'ativo')::boolean, (v ->> 'dia_semana')::smallint, (v ->> 'hora')::time,
      (v ->> 'fechamento_ativo')::boolean, (v ->> 'fechamento_dia')::smallint,
      (v ->> 'fechamento_hora')::time,
      public.contro_pessoa_atual())
    on conflict (obra_id) do update set
      ativo = excluded.ativo, dia_semana = excluded.dia_semana, hora = excluded.hora,
      fechamento_ativo = excluded.fechamento_ativo, fechamento_dia = excluded.fechamento_dia,
      fechamento_hora = excluded.fechamento_hora, updated_by = excluded.updated_by
    returning * into r;
  exception
    when check_violation or not_null_violation or invalid_text_representation
      or invalid_datetime_format or datetime_field_overflow or numeric_value_out_of_range then
      raise exception 'Configuração inválida' using errcode = '22023';
  end;
  return to_jsonb(r) - 'updated_at' - 'updated_by';
end;
$$;

revoke execute on function salvar_config_boletim_obra(uuid, jsonb) from public, anon;
grant execute on function salvar_config_boletim_obra(uuid, jsonb) to authenticated;

-- Matheus passa a Coordenador da Contorno (continua com perfil gestor).
update pessoa
   set coordenador_contorno = true
 where perfil = 'gestor' and deleted_at is null and not administrador
   and split_part(lower(btrim(nome)), ' ', 1) = 'matheus';