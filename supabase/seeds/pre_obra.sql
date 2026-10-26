-- Homologação: as fases do pré-obra (Orçamento e Mapa de coleta) entram nos
-- modelos do seed, que chegam depois das migrations. Mesma função da
-- migration 20261026150000_pre_obra.
select contro_garantir_pre_obra();
