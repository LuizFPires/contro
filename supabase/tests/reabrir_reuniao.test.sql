-- Reabrir a pauta (pgTAP): só o gestor; volta a 'pauta' e ganha as obras ativas;
-- reunião que não está fechada é recusada.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(5);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'gestor@reabrir-reuniao.contro'),
  ('00000000-0000-0000-0000-0000000000e2', 'equipe@reabrir-reuniao.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000e1', 'Gestor Reabrir', 'gestor'),
  ('00000000-0000-0000-0000-0000000000e2', 'Equipe Reabrir', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

-- Reunião fechada sem obras (como a de 26/10) e uma obra ativa criada depois.
set local role postgres;
insert into reuniao (data, status, fechada_em) values ('2031-01-06', 'fechada', now());
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-01-06', 'Obra Reabrir Pauta', (select id from modelo where nome = 'Modelo 1 · CDC completo'));

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e2","role":"authenticated"}';
select throws_ok(
  format($$ select reabrir_reuniao(%L) $$, (select id from reuniao where data = '2031-01-06')),
  '42501', null, 'equipe não reabre a pauta'
);

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}';
select lives_ok(
  format($$ select reabrir_reuniao(%L) $$, (select id from reuniao where data = '2031-01-06')),
  'gestor reabre a pauta'
);
select is((select status from reuniao where data = '2031-01-06'), 'pauta', 'volta a ser pauta');
select ok(
  exists (select 1 from reuniao_obra ro join reuniao r on r.id = ro.reuniao_id
    join obra o on o.id = ro.obra_id where r.data = '2031-01-06' and o.nome = 'Obra Reabrir Pauta'),
  'ganha as obras ativas de hoje'
);
select throws_ok(
  format($$ select reabrir_reuniao(%L) $$, (select id from reuniao where data = '2031-01-06')),
  '42501', null, 'reunião que não está fechada é recusada'
);
reset role;

select * from finish();
rollback;
