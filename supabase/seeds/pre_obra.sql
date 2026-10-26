-- Homologação: o pré-obra (Orçamento e Mapa de coleta) e as ligações de cada
-- mapa entram nos modelos do seed, que chegam depois das migrations.
select contro_garantir_pre_obra();
select contro_propor_libera_mapas();
