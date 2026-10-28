-- Editar e apagar pendência (pgTAP): membro edita texto, local, criticidade e
-- atividade (com evento); apaga e restaura com exclusão lógica; recusa título
-- vazio e atividade de outra obra; anônimo não chama.
-- Requer o seed de homologação (Modelo 1 + unidades Contorno).

begin;
select plan(9);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000fb', 'equipe@pend.contro');
insert into pessoa (user_id, nome, perfil) values ('00000000-0000-0000-0000-0000000000fb', 'Equipe Pend', 'equipe')
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fb","role":"authenticated"}';
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Pend Edit', (select id from modelo where nome = 'Modelo 1 · CDC completo'));
select gerar_obra((select id from unidade where nome like 'Contorno%' order by nome limit 1),
  '2026-11-02', 'Obra Pend Outra', (select id from modelo where nome = 'Modelo 1 · CDC completo'));

-- Fixture via superusuário (pendencia não tem policy de escrita direta).
set local role postgres;
insert into pendencia (obra_id, titulo, local, criticidade)
values ((select id from obra where nome = 'Obra Pend Edit'), 'Rodapé solto', 'Sala 1', 'baixa');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-0000000000fb","role":"authenticated"}';

select lives_ok(
  format($$ select editar_pendencia(%L, 'Rodapé solto na parede', 'Sala 2', 'alta', %L) $$,
    (select id from pendencia where titulo = 'Rodapé solto'),
    (select a.id from obra_atividade a join obra o on o.id = a.obra_id
      where o.nome = 'Obra Pend Edit' and a.pai_id is null order by a.ordem limit 1)),
  'membro edita a pendência'
);
select is(
  (select local || ' · ' || criticidade from pendencia where titulo = 'Rodapé solto na parede'),
  'Sala 2 · alta', 'local e criticidade gravados'
);
select is(
  (select count(*)::int from pendencia_evento e join pendencia p on p.id = e.pendencia_id
    where p.titulo = 'Rodapé solto na parede' and e.tipo = 'editada'),
  1, 'evento de edição'
);
select throws_ok(
  format($$ select editar_pendencia(%L, '  ', null, 'media') $$,
    (select id from pendencia where titulo = 'Rodapé solto na parede')),
  '23514', null, 'título vazio é recusado'
);
select throws_ok(
  format($$ select editar_pendencia(%L, 'X', null, 'media', %L) $$,
    (select id from pendencia where titulo = 'Rodapé solto na parede'),
    (select a.id from obra_atividade a join obra o on o.id = a.obra_id
      where o.nome = 'Obra Pend Outra' and a.pai_id is null limit 1)),
  '23503', null, 'atividade de outra obra é recusada'
);

select excluir_pendencia((select id from pendencia where titulo = 'Rodapé solto na parede'));
select ok(
  (select deleted_at is not null from pendencia where titulo = 'Rodapé solto na parede'),
  'apagar é exclusão lógica'
);
select restaurar_pendencia((select id from pendencia where titulo = 'Rodapé solto na parede'));
select ok(
  (select deleted_at is null from pendencia where titulo = 'Rodapé solto na parede'),
  'Desfazer restaura'
);
select is(
  (select count(*)::int from pendencia_evento e join pendencia p on p.id = e.pendencia_id
    where p.titulo = 'Rodapé solto na parede' and e.tipo in ('excluida', 'restaurada')),
  2, 'eventos de apagar e restaurar'
);
reset role;

select ok(
  not has_function_privilege('anon', 'excluir_pendencia(uuid, uuid)', 'execute'),
  'anônimo não apaga'
);

select * from finish();
rollback;
