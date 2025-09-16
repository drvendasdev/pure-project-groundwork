-- Habilitar realtime para as tabelas necessárias
ALTER TABLE public.messages REPLICA IDENTITY FULL;
ALTER TABLE public.conversations REPLICA IDENTITY FULL;

-- Adicionar as tabelas à publicação do realtime
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE 
  public.messages,
  public.conversations,
  public.contacts,
  public.conversation_tags,
  public.tags;