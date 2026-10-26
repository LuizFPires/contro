-- Providência da pauta (pgTAP): observação livre e responsável digitado por nome.
--   - grava observação e nome; o nome vira sugestão (tipo pessoa);
--   - escolher uma pessoa do app limpa o nome digitado;
--   - editar o prazo continua replanejando (regra 8).
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gestor@obsnome.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000d1', 'Gestor Obs Nome', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}';
select gerar_obra(
  (select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02',
  'Obra Obs Nome',
  (select id from modelo where nome = 'Modelo 1 · CDC completo')
);

select lives_ok(
  $$ select salvar_tarefa('00000000-0000-0000-0000-0000000000e1', (select id from obra where nome = 'Obra Obs Nome'),
       'Concluir demolições', null, '2026-11-05', null, null, 'Reunião seg 02/11', null,
       '  Caçamba atrasou um dia  ', ' Zé da Caçamba ') $$,
  'cria com observação e nome digitado'
);
select is(
  (select observacao || ' | ' || responsavel_nome from tarefa where id = '00000000-0000-0000-0000-0000000000e1'),
  'Caçamba atrasou um dia | Zé da Caçamba',
  'grava observação e nome sem espaços nas pontas'
);
select ok(
  exists (select 1 from sugestao where tipo = 'pessoa' and texto = 'Zé da Caçamba'),
  'nome digitado vira sugestão'
);

select salvar_tarefa('00000000-0000-0000-0000-0000000000e1', (select id from obra where nome = 'Obra Obs Nome'),
  'Concluir demolições', (select id from pessoa where nome = 'Gestor Obs Nome'), '2026-11-09',
  null, null, null, null, 'Caçamba atrasou um dia', null);
select is(
  (select responsavel_nome from tarefa where id = '00000000-0000-0000-0000-0000000000e1'),
  null,
  'escolher pessoa do app limpa o nome digitado'
);
select is(
  (select replanejamentos from tarefa where id = '00000000-0000-0000-0000-0000000000e1'),
  1,
  'mudar o prazo replaneja'
);
select is(
  (select prazo_original::text from tarefa where id = '00000000-0000-0000-0000-0000000000e1'),
  '2026-11-05',
  'preserva o prazo original'
);

select * from finish();
rollback;
