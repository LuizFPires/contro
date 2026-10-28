-- Check list sem vistoria (pgTAP): resolver com a foto do depois já fecha a
-- pendência, com quem e quando; sem foto continua recusado.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000fd', 'equipe@resolver.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000fd', 'Equipe Resolver', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fd","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Resolver', (select id from modelo where nome = 'Modelo 1 · CDC completo'));

set local role postgres;
insert into foto (id, obra_id, storage_path)
values ('00000000-0000-0000-0000-00000000f0f9', (select id from obra where nome = 'Obra Resolver'), 'teste/depois.jpg');
insert into pendencia (obra_id, titulo) values ((select id from obra where nome = 'Obra Resolver'), 'Porta arrastando');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fd","role":"authenticated"}';

select throws_ok(
  format($$ select resolver_pendencia(%L, null) $$, (select id from pendencia where titulo = 'Porta arrastando')),
  '23503', null, 'resolver sem foto do depois é recusado'
);
select resolver_pendencia((select id from pendencia where titulo = 'Porta arrastando'),
  '00000000-0000-0000-0000-00000000f0f9');
select is((select status from pendencia where titulo = 'Porta arrastando'), 'fechada',
  'com a foto do depois já fica resolvida (sem vistoria)');
select ok(
  (select resolvida_em is not null and resolvida_por is not null from pendencia where titulo = 'Porta arrastando'),
  'guarda quem resolveu e quando'
);
reset role;

select is((select count(*)::int from pendencia where status = 'em_vistoria'), 0,
  'nenhuma pendência fica em vistoria');

select * from finish();
rollback;
