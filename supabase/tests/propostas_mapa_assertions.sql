begin;
select plan(1);
-- Dados do próprio teste (o CI começa só com o seed: modelos e unidades).
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000f141', 'fx-gestor-141@contro.test'),
  ('00000000-0000-0000-0000-00000000f142', 'fx-equipe-141@contro.test');
insert into pessoa (user_id, nome, perfil, ativo) values
  ('00000000-0000-0000-0000-00000000f141', 'Fixture Gestor 141', 'gestor', true),
  ('00000000-0000-0000-0000-00000000f142', 'Fixture Equipe 141', 'equipe', true)
  on conflict (user_id) do update set nome = excluded.nome, perfil = excluded.perfil, ativo = true, deleted_at = null;
set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-0000-0000-00000000f141","role":"authenticated"}';
select gerar_obra((select id from unidade order by nome limit 1), current_date, 'Obra Fixture 141',
  (select id from modelo where nome = 'Modelo 1 · CDC completo'));
reset role;
set local request.jwt.claims = '';

do $$
declare u uuid; m public.obra_atividade%rowtype; p uuid := gen_random_uuid(); q uuid := gen_random_uuid(); canon text;
begin
 select user_id into u from public.pessoa where ativo and deleted_at is null limit 1;
 select * into m from public.obra_atividade where mapa_antecedencia_du is not null and deleted_at is null limit 1;
 if u is null or m.id is null then raise exception 'Faltam fixtures'; end if;
 perform set_config('request.jwt.claim.sub', u::text, true);
 canon := public.contro_nome_prestador('QA João Proposta 7349');
 if public.contro_nome_prestador(' qa joao   proposta 7349 ') <> canon then raise exception 'Normalização falhou'; end if;
 insert into public.mapa_proposta(id, obra_id, atividade_id, contratado, descricao) values
 (p,m.obra_id,m.id,'QA Joao Proposta 7349','Proposta teste'),
 (q,m.obra_id,m.id,'QA outro fornecedor 7349','Outra proposta');
 if (select contratado from public.mapa_proposta where id=p) <> canon then raise exception 'Cadastro não normalizado'; end if;
 if (select recebida from public.mapa_proposta where id=p) then raise exception 'Provável contratado encerrou a pendência'; end if;
 update public.obra_atividade set prestador='QA Joao Proposta 7349' where id=m.id;
 if exists(select 1 from public.mapa_proposta where id in (p,q) and (not recebida or not solucionada_por_contratacao)) then raise exception 'Baixa automática falhou'; end if;
 if (select prestador from public.obra_atividade where id=m.id) <> canon then raise exception 'Prestador não normalizado'; end if;
 begin
   insert into public.mapa_proposta(obra_id,atividade_id,contratado,descricao)
   select obra_id,id,'QA inválido','Inválida' from public.obra_atividade where mapa_antecedencia_du is null and deleted_at is null limit 1;
   raise exception 'VALIDACAO_NAO_EXECUTADA';
 exception when others then
   if sqlerrm = 'VALIDACAO_NAO_EXECUTADA' then raise; end if;
 end;
 perform set_config('request.jwt.claim.sub', '', true);
 begin
   perform public.contro_nome_prestador('Sem autorização');
   raise exception 'MEMBRO_NAO_VALIDADO';
 exception when insufficient_privilege then null;
 end;
end $$;

select pass('Normalização, propostas e baixa automática');
select * from finish();
rollback;