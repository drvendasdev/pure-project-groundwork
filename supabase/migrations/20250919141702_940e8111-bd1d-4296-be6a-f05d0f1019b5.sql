-- Fix RLS policies for workspace_configurations table

-- Drop existing policies
DROP POLICY IF EXISTS "workspace_configurations_delete" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_insert" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_select" ON public.workspace_configurations;
DROP POLICY IF EXISTS "workspace_configurations_update" ON public.workspace_configurations;

-- Create new policies that work properly
CREATE POLICY "workspace_configurations_select" 
ON public.workspace_configurations 
FOR SELECT 
USING (
  -- Allow selection if user is workspace member
  is_workspace_member(workspace_id, 'user'::system_profile)
);

CREATE POLICY "workspace_configurations_insert" 
ON public.workspace_configurations 
FOR INSERT 
WITH CHECK (
  -- Allow insert if user is admin or master in workspace
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "workspace_configurations_update" 
ON public.workspace_configurations 
FOR UPDATE 
USING (
  -- Allow update if user is admin or master in workspace
  is_workspace_member(workspace_id, 'admin'::system_profile)
);

CREATE POLICY "workspace_configurations_delete" 
ON public.workspace_configurations 
FOR DELETE 
USING (
  -- Allow delete if user is admin or master in workspace
  is_workspace_member(workspace_id, 'admin'::system_profile)
);