-- M10 · Boletim automático — configuração (global, só gestor edita).
-- Uma linha única (singleton): o agendamento vale para todas as obras ativas.
-- dia_semana em ISO: 1=segunda … 7=domingo (combina com extract(isodow)).
-- Edição principal (ex.: segunda 06:30) + edição de fechamento opcional (ex.: sexta 17:00).
create table config_boletim (
  id boolean primary key default true check (id),
  ativo boolean not null default true,
  dia_semana smallint not null default 1 check (dia_semana between 1 and 7),
  hora time not null default '06:30',
  fechamento_ativo boolean not null default false,
  fechamento_dia smallint not null default 5 check (fechamento_dia between 1 and 7),
  fechamento_hora time not null default '17:00',
  updated_at timestamptz not null default now(),
  updated_by uuid references pessoa (id)
);
create trigger config_boletim_set_updated_at before update on config_boletim
  for each row execute function set_updated_at();

-- Linha única com os padrões do SPEC §11 (segunda 06:30; fechamento sexta 17:00 desligado).
insert into config_boletim (id) values (true) on conflict (id) do nothing;

alter table config_boletim enable row level security;

-- Membro ativo lê o agendamento; só o gestor edita (a UI também esconde para a equipe).
-- Sem insert/delete pela app: a linha única nasce aqui.
create policy config_boletim_sel on config_boletim for select to authenticated
  using (contro_e_membro());
create policy config_boletim_upd on config_boletim for update to authenticated
  using (contro_perfil() = 'gestor')
  with check (contro_perfil() = 'gestor');
