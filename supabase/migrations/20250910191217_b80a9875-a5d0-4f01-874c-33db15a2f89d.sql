-- Add unique index on messages.external_id for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_external_id_unique 
ON public.messages (external_id) 
WHERE external_id IS NOT NULL;