-- Adicionar política temporária de debug para tags
CREATE POLICY "debug_tags_select_all" 
ON public.tags 
FOR SELECT 
USING (true);

-- Verificar se current_system_user_id() está funcionando
CREATE OR REPLACE FUNCTION public.debug_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'auth_uid', auth.uid(),
    'jwt_email', auth.jwt() ->> 'email',
    'jwt_system_email', auth.jwt() ->> 'system_email', 
    'current_system_user_id', current_system_user_id(),
    'is_current_user_master', is_current_user_master()
  ) INTO result;
  
  RETURN result;
END;
$$;