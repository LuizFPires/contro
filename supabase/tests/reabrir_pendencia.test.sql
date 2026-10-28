-- Voltar para pendente um item concluído (pgTAP): volta para a fila sem
-- resolvido/vistoriado, mantendo ou tirando a foto do depois; o id da foto fica
-- no evento; só vale para pendência concluída.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(7);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000fc', 'equipe@reabrir.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000fc', 'Equipe Reabrir', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fc","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Reabrir', (select id from modelo where nome = 'Modelo 1 · CDC completo'));

-- Fixtures via superusuário: duas pendências concluídas com foto do depois.
set local role postgres;
insert into foto (id, obra_id, storage_path)
values ('00000000-0000-0000-0000-00000000f0f1', (select id from obra where nome = 'Obra Reabrir'), 'teste/depois1.jpg'),
       ('00000000-0000-0000-0000-00000000f0f2', (select id from obra where nome = 'Obra Reabrir'), 'teste/depois2.jpg');
insert into pendencia (obra_id, titulo, status, foto_depois_id, resolvida_em, vistoriada_em)
values ((select id from obra where nome = 'Obra Reabrir'), 'Mantém foto', 'fechada',
        '00000000-0000-0000-0000-00000000f0f1', now(), now()),
       ((select id from obra where nome = 'Obra Reabrir'), 'Tira foto', 'fechada',
        '00000000-0000-0000-0000-00000000f0f2', now(), now()),
       ((select id from obra where nome = 'Obra Reabrir'), 'Ainda aberta', 'aberta', null, null, null);

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fc","role":"authenticated"}';

select reabrir_pendencia((select id from pendencia where titulo = 'Mantém foto'), true);
select is((select status from pendencia where titulo = 'Mantém foto'), 'aberta', 'volta para a fila');
select is(
  (select foto_depois_id::text from pendencia where titulo = 'Mantém foto'),
  '00000000-0000-0000-0000-00000000f0f1', 'manter: a foto do depois fica'
);
select ok(
  (select vistoriada_em is null and resolvida_em is null from pendencia where titulo = 'Mantém foto'),
  'sem resolvido nem vistoriado'
);

select reabrir_pendencia((select id from pendencia where titulo = 'Tira foto'), false);
select ok(
  (select foto_depois_id is null from pendencia where titulo = 'Tira foto'),
  'tirar: a pendência fica sem foto do depois'
);
select is(
  (select e.dados ->> 'foto_depois_id' from pendencia_evento e join pendencia p on p.id = e.pendencia_id
    where p.titulo = 'Tira foto' and e.tipo = 'reaberta'),
  '00000000-0000-0000-0000-00000000f0f2', 'o id da foto fica no evento (nada se apaga)'
);
select throws_ok(
  format($$ select reabrir_pendencia(%L, true) $$, (select id from pendencia where titulo = 'Ainda aberta')),
  '42501', null, 'só pendência concluída volta para pendente'
);
reset role;

select ok(
  not has_function_privilege('anon', 'reabrir_pendencia(uuid, boolean, uuid)', 'execute'),
  'anônimo não reabre'
);

select * from finish();
rollback;
