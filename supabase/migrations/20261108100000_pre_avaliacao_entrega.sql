-- Pré-avaliação de entrega (08/11/2026): prova interna, ponto a ponto, antes da
-- avaliação da Contorno do Corpo. Só nas obras da Contorno.
--   * avaliacao_modelo_item: a lista de itens (103 itens, 10 pontos cada), editável pelo Gestor.
--   * avaliacao_revisao: revisões sucessivas da obra; só uma aberta por vez.
--   * avaliacao_item: cópia dos itens em cada revisão. Editar a lista não mexe em
--     revisões já criadas, e revisão fechada não muda.
--   * "Não conforme" exige foto do antes e vira pendência do Check list; quando a
--     pendência fecha com a foto do depois, o item para de tirar ponto.
-- A nota é regra de domínio e fica em packages/core/src/avaliacao.ts.

create table avaliacao_modelo_item (
  id uuid primary key default gen_random_uuid(),
  secao_ordem integer not null,
  secao text not null check (trim(secao) <> ''),
  ordem integer not null,
  codigo text,
  nome text not null check (trim(nome) <> ''),
  pontos integer not null default 10 check (pontos > 0),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table avaliacao_revisao (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id),
  numero integer not null check (numero > 0),
  status text not null default 'aberta' check (status in ('aberta', 'fechada')),
  criada_por uuid references pessoa (id),
  created_at timestamptz not null default now(),
  fechada_por uuid references pessoa (id),
  fechada_em timestamptz,
  unique (obra_id, numero)
);
create unique index avaliacao_revisao_uma_aberta on avaliacao_revisao (obra_id) where status = 'aberta';

create table avaliacao_item (
  id uuid primary key default gen_random_uuid(),
  revisao_id uuid not null references avaliacao_revisao (id),
  obra_id uuid not null references obra (id),
  modelo_item_id uuid not null references avaliacao_modelo_item (id),
  secao_ordem integer not null,
  secao text not null,
  ordem integer not null,
  codigo text,
  nome text not null,
  pontos integer not null,
  resultado text check (resultado in ('conforme', 'nao_conforme')),
  reconfirmar boolean not null default false,
  pendencia_id uuid references pendencia (id),
  respondido_por uuid references pessoa (id),
  respondido_em timestamptz,
  unique (revisao_id, modelo_item_id)
);
create index avaliacao_item_obra on avaliacao_item (obra_id);
create index avaliacao_item_pendencia on avaliacao_item (pendencia_id) where pendencia_id is not null;

create table avaliacao_oficial (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references obra (id),
  data date not null,
  pontos integer not null check (pontos >= 0),
  total integer not null check (total > 0 and total >= pontos),
  lancada_por uuid references pessoa (id),
  created_at timestamptz not null default now()
);
create index avaliacao_oficial_obra on avaliacao_oficial (obra_id, created_at desc);

-- Lista do check list "Entrega de obra" da Contorno (itens que valem nota).
insert into avaliacao_modelo_item (secao_ordem, secao, ordem, codigo, nome)
select s.ordem, s.nome, i.ordem::integer,
       s.ordem || '.' || (i.ordem + case when s.ordem = 11 then 1 else 0 end), i.nome
from (values
  (1, 'Recepção', array['Catracas','Iluminação','Tomadas','Pintura','Porta de vidro','Porta automática','Piso','Iluminação fachada','Forro','Balcão','Limpeza']),
  (2, 'Salão de musculação', array['Iluminação','Fita LED','Ar condicionado','Espelhos','Tomadas','Pintura','Porta','Piso','Espelhos','Vidros','Cortina','Bebedouro','Piso preto','Armários','Sonorização','Limpeza']),
  (3, 'Vestiário masculino', array['Iluminação','Vaso sanitário','Descarga','Mictório','Chuveiros','Divisórias','Pintura','Piso','Secador de cabelo','Secador de mãos','Dispenser de sabonete','Suporte papel','Espelhos','Ralos','Pias / torneiras','Lixeiras','Limpeza']),
  (4, 'Vestiário feminino', array['Iluminação','Vaso sanitário','Descarga','Mictório','Chuveiros','Divisórias','Pintura','Piso','Secador de cabelos','Secador de mãos','Dispenser de sabonete','Suporte papel','Espelhos','Ralos','Pias / torneiras','Lixeiras','Limpeza']),
  (5, 'Banheiro PCD', array['Iluminação','Vaso sanitário','Descarga','Chuveiros','Suporte papel','Dispenser de sabonete','Pias / torneiras','Porta / fechadura','Barras de suporte','Limpeza']),
  (6, 'Espaço aeróbico', array['Iluminação','Fita LED','Vidros','Pintura','Piso','Limpeza']),
  (7, 'Sala de atividades coletivas', array['Iluminação','Fita LED','Vidros','Pintura','Piso','Limpeza']),
  (8, 'Cozinha', array['Pias / torneiras','Tomadas · microondas','Caixa de gordura','Iluminação','Piso','Pintura','Limpeza']),
  (9, 'Área externa', array['Iluminação · postes externos','Placa fachada','Refletores','Piso','Pintura']),
  (10, 'Estacionamento', array['Lâmpadas estacionamento','Pinturas das faixas','Portão','Placas']),
  (11, 'Documentação e segurança', array['Iluminação de emergência','Sistema de detecção e alarme de fumaça','Instalação do sistema de combate a incêndio','Certificado AVCB'])
) as s(ordem, nome, itens)
cross join lateral unnest(s.itens) with ordinality as i(nome, ordem);

-- Só membro da Contorno, em obra da Contorno que ele vê.
create or replace function contro_avaliacao_acesso(p_obra_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.contro_e_membro() and public.contro_ve_obra(p_obra_id) and exists (
    select 1 from public.obra o where o.id = p_obra_id and o.ambiente = 'contorno'
  );
$$;
revoke execute on function contro_avaliacao_acesso(uuid) from public, anon;
grant execute on function contro_avaliacao_acesso(uuid) to authenticated;

alter table avaliacao_modelo_item enable row level security;
alter table avaliacao_revisao enable row level security;
alter table avaliacao_item enable row level security;
alter table avaliacao_oficial enable row level security;

create policy avaliacao_modelo_item_sel on avaliacao_modelo_item for select to authenticated
  using (contro_e_membro());
create policy avaliacao_modelo_item_ins on avaliacao_modelo_item for insert to authenticated
  with check (contro_e_membro() and contro_perfil() = 'gestor');
create policy avaliacao_modelo_item_upd on avaliacao_modelo_item for update to authenticated
  using (contro_e_membro() and contro_perfil() = 'gestor')
  with check (contro_e_membro() and contro_perfil() = 'gestor');

-- Revisões e itens: leitura pela RLS; toda escrita passa pelas RPCs abaixo.
create policy avaliacao_revisao_sel on avaliacao_revisao for select to authenticated
  using (contro_avaliacao_acesso(obra_id));
create policy avaliacao_item_sel on avaliacao_item for select to authenticated
  using (contro_avaliacao_acesso(obra_id));

create policy avaliacao_oficial_sel on avaliacao_oficial for select to authenticated
  using (contro_avaliacao_acesso(obra_id));
create policy avaliacao_oficial_ins on avaliacao_oficial for insert to authenticated
  with check (contro_avaliacao_acesso(obra_id));

-- Abre a próxima revisão a partir da última fechada.
--   pendência aberta             -> segue não conforme
--   não conforme já resolvido    -> a reconfirmar
--   conforme                     -> mantido (com p_refazer, volta a avaliar)
create or replace function abrir_avaliacao_revisao(p_obra_id uuid, p_refazer boolean default false)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ant uuid;
  v_numero integer;
  v_id uuid;
  v_pessoa uuid;
begin
  if not public.contro_avaliacao_acesso(p_obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  perform 1 from public.obra where id = p_obra_id for update;
  if exists (select 1 from public.avaliacao_revisao where obra_id = p_obra_id and status = 'aberta') then
    raise exception 'Já existe revisão aberta' using errcode = '23505';
  end if;
  select id, numero + 1 into v_ant, v_numero
  from public.avaliacao_revisao where obra_id = p_obra_id
  order by numero desc limit 1;
  v_numero := coalesce(v_numero, 1);
  v_pessoa := public.contro_pessoa_atual();

  insert into public.avaliacao_revisao (obra_id, numero, criada_por)
  values (p_obra_id, v_numero, v_pessoa)
  returning id into v_id;

  insert into public.avaliacao_item (
    revisao_id, obra_id, modelo_item_id, secao_ordem, secao, ordem, codigo, nome, pontos,
    resultado, reconfirmar, pendencia_id
  )
  select v_id, p_obra_id, m.id, m.secao_ordem, m.secao, m.ordem, m.codigo, m.nome, m.pontos,
    case
      when p.id is not null and p.status <> 'fechada' then 'nao_conforme'
      when a.resultado = 'conforme' and not p_refazer then 'conforme'
      else null
    end,
    coalesce(a.resultado = 'nao_conforme' and p.status = 'fechada', false),
    p.id
  from public.avaliacao_modelo_item m
  left join public.avaliacao_item a on a.revisao_id = v_ant and a.modelo_item_id = m.id
  left join public.pendencia p on p.id = a.pendencia_id and p.deleted_at is null
  where m.deleted_at is null;

  return v_id;
end;
$$;

-- Item travado para edição: precisa estar em revisão aberta e o usuário ter acesso.
create or replace function contro_avaliacao_item_aberto(p_item_id uuid)
returns public.avaliacao_item
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.avaliacao_item;
begin
  select * into v_item from public.avaliacao_item where id = p_item_id for update;
  if v_item.id is null then
    raise exception 'Item inválido' using errcode = '23503';
  end if;
  if not public.contro_avaliacao_acesso(v_item.obra_id) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.avaliacao_revisao where id = v_item.revisao_id and status = 'aberta'
  ) then
    raise exception 'Revisão fechada não muda' using errcode = '42501';
  end if;
  return v_item;
end;
$$;
revoke execute on function contro_avaliacao_item_aberto(uuid) from public, anon, authenticated;

-- Conforme, ou volta a avaliar (null). Se o item tinha pendência aberta, ela sai
-- do Check list (exclusão lógica; o Desfazer usa restaurar_nc_avaliacao).
create or replace function marcar_avaliacao_item(
  p_item_id uuid,
  p_resultado text,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.avaliacao_item;
  v_retirar boolean;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  if p_resultado is not null and p_resultado <> 'conforme' then
    raise exception 'Não conforme exige foto do antes' using errcode = '23514';
  end if;
  v_item := public.contro_avaliacao_item_aberto(p_item_id);
  v_retirar := exists (
    select 1 from public.pendencia
    where id = v_item.pendencia_id and deleted_at is null and status <> 'fechada'
  );
  if v_retirar then
    perform public.excluir_pendencia(v_item.pendencia_id);
  end if;
  update public.avaliacao_item
  set resultado = p_resultado,
      reconfirmar = reconfirmar and p_resultado is null,
      pendencia_id = case when v_retirar then null else pendencia_id end,
      respondido_por = public.contro_pessoa_atual(),
      respondido_em = now()
  where id = p_item_id;
end;
$$;

-- Não conforme: cria a pendência (exige foto do antes) ou, se o item já tinha uma
-- pendência resolvida, reabre a mesma pendência.
create or replace function avaliacao_nao_conforme(
  p_item_id uuid,
  p_pendencia_id uuid,
  p_titulo text default null,
  p_local text default null,
  p_criticidade text default 'media',
  p_foto_antes_id uuid default null,
  p_client_op_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.avaliacao_item;
  v_status text;
  v_pend uuid;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return p_pendencia_id; end if;
  v_item := public.contro_avaliacao_item_aberto(p_item_id);

  select id, status into v_pend, v_status from public.pendencia
  where id = v_item.pendencia_id and deleted_at is null;

  if v_pend is null then
    v_pend := public.apontar_pendencia(
      p_pendencia_id, v_item.obra_id, coalesce(nullif(trim(p_titulo), ''), v_item.nome),
      coalesce(nullif(trim(p_local), ''), v_item.secao), p_criticidade, p_foto_antes_id
    );
  elsif v_status = 'fechada' then
    perform public.reabrir_pendencia(v_pend, false);
  end if;

  update public.avaliacao_item
  set resultado = 'nao_conforme', reconfirmar = false, pendencia_id = v_pend,
      respondido_por = public.contro_pessoa_atual(), respondido_em = now()
  where id = p_item_id;
  return v_pend;
end;
$$;

-- Desfazer de "tirou o Não": devolve a pendência ao Check list e o item a não conforme.
create or replace function restaurar_nc_avaliacao(
  p_item_id uuid,
  p_pendencia_id uuid,
  p_client_op_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.avaliacao_item;
begin
  if not public.contro_e_membro() then
    raise exception 'Apenas membros' using errcode = '42501';
  end if;
  if not public.contro_op_nova(p_client_op_id) then return; end if;
  v_item := public.contro_avaliacao_item_aberto(p_item_id);
  if not exists (
    select 1 from public.pendencia where id = p_pendencia_id and obra_id = v_item.obra_id
  ) then
    raise exception 'Pendência não é desta obra' using errcode = '23503';
  end if;
  perform public.restaurar_pendencia(p_pendencia_id);
  update public.avaliacao_item
  set resultado = 'nao_conforme', reconfirmar = false, pendencia_id = p_pendencia_id,
      respondido_por = public.contro_pessoa_atual(), respondido_em = now()
  where id = p_item_id;
end;
$$;

-- Fecha a revisão: todos os itens respondidos; o que foi resolvido fica conforme.
create or replace function fechar_avaliacao_revisao(p_revisao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_status text;
begin
  select obra_id, status into v_obra, v_status
  from public.avaliacao_revisao where id = p_revisao_id for update;
  if v_obra is null then
    raise exception 'Revisão inválida' using errcode = '23503';
  end if;
  if not public.contro_avaliacao_acesso(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if v_status <> 'aberta' then
    raise exception 'Revisão já fechada' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.avaliacao_item i
    left join public.pendencia p on p.id = i.pendencia_id and p.deleted_at is null
    where i.revisao_id = p_revisao_id
      and (i.resultado is null or (i.resultado = 'nao_conforme' and p.id is null))
  ) then
    raise exception 'Faltam itens para fechar a revisão' using errcode = '23514';
  end if;
  update public.avaliacao_item i
  set resultado = 'conforme'
  from public.pendencia p
  where i.revisao_id = p_revisao_id and i.resultado = 'nao_conforme'
    and p.id = i.pendencia_id and p.status = 'fechada';
  update public.avaliacao_revisao
  set status = 'fechada', fechada_por = public.contro_pessoa_atual(), fechada_em = now()
  where id = p_revisao_id;
end;
$$;

-- Desfazer do fechar: só a revisão mais recente da obra.
create or replace function reabrir_avaliacao_revisao(p_revisao_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_obra uuid;
  v_numero integer;
begin
  select obra_id, numero into v_obra, v_numero
  from public.avaliacao_revisao where id = p_revisao_id and status = 'fechada' for update;
  if v_obra is null then
    raise exception 'Revisão inválida' using errcode = '23503';
  end if;
  if not public.contro_avaliacao_acesso(v_obra) then
    raise exception 'sem acesso a esta obra' using errcode = '42501';
  end if;
  if exists (
    select 1 from public.avaliacao_revisao where obra_id = v_obra and numero > v_numero
  ) then
    raise exception 'Só reabre a revisão mais recente' using errcode = '42501';
  end if;
  update public.avaliacao_revisao
  set status = 'aberta', fechada_por = null, fechada_em = null
  where id = p_revisao_id;
end;
$$;

revoke execute on function abrir_avaliacao_revisao(uuid, boolean) from public, anon;
revoke execute on function marcar_avaliacao_item(uuid, text, uuid) from public, anon;
revoke execute on function avaliacao_nao_conforme(uuid, uuid, text, text, text, uuid, uuid) from public, anon;
revoke execute on function restaurar_nc_avaliacao(uuid, uuid, uuid) from public, anon;
revoke execute on function fechar_avaliacao_revisao(uuid) from public, anon;
revoke execute on function reabrir_avaliacao_revisao(uuid) from public, anon;
grant execute on function abrir_avaliacao_revisao(uuid, boolean) to authenticated;
grant execute on function marcar_avaliacao_item(uuid, text, uuid) to authenticated;
grant execute on function avaliacao_nao_conforme(uuid, uuid, text, text, text, uuid, uuid) to authenticated;
grant execute on function restaurar_nc_avaliacao(uuid, uuid, uuid) to authenticated;
grant execute on function fechar_avaliacao_revisao(uuid) to authenticated;
grant execute on function reabrir_avaliacao_revisao(uuid) to authenticated;
