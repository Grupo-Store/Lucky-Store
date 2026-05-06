-- MIGRATION_PEDIDOS_V3
-- Cria sequence para numero_os no formato OS-001, OS-002, ...
-- Inicializa a partir do maior valor já existente para não reutilizar números.

DO $$
DECLARE
    max_num INTEGER;
BEGIN
    SELECT COALESCE(
        MAX(CAST(SUBSTRING(numero_os FROM 4) AS INTEGER)), 0
    )
    INTO max_num
    FROM pedidos
    WHERE numero_os ~ '^OS-[0-9]+$';

    EXECUTE format(
        'CREATE SEQUENCE IF NOT EXISTS pedido_os_seq START %s MINVALUE 1',
        max_num + 1
    );
END $$;
