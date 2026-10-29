-- Ata colaborativa (pgTAP): respostas da pauta gravadas (troca e apaga), nada
-- muda com a reunião fechada; avanço e comentário da ação com evento, sem
-- passar de 99% e sem mexer em tarefa concluída. Requer o seed (Modelo 1).

begin;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'gestor@ata.contro'),
  ('00000000-0000-0000-0000-0000000000c2', 'equipe@ata.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000c1', 'Gestor Ata', 'gestor'),
  ('00000000-0000-0000-0000-0000000000c2', 'Equipe Ata', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-02-03', 'Obra Ata', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
select abrir_reuniao('2031-02-10');

create temp table ids as
  select (select id from reuniao where data = '2031-02-10') as reuniao_id,
         (select id from obra where nome = 'Obra Ata') as obra_id,
         (select id from obra_atividade where obra_id = (select id from obra where nome = 'Obra Ata')
            and pai_id is null order by ordem limit 1) as atv_id;
grant select on ids to authenticated;

-- Equipe responde "Começou"; depois troca para "Não começou".
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select responder_reuniao(reuniao_id, obra_id, 'passada_comecar', atv_id, 'comecou') from ids;
select is((select resposta from reuniao_resposta), 'comecou', 'resposta gravada');
select responder_reuniao(reuniao_id, obra_id, 'passada_comecar', atv_id, 'nao_comecou') from ids;
select is((select count(*)::int from reuniao_resposta), 1, 'trocar a resposta não duplica');
select is((select resposta from reuniao_resposta), 'nao_comecou', 'resposta trocada');

-- A mesma atividade pode ter outra resposta noutra seção.
select responder_reuniao(reuniao_id, obra_id, 'semana_concluir', atv_id, 'segue') from ids;
select is((select count(*)::int from reuniao_resposta), 2, 'seções diferentes, respostas diferentes');

-- Desfazer: resposta nula apaga.
select responder_reuniao(reuniao_id, obra_id, 'semana_concluir', atv_id, null) from ids;
select is((select count(*)::int from reuniao_resposta), 1, 'resposta nula apaga');

-- Resposta inválida é recusada.
select throws_ok(
  $$ select responder_reuniao(reuniao_id, obra_id, 'semana_concluir', atv_id, 'talvez') from ids $$,
  '23514', null, 'resposta fora da lista é recusada');

-- Reunião fechada: ninguém responde mais.
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select fechar_reuniao(reuniao_id, '[]'::jsonb) from ids;
select throws_ok(
  $$ select responder_reuniao(reuniao_id, obra_id, 'passada_comecar', atv_id, 'comecou') from ids $$,
  '42501', 'Reunião fechada', 'reunião fechada não muda');

-- Avanço da ação.
select salvar_tarefa(null, obra_id, 'Comprar tubos', null, '2031-02-11') from ids;
create temp table t as select id from tarefa where texto = 'Comprar tubos';
grant select on t to authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
select informar_avanco_tarefa((select id from t), 50, '  Pedido feito  ');
select is((select avanco_pct::int || ' ' || comentario from tarefa where id = (select id from t)),
  '50 Pedido feito', 'avanço e comentário gravados (comentário sem espaços)');
select is((select count(*)::int from tarefa_evento where tarefa_id = (select id from t) and tipo = 'avanco'), 1,
  'avanço vira evento');
select throws_ok($$ select informar_avanco_tarefa((select id from t), 100) $$, '22023', null,
  '100% é concluir, não avanço');
select concluir_tarefa((select id from t));
select throws_ok($$ select informar_avanco_tarefa((select id from t), 75) $$, '23505', null,
  'tarefa concluída não recebe avanço');

reset role;
select ok(not has_function_privilege('anon', 'responder_reuniao(uuid, uuid, text, uuid, text, uuid)', 'execute'),
  'anônimo não responde a pauta');

select * from finish();
rollback;
