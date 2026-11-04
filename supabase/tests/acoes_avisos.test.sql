-- Ações do dia (pgTAP): prazo da pendência em dias úteis pela criticidade, um
-- aviso "Ações de hoje" por pessoa da equipe e um "Equipe hoje" por gestor, com
-- os mesmos textos de core/acoes.ts; sem duplicar, fora da janela ou desligado.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(27);

-- Dias úteis (seg–sex, sem feriados).
select is(contro_add_du('2026-10-31', 2), '2026-11-04'::date, 'sábado vai para segunda antes de contar');
select is(contro_add_du('2026-11-02', 4), '2026-11-06'::date, 'segunda + 4 d.u. = sexta');

-- Prazo da pendência: dia local de São Paulo, depois os d.u. da criticidade.
select is((select contro_prazo_pendencia('alta', '2026-10-31 23:30-03'::timestamptz, c) from config_avisos c),
  '2026-11-04'::date, 'apontada no sábado à noite: conta a partir da segunda');
select is((select contro_prazo_pendencia('alta', '2026-11-02 01:00+00'::timestamptz, c) from config_avisos c),
  '2026-11-04'::date, '01h UTC de segunda é domingo 22h local: base segunda 02/11');
select is((select array[contro_prazo_pendencia('media', '2026-11-02 12:00-03', c),
                        contro_prazo_pendencia('baixa', '2026-11-02 12:00-03', c)] from config_avisos c),
  array['2026-11-06'::date, '2026-11-10'::date], 'média 4 e baixa 6 d.u. (padrão)');

-- Nome curto e textos (espelham nomeCurto, textoAvisoAcoes e textoAvisoEquipe).
select is(array[contro_nome_curto('João Vítor Silva'), contro_nome_curto('Maria da Silva'),
                contro_nome_curto('  Ana  '), contro_nome_curto('José dos Santos e Lima')],
  array['João V', 'Maria S', 'Ana', 'José S'], 'nome curto: primeiro nome + inicial sem partícula');
select is(array[contro_totais_acoes(3, 4), contro_totais_acoes(1, 0), contro_totais_acoes(0, 1),
                contro_totais_acoes(1, 1)],
  array['3 atrasadas e 4 vencem hoje', '1 atrasada', '1 vence hoje', '1 atrasada e 1 vence hoje'],
  'totais no singular e no plural');
select is(contro_texto_equipe(5, 9, '[
    {"nome":"João Vítor Silva","atrasadas":2,"hoje":3},
    {"nome":"Matheus Teixeira","atrasadas":1,"hoje":2},
    {"nome":"Thaina Costa","atrasadas":0,"hoje":4},
    {"nome":"Rafael Souza","atrasadas":1,"hoje":0}]'::jsonb),
  '5 atrasadas e 9 vencem hoje · João V 2+3, Matheus T 1+2, Thaina C 0+4 e mais 1.',
  'equipe: até 3 pessoas e "e mais N"');
select is(contro_texto_equipe(1, 0, '[]'::jsonb), '1 atrasada.', 'só "Sem responsável": apenas os totais');
select is(contro_texto_equipe(0, 0, '[]'::jsonb), null, 'nada a avisar: null');
select is(contro_texto_equipe(6, 6, jsonb_build_array(
    jsonb_build_object('nome', repeat('A', 28) || ' Souza', 'atrasadas', 2, 'hoje', 2),
    jsonb_build_object('nome', repeat('B', 28) || ' Souza', 'atrasadas', 2, 'hoje', 2),
    jsonb_build_object('nome', repeat('C', 28) || ' Souza', 'atrasadas', 2, 'hoje', 2))),
  '6 atrasadas e 6 vencem hoje · ' || repeat('A', 28) || ' S 2+2, ' || repeat('B', 28) || ' S 2+2 e mais 1.',
  'corta em 120 tirando a última pessoa');

-- Cenário: gestor G, equipe J (com login) e P (sem login).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'gestor@acoes.contro'),
  ('00000000-0000-0000-0000-0000000000c2', 'equipe@acoes.contro');
insert into pessoa (user_id, nome, perfil) values
  ('00000000-0000-0000-0000-0000000000c1', 'Gabriel Gestor', 'gestor'),
  ('00000000-0000-0000-0000-0000000000c2', 'Joana da Silva', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
insert into pessoa (nome, perfil) values ('Pedro dos Santos', 'equipe');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2031-01-06', 'Obra Ações', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
reset role;
-- Só esta obra conta (isola de qualquer dado de outro teste).
update obra set status = 'pausada' where nome <> 'Obra Ações';

-- Hoje = quarta 08/01/2031.
insert into tarefa (obra_id, texto, responsavel_id, prazo) values
  ((select id from obra where nome = 'Obra Ações'), 'Ligar para o vidraceiro',
   (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000c2'), '2031-01-07'),
  ((select id from obra where nome = 'Obra Ações'), 'Comprar rejunte',
   (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000c2'), '2031-01-08'),
  ((select id from obra where nome = 'Obra Ações'), 'Medir a vitrine',
   (select id from pessoa where nome = 'Pedro dos Santos' and user_id is null), '2031-01-08');
-- Alta apontada na sexta 03/01 → vence ter 07/01 (atrasada). Sem responsável
-- apontada hoje → vence sex 10/01 (não conta).
insert into pendencia (obra_id, titulo, criticidade, apontada_em, responsavel_id) values
  ((select id from obra where nome = 'Obra Ações'), 'Rodapé solto', 'alta', '2031-01-03 12:00-03',
   (select id from pessoa where user_id = '00000000-0000-0000-0000-0000000000c2')),
  ((select id from obra where nome = 'Obra Ações'), 'Tomada sem espelho', 'alta', '2031-01-08 07:00-03', null);

create temp view av as
  select a.tipo, a.dia, a.user_id, a.titulo, a.corpo, a.url from aviso_disparo a
  where a.tipo in ('acoes', 'acoes_equipe');

select gerar_avisos('2031-01-08 07:40-03');

select is((select count(*)::int from av where tipo = 'acoes' and user_id = '00000000-0000-0000-0000-0000000000c2'),
  1, 'J recebe um aviso de ações');
select is((select corpo from av where tipo = 'acoes' and user_id = '00000000-0000-0000-0000-0000000000c2'),
  '2 atrasadas e 1 vence hoje. Toque para ver a lista.', 'corpo de J igual a textoAvisoAcoes');
select is((select array[titulo, url] from av where tipo = 'acoes' and user_id = '00000000-0000-0000-0000-0000000000c2'),
  array['CONTRO · Ações de hoje', '/?ir=minhas'], 'título e destino de J');
select is((select array_agg(tipo) from av where user_id = '00000000-0000-0000-0000-0000000000c1'),
  array['acoes_equipe'], 'gestor recebe só o da equipe');
select ok((select corpo like '2 atrasadas e 2 vencem hoje · %' from av where tipo = 'acoes_equipe'),
  'totais da equipe no começo do corpo');
select is((select corpo from av where tipo = 'acoes_equipe'),
  '2 atrasadas e 2 vencem hoje · Joana S 2+1, Pedro S 0+1.', 'corpo do gestor igual a textoAvisoEquipe');
select is((select array[titulo, url] from av where tipo = 'acoes_equipe'),
  array['CONTRO · Equipe hoje', '/?ir=tarefas'], 'título e destino do gestor');
select is((select count(*)::int from av where dia = '2031-01-08'), 2, 'P (sem login) não recebe nada');

select gerar_avisos('2031-01-08 08:10-03');
select is((select count(*)::int from av where dia = '2031-01-08'), 2, 'cron repetido não duplica');

-- Quinta às 11h: fora da janela de 3 h depois das 07:30.
select gerar_avisos('2031-01-09 11:00-03');
select is((select count(*)::int from av where dia = '2031-01-09'), 0, 'fora da janela não cria');

-- Sexta com o aviso desligado.
update config_avisos set acoes_ativo = false where id;
select gerar_avisos('2031-01-10 07:40-03');
select is((select count(*)::int from av where dia = '2031-01-10'), 0, 'desligado não cria');

-- Tipos antigos saíram.
select throws_ok(
  $$insert into aviso_disparo (tipo, dia, user_id, titulo, corpo)
    values ('resumo', '2031-01-10', '00000000-0000-0000-0000-0000000000c1', 'x', 'x')$$,
  '23514', null, 'tipo resumo não existe mais');

-- RLS: equipe não altera; gestor altera; 0 d.u. é rejeitado.
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}';
update config_avisos set pend_alta_du = 9 where id;
reset role;
select is((select pend_alta_du::int from config_avisos), 2, 'equipe não altera os prazos');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}';
update config_avisos set pend_alta_du = 3 where id;
select throws_ok($$update config_avisos set pend_alta_du = 0 where id$$, '23514', null, 'zero d.u. é rejeitado');
reset role;
select is((select pend_alta_du::int from config_avisos), 3, 'gestor altera o prazo da alta');

select ok(
  not has_function_privilege('authenticated', 'contro_prazo_pendencia(text, timestamptz, config_avisos)', 'execute'),
  'app não chama os helpers do aviso'
);

select * from finish();
rollback;
