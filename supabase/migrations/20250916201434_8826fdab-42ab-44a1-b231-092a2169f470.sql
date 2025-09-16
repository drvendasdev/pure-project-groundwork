-- Fase 2: Habilitar Realtime para tables essenciais
-- Configurar REPLICA IDENTITY FULL para capturar mudanças completas
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Verificar se as tabelas foram adicionadas
-- SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename IN ('messages', 'conversations');

-- Criar índice otimizado para queries de mensagens (se não existir)
CREATE INDEX IF NOT EXISTS idx_messages_workspace_conversation_created 
ON public.messages (workspace_id, conversation_id, created_at, id);

-- Criar índice para deduplicação por external_id  
CREATE INDEX IF NOT EXISTS idx_messages_external_id_workspace
ON public.messages (external_id, workspace_id) WHERE external_id IS NOT NULL;