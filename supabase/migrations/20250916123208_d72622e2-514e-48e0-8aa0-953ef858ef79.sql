-- Configure Realtime for messages and conversations tables (only if not already configured)
DO $$
BEGIN
  -- Set replica identity for messages table
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE c.relname = 'messages' 
    AND n.nspname = 'public' 
    AND c.relreplident = 'f'
  ) THEN
    ALTER TABLE public.messages REPLICA IDENTITY FULL;
  END IF;

  -- Set replica identity for conversations table
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c 
    JOIN pg_namespace n ON n.oid = c.relnamespace 
    WHERE c.relname = 'conversations' 
    AND n.nspname = 'public' 
    AND c.relreplident = 'f'
  ) THEN
    ALTER TABLE public.conversations REPLICA IDENTITY FULL;
  END IF;
END $$;

-- Add conversations table to supabase_realtime publication if not already added
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
    AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;
END $$;

-- Function to ensure master users are in all workspaces
CREATE OR REPLACE FUNCTION public.ensure_master_users_in_all_workspaces()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert master users into all workspaces where they don't exist yet
  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_hidden)
  SELECT 
    w.id as workspace_id,
    su.id as user_id,
    'master'::system_profile as role,
    true as is_hidden
  FROM public.workspaces w
  CROSS JOIN public.system_users su
  WHERE su.profile = 'master'
    AND NOT EXISTS (
      SELECT 1 FROM public.workspace_members wm 
      WHERE wm.workspace_id = w.id 
        AND wm.user_id = su.id
    );
END;
$$;

-- Execute the function to add existing master users to all workspaces
SELECT public.ensure_master_users_in_all_workspaces();

-- Create trigger to automatically add master users to new workspaces
CREATE OR REPLACE FUNCTION public.add_master_users_to_new_workspace()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Add all master users to the new workspace
  INSERT INTO public.workspace_members (workspace_id, user_id, role, is_hidden)
  SELECT 
    NEW.id as workspace_id,
    su.id as user_id,
    'master'::system_profile as role,
    true as is_hidden
  FROM public.system_users su
  WHERE su.profile = 'master';
  
  RETURN NEW;
END;
$$;

-- Create trigger for new workspaces
DROP TRIGGER IF EXISTS trigger_add_master_users_to_new_workspace ON public.workspaces;
CREATE TRIGGER trigger_add_master_users_to_new_workspace
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.add_master_users_to_new_workspace();