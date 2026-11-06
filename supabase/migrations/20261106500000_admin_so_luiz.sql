-- Administrador de Obras gerais fica só com Luiz Felipe (decisão de 06/11/2026).
-- Rafael e Rodrigo passam a Coordenador em Obras gerais e continuam Gestores
-- da Contorno. Eles entram nas obras gerais pela tela Pessoas da obra, pelo
-- Administrador. Mesmo critério da marcação original (20261105200000).
update pessoa
   set administrador = false,
       papel_geral = 'coordenador'
 where administrador
   and perfil = 'gestor'
   and deleted_at is null
   and split_part(lower(btrim(nome)), ' ', 1) in ('rafael', 'rodrigo');
