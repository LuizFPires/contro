-- Editar meu nome (pgTAP): troca só o próprio nome e exige nome e sobrenome.
begin;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000a9', 'equipe@meunome.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000a9', 'Equipe', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000a9","role":"authenticated"}';
select throws_ok($$ select atualizar_meu_nome('Paulo') $$, '23514', null, 'só o primeiro nome não vale');
select is(atualizar_meu_nome('  Paulo   Mendes '), 'Paulo Mendes', 'grava nome e sobrenome sem espaços sobrando');
reset role;
select is((select nome from pessoa where user_id = '00000000-0000-0000-0000-0000000000a9'), 'Paulo Mendes', 'o nome da pessoa mudou');

select * from finish();
rollback;
