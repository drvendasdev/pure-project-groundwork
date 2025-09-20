-- Verificar se o usuário atual é realmente master
-- e temporariamente permitir criação para todos os usuários que conseguem visualizar
DROP POLICY IF EXISTS "tags_insert_admin" ON public.tags;

-- Criar política mais permissiva para inserção (temporária)
CREATE POLICY "tags_insert_permissive" 
ON public.tags 
FOR INSERT 
WITH CHECK (
  -- Permitir para qualquer usuário que pode ver tags do workspace
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- Função de debug para verificar o estado do usuário atual
CREATE OR REPLACE FUNCTION public.debug_user_permissions(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
  current_user_id uuid;
BEGIN
  current_user_id := current_system_user_id();
  
  SELECT jsonb_build_object(
    'current_user_id', current_user_id,
    'is_master', is_current_user_master(),
    'is_admin', is_current_user_admin(),
    'workspace_member_check', is_workspace_member(p_workspace_id, 'user'::system_profile),
    'workspace_admin_check', is_workspace_member(p_workspace_id, 'admin'::system_profile),
    'auth_uid', auth.uid(),
    'jwt_email', auth.jwt() ->> 'email'
  ) INTO result;
  
  RETURN result;
END;
$$;