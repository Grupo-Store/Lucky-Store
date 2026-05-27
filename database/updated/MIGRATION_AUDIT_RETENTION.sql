-- MIGRATION_AUDIT_RETENTION
-- Configura política de retenção de 6 meses para audit_logs.
--
-- Opção A (recomendada em produção): pg_cron — executa automaticamente todo dia às 02:00.
-- Requer extensão pg_cron instalada no servidor (disponível no Railway, Supabase, RDS).
--
--   CREATE EXTENSION IF NOT EXISTS pg_cron;
--
--   SELECT cron.schedule(
--     'purge-audit-logs',
--     '0 2 * * *',
--     $$DELETE FROM audit_logs WHERE changed_at < NOW() - INTERVAL '6 months'$$
--   );
--
-- Opção B (manual / sem pg_cron): execute esta query periodicamente via script de manutenção.

DELETE FROM audit_logs
WHERE changed_at < NOW() - INTERVAL '6 months';

-- Índice de suporte para a query de purge (se ainda não existir):
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON audit_logs (changed_at);
