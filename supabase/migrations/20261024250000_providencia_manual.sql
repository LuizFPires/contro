-- M3 · Correção do review: só dá para remover lembrete ADICIONADO manualmente.
-- As providências copiadas do modelo (via gerar_obra) não podem ser apagadas
-- (senão um membro removeria um bloqueio para liberar a atividade sem providenciar).
alter table obra_providencia add column manual boolean not null default false;

drop policy if exists obra_providencia_del on obra_providencia;
create policy obra_providencia_del on obra_providencia
  for delete to authenticated using (obdc_e_membro() and manual);
