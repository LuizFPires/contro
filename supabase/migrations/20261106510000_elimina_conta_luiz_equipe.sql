-- Elimina a conta antiga "Luiz" (Equipe de obra, já desativada em 03/11/2026),
-- a pedido do usuário em 06/11/2026. Exclusão lógica, como tudo no CONTRO:
-- some das listas (inclusive dos inativos em Pessoas e acessos). Sem efeito
-- fora de produção.
update pessoa
   set deleted_at = now()
 where id = '55a26d75-17df-46e0-945b-8bdcdb03b2ee'
   and nome = 'Luiz'
   and perfil = 'equipe'
   and not ativo
   and deleted_at is null;
