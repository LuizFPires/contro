-- Obra deixa de exigir unidade: o nome da obra é suficiente (decisão do usuário).
-- A coluna continua (nullable) para não quebrar obras já criadas; a RPC gerar_obra
-- já só insere o valor (aceita null) e a tela de nova obra remove o seletor.
alter table obra alter column unidade_id drop not null;
