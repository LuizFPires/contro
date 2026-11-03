-- Todos os lembretes podem ser excluídos, preservando dados para Desfazer.
alter table public.obra_providencia add column deleted_at timestamptz;
-- Exclusão física deixa de ser usada, inclusive para lembretes manuais.
drop policy if exists obra_providencia_del on public.obra_providencia;
