-- Remover políticas restritivas existentes das tags
DROP POLICY IF EXISTS "tags_delete" ON public.tags;
DROP POLICY IF EXISTS "tags_insert" ON public.tags;
DROP POLICY IF EXISTS "tags_select" ON public.tags;
DROP POLICY IF EXISTS "tags_update" ON public.tags;

-- Criar políticas mais permissivas que funcionem com o sistema atual
CREATE POLICY "tags_select_all" 
ON public.tags 
FOR SELECT 
USING (
  -- Permitir para usuarios master ou membros do workspace
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);

CREATE POLICY "tags_insert_admin" 
ON public.tags 
FOR INSERT 
WITH CHECK (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "tags_update_admin" 
ON public.tags 
FOR UPDATE 
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "tags_delete_admin" 
ON public.tags 
FOR DELETE 
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);