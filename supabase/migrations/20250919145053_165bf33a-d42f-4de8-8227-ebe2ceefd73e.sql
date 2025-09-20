-- Drop the old policies and recreate clean ones for workspace_configurations
DROP POLICY IF EXISTS "workspace_configurations_delete_policy" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_insert_policy" ON public.workspace_configurations;  
DROP POLICY IF EXISTS "workspace_configurations_select_policy" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_update_policy" ON public.workspace_configurations;

DROP POLICY IF EXISTS "Users can view workspace configurations" ON public.workspace_configurations;
DROP POLICY IF EXISTS "Admins can manage workspace configurations" ON public.workspace_configurations;
DROP POLICY IF EXISTS "Masters can manage all workspace configurations" ON public.workspace_configurations;

-- Create comprehensive policies for workspace_configurations
CREATE POLICY "Allow users to view workspace configurations" ON public.workspace_configurations
FOR SELECT USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'user'::system_profile)
);

CREATE POLICY "Allow admins and masters to manage workspace configurations" ON public.workspace_configurations
FOR INSERT WITH CHECK (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "Allow admins and masters to update workspace configurations" ON public.workspace_configurations
FOR UPDATE USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "Allow admins and masters to delete workspace configurations" ON public.workspace_configurations
FOR DELETE USING (
  is_current_user_master() OR 
  is_workspace_member(workspace_id, 'admin'::system_profile)
);