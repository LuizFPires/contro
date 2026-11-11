-- Pré-avaliação de entrega (pgTAP): lista de 103 itens, só na Contorno, Não exige
-- foto e vira pendência, revisões herdam da anterior e a pendência é reaberta.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(22);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000a0e1', 'equipe@preaval.contro'),
  ('00000000-0000-0000-0000-00000000a0e2', 'gestor@preaval.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-00000000a0e1', 'Equipe Aval', 'equipe'),
  ('00000000-0000-0000-0000-00000000a0e2', 'Gestor Aval', 'gestor')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null, acesso_contorno = true;

select is((select count(*)::int from avaliacao_modelo_item where deleted_at is null), 103, 'lista nasce com 103 itens');
select is((select sum(pontos)::int from avaliacao_modelo_item where deleted_at is null), 1030, 'lista vale 1.030 pontos');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a0e1","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Aval', (select id from modelo where nome = 'Modelo 1 · CDC completo'));

set local role postgres;
insert into foto (id, obra_id, storage_path) values
  ('00000000-0000-0000-0000-00000000a0f1', (select id from obra where nome = 'Obra Aval'), 't/a.jpg'),
  ('00000000-0000-0000-0000-00000000a0f2', (select id from obra where nome = 'Obra Aval'), 't/b.jpg');
insert into obra (id, nome, inicio, modelo_rotulo, ambiente)
values ('00000000-0000-0000-0000-00000000a0a9', 'Obra Geral Aval', '2026-11-02', '-', 'geral');
create temp table ctx (rev uuid, i1 uuid, i2 uuid, i3 uuid) on commit drop;
grant all on ctx to authenticated;

set local role authenticated;
select throws_ok($$ select abrir_avaliacao_revisao('00000000-0000-0000-0000-00000000a0a9') $$,
  '42501', null, 'obra geral não tem pré-avaliação');
select throws_ok($$ insert into avaliacao_modelo_item (secao_ordem, secao, ordem, nome) values (1, 'X', 99, 'Y') $$,
  '42501', null, 'Equipe não edita a lista');
select throws_ok($$ insert into avaliacao_revisao (obra_id, numero) values ((select id from obra where nome = 'Obra Aval'), 9) $$,
  '42501', null, 'revisão não se grava direto');

insert into ctx (rev) select abrir_avaliacao_revisao((select id from obra where nome = 'Obra Aval'));
update ctx set
  i1 = (select id from avaliacao_item i where i.revisao_id = rev and codigo = '1.1'),
  i2 = (select id from avaliacao_item i where i.revisao_id = rev and codigo = '1.2'),
  i3 = (select id from avaliacao_item i where i.revisao_id = rev and codigo = '1.3');

select is((select count(*)::int from avaliacao_item where revisao_id = (select rev from ctx)), 103, '1ª revisão copia os 103 itens');
select throws_ok($$ select abrir_avaliacao_revisao((select id from obra where nome = 'Obra Aval')) $$,
  '23505', null, 'só uma revisão aberta por vez');
select throws_ok($$ select marcar_avaliacao_item((select i1 from ctx), 'nao_conforme') $$,
  '23514', null, 'Não não passa sem foto');
-- 10/11/2026: tocar Não grava na hora; a foto do antes entra depois.
select lives_ok($$ select avaliacao_nao_conforme(
    (select id from avaliacao_item where revisao_id = (select rev from ctx) and codigo = '1.4'),
    '00000000-0000-0000-0000-00000000a0b9') $$,
  'Não sem foto cria a pendência (foto do antes depois)');

select marcar_avaliacao_item((select i1 from ctx), 'conforme');
select avaliacao_nao_conforme((select i2 from ctx), '00000000-0000-0000-0000-00000000a0b1', null, null, 'alta',
  '00000000-0000-0000-0000-00000000a0f1');
select avaliacao_nao_conforme((select i3 from ctx), '00000000-0000-0000-0000-00000000a0b2', 'Tomada solta', null, 'baixa',
  '00000000-0000-0000-0000-00000000a0f2');

select is((select titulo || '|' || local || '|' || criticidade || '|' || status from pendencia where id = '00000000-0000-0000-0000-00000000a0b1'),
  'Iluminação|Recepção|alta|aberta', 'Não vira pendência no Check list');

select marcar_avaliacao_item((select i3 from ctx), 'conforme');
select ok((select deleted_at is not null from pendencia where id = '00000000-0000-0000-0000-00000000a0b2'),
  'tirar o Não retira a pendência');
select restaurar_nc_avaliacao((select i3 from ctx), '00000000-0000-0000-0000-00000000a0b2');
select ok((select deleted_at is null from pendencia where id = '00000000-0000-0000-0000-00000000a0b2'),
  'Desfazer devolve a pendência');

select throws_ok($$ select fechar_avaliacao_revisao((select rev from ctx)) $$,
  '23514', null, 'não fecha com item sem resposta');

set local role postgres;
update avaliacao_item set resultado = 'conforme' where revisao_id = (select rev from ctx) and resultado is null;
set local role authenticated;
select fechar_avaliacao_revisao((select rev from ctx));
select throws_ok($$ select marcar_avaliacao_item((select i1 from ctx), null) $$,
  '42501', null, 'revisão fechada não muda');

-- Entre as revisões, a pendência 1 foi resolvida; a 2 segue aberta.
select resolver_pendencia('00000000-0000-0000-0000-00000000a0b1', '00000000-0000-0000-0000-00000000a0f2');
create temp table ctx2 (rev uuid, i2 uuid, i3 uuid, i1 uuid) on commit drop;
insert into ctx2 (rev) select abrir_avaliacao_revisao((select id from obra where nome = 'Obra Aval'));
update ctx2 set
  i1 = (select id from avaliacao_item i where i.revisao_id = rev and codigo = '1.1'),
  i2 = (select id from avaliacao_item i where i.revisao_id = rev and codigo = '1.2'),
  i3 = (select id from avaliacao_item i where i.revisao_id = rev and codigo = '1.3');

select is((select numero from avaliacao_revisao where id = (select rev from ctx2)), 2, 'nova revisão é a de número 2');
select is((select resultado from avaliacao_item where id = (select i1 from ctx2)), 'conforme', 'conforme é mantido');
select ok((select resultado is null and reconfirmar from avaliacao_item where id = (select i2 from ctx2)), 'resolvido fica a reconfirmar');
select is((select resultado from avaliacao_item where id = (select i3 from ctx2)), 'nao_conforme', 'pendência aberta segue tirando ponto');

select avaliacao_nao_conforme((select i2 from ctx2), gen_random_uuid());
select is((select status from pendencia where id = '00000000-0000-0000-0000-00000000a0b1'), 'aberta', 'voltou a dar problema: reabre a mesma pendência');
select is((select pendencia_id from avaliacao_item where id = (select i2 from ctx2)), '00000000-0000-0000-0000-00000000a0b1'::uuid, 'item segue ligado à mesma pendência');

-- Pendência aberta com item sem resposta (reaberta no Check list): ao fechar, tira ponto.
set local role postgres;
update avaliacao_item set resultado = null, reconfirmar = true where id = (select i2 from ctx2);
update avaliacao_item set resultado = 'conforme' where revisao_id = (select rev from ctx2) and resultado is null and id <> (select i2 from ctx2);
set local role authenticated;
select fechar_avaliacao_revisao((select rev from ctx2));
select is((select resultado from avaliacao_item where id = (select i2 from ctx2)), 'nao_conforme', 'fechar respeita a pendência aberta');

set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000a0e2","role":"authenticated"}';
select lives_ok($$ insert into avaliacao_modelo_item (secao_ordem, secao, ordem, nome) values (11, 'Documentação e segurança', 99, 'ART extra') $$,
  'Gestor edita a lista');

select * from finish();
rollback;
