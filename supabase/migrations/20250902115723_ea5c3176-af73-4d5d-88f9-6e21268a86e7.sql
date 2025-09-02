-- Fix security warnings by adding missing RLS policies

-- Add RLS policies for profiles table
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    public.is_master() OR 
    id = auth.uid()
  );

CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Add RLS policies for user_roles table
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT USING (
    public.is_master() OR 
    user_id = auth.uid()
  );

CREATE POLICY "user_roles_insert" ON public.user_roles
  FOR INSERT WITH CHECK (public.is_master());

CREATE POLICY "user_roles_update" ON public.user_roles
  FOR UPDATE USING (public.is_master());

CREATE POLICY "user_roles_delete" ON public.user_roles
  FOR DELETE USING (public.is_master());