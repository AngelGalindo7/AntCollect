-- Widen content_type to fit the new values and add post_reference + trade_context.
-- VARCHAR(10) is too narrow for 'post_reference' (14) and 'trade_context' (13).
ALTER TABLE messages ALTER COLUMN content_type TYPE VARCHAR(20);

ALTER TABLE messages DROP CONSTRAINT messages_content_type_check;
ALTER TABLE messages ADD CONSTRAINT messages_content_type_check
    CHECK (content_type IN ('text', 'image', 'video', 'audio', 'file', 'post_reference', 'trade_context'));
