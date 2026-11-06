begin;
select no_plan();

select is(public.normalizar_texto_providencia('Compra: Cimento e areia'), 'Comprar Cimento e areia', 'compra usa verbo');
select is(public.normalizar_texto_providencia('Locação: Betoneira'), 'Alugar Betoneira', 'locação usa verbo');
select is(public.normalizar_texto_providencia('Contratação: Pintor'), 'Contratar Pintor', 'contratação usa verbo');
select is(public.normalizar_texto_providencia('Comprar: Tinta: branca'), 'Comprar Tinta: branca', 'preserva dois-pontos da descrição');
select is(public.normalizar_texto_providencia('Destravar Compra: Cabos'), 'Comprar Cabos', 'converte atribuição antiga atrasada');
select is(public.normalizar_texto_providencia('  ALUGAR : Andaime  '), 'Alugar Andaime', 'aceita caixa e espaços antigos');
select is(public.normalizar_texto_providencia('Conferir compra: cabos'), 'Conferir compra: cabos', 'preserva instrução livre');
select is(public.normalizar_texto_providencia('Compra:   '), 'Compra:   ', 'não converte prefixo vazio');
select is(public.normalizar_texto_providencia('Comprar Cabos'), 'Comprar Cabos', 'idempotente');
select ok(not has_function_privilege('anon', 'public.normalizar_texto_providencia(text)', 'execute'), 'anon não executa helper');

insert into public.obra (id, nome, inicio, modelo_rotulo)
values ('00000000-0000-0000-0000-00000000d501', 'Teste vocabulário', '2026-11-02', 'Teste');

-- Simula registros anteriores à migration, inclusive feita e excluída.
alter table public.tarefa disable trigger tarefa_padronizar_texto;
insert into public.tarefa (id, obra_id, texto, prazo, status, deleted_at) values
  ('00000000-0000-0000-0000-00000000d511', '00000000-0000-0000-0000-00000000d501', 'Compra: Cimento', '2026-11-06', 'aberta', null),
  ('00000000-0000-0000-0000-00000000d512', '00000000-0000-0000-0000-00000000d501', 'Alugar: Betoneira', '2026-11-12', 'feita', null),
  ('00000000-0000-0000-0000-00000000d513', '00000000-0000-0000-0000-00000000d501', 'Contratação: Pintor', '2026-11-23', 'aberta', now());
alter table public.tarefa enable trigger tarefa_padronizar_texto;

\ir ../migrations/20261105210000_padronizar_textos_providencias.sql

select is((select texto from public.tarefa where id = '00000000-0000-0000-0000-00000000d511'), 'Comprar Cimento', 'migra aberta');
select is((select texto from public.tarefa where id = '00000000-0000-0000-0000-00000000d512'), 'Alugar Betoneira', 'migra feita');
select is((select texto from public.tarefa where id = '00000000-0000-0000-0000-00000000d513'), 'Contratar Pintor', 'migra excluída para futura restauração');
select is((select prazo::text || '|' || status || '|' || replanejamentos from public.tarefa where id = '00000000-0000-0000-0000-00000000d511'), '2026-11-06|aberta|0', 'preserva prazo, estado e replanejamentos');
select is((select count(*) from public.tarefa where obra_id = '00000000-0000-0000-0000-00000000d501'), 3::bigint, 'não cria nem une tarefas');
select is((select antes->>'texto' from public.tarefa_evento where tarefa_id = '00000000-0000-0000-0000-00000000d511'), 'Compra: Cimento', 'guarda título anterior na auditoria');
select is((select depois->>'texto' from public.tarefa_evento where tarefa_id = '00000000-0000-0000-0000-00000000d511'), 'Comprar Cimento', 'guarda título novo na auditoria');

\ir ../migrations/20261105210000_padronizar_textos_providencias.sql
select is((select count(*) from public.tarefa_evento where tarefa_id = '00000000-0000-0000-0000-00000000d511'), 1::bigint, 'reaplicar não duplica eventos');

insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000d521', 'vocabulário@teste.contro');
insert into public.pessoa (user_id, nome, perfil, ativo) values ('00000000-0000-0000-0000-00000000d521', 'Teste vocabulário', 'gestor', true)
on conflict (user_id) do update set perfil = 'gestor', ativo = true;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000d521","role":"authenticated"}';
select lives_ok($$select public.salvar_tarefa('00000000-0000-0000-0000-00000000d514', '00000000-0000-0000-0000-00000000d501', 'Comprar: Cabos', null, '2026-11-06')$$, 'RPC de membro continua funcionando');
select is((select texto from public.tarefa where id = '00000000-0000-0000-0000-00000000d514'), 'Comprar Cabos', 'normaliza envio de cliente antigo/offline');
update public.tarefa set texto = 'Alteração direta' where id = '00000000-0000-0000-0000-00000000d514';
select is((select texto from public.tarefa where id = '00000000-0000-0000-0000-00000000d514'), 'Comprar Cabos', 'RLS mantém escrita direta sem efeito');
select * from finish();
rollback;
