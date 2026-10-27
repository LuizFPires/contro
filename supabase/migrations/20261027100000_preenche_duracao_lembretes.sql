-- Preenche a duração dos lembretes que já existem (pedido do usuário, 27/10/2026),
-- com a mesma sugestão do assistente: contratação 5 du, compra 3 du, locação 1 du.
-- Só onde ainda está 0, nos modelos e nas obras (inclusive os já providenciados,
-- para a ficha mostrar o mesmo valor).
update modelo_providencia
set duracao_du = case tipo when 'contratacao' then 5 when 'compra' then 3 else 1 end
where duracao_du = 0;

update obra_providencia
set duracao_du = case tipo when 'contratacao' then 5 when 'compra' then 3 else 1 end
where duracao_du = 0;
