-- ============================================================
-- V2__remove_indexes.sql
-- Removes indexes created in V1__init_schema.sql.
-- Indexes can be re-introduced in a future migration once
-- query performance profiling justifies them.
-- ============================================================

DROP INDEX IF EXISTS idx_messages_conversation_message;
DROP INDEX IF EXISTS idx_messages_client_message_id;
DROP INDEX IF EXISTS idx_participants_user_id;
DROP INDEX IF EXISTS idx_message_statuses_message_id;

