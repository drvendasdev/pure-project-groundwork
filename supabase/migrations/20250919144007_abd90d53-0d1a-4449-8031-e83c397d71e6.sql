-- Fix RLS policies for workspace_configurations to handle master users properly

-- Drop existing policies that are causing issues
DROP POLICY IF EXISTS "workspace_configurations_delete" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_insert" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_select" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_update" ON public.workspace_configurations;

-- Create new policies that properly handle master users and workspace members

-- SELECT policy: Allow master users and workspace members to view configurations
CREATE POLICY "workspace_configurations_select_policy" 
ON public.workspace_configurations 
FOR SELECT 
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);

-- INSERT policy: Allow master users and workspace admins to create configurations
CREATE POLICY "workspace_configurations_insert_policy" 
ON public.workspace_configurations 
FOR INSERT 
WITH CHECK (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- UPDATE policy: Allow master users and workspace admins to update configurations
CREATE POLICY "workspace_configurations_update_policy" 
ON public.workspace_configurations 
FOR UPDATE 
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
)
WITH CHECK (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- DELETE policy: Allow master users and workspace admins to delete configurations
CREATE POLICY "workspace_configurations_delete_policy" 
ON public.workspace_configurations 
FOR DELETE 
USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

-- Also update the UPSERT logic in the configurations component to handle conflicts better
-- by using ON CONFLICT clause