-- Seed de HOMOLOGAÇÃO (nunca produção). Nomes fictícios só aqui.
-- Rodado por `pnpm db:reset`. Modelos 1, 2 e 3 entram no M1.

insert into sugestao (tipo, texto, usos) values
  ('prestador', 'Elétrica Silva', 3),
  ('prestador', 'Hidráulica Souza', 2),
  ('local', 'Recepção', 1)
on conflict (tipo, texto) do nothing;

-- pessoas são criadas após o cadastro no Auth; o primeiro gestor é promovido
-- manualmente (service role) no ambiente de homologação.
