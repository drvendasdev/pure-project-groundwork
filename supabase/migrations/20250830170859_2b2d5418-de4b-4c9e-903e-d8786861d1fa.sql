-- Create function to get system user by email and password
CREATE OR REPLACE FUNCTION public.get_system_user(user_email TEXT, user_password TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  email TEXT,
  profile TEXT,
  status TEXT,
  avatar TEXT,
  cargo_id UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    su.id,
    su.name,
    su.email,
    su.profile,
    su.status,
    su.avatar,
    su.cargo_id,
    su.created_at,
    su.updated_at
  FROM public.system_users su
  WHERE su.email = user_email AND su.senha = user_password;
END;
$$;

-- Create function to block system user
CREATE OR REPLACE FUNCTION public.block_system_user(user_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.system_users 
  SET status = 'inactive', updated_at = NOW()
  WHERE email = user_email;
END;
$$;