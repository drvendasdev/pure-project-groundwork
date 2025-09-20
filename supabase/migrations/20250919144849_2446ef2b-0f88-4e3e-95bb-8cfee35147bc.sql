-- Enable RLS on remaining tables and create policies for workspace_configurations
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connection_secrets ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for user_roles
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (user_id = current_system_user_id());

CREATE POLICY "Masters can view all roles" ON public.user_roles
FOR SELECT USING (is_current_user_master());

-- Create RLS policies for connection_secrets  
CREATE POLICY "Users can view connection secrets in their workspace" ON public.connection_secrets
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.connections c 
    WHERE c.id = connection_secrets.connection_id 
    AND is_workspace_member(c.workspace_id, 'user'::system_profile)
  )
);

CREATE POLICY "Admins can manage connection secrets in their workspace" ON public.connection_secrets
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.connections c 
    WHERE c.id = connection_secrets.connection_id 
    AND is_workspace_member(c.workspace_id, 'admin'::system_profile)
  )
);

-- Create comprehensive policies for workspace_configurations  
CREATE POLICY "Users can view workspace configurations" ON public.workspace_configurations
FOR SELECT USING (is_workspace_member(workspace_id, 'user'::system_profile));

CREATE POLICY "Admins can manage workspace configurations" ON public.workspace_configurations
FOR ALL USING (is_workspace_member(workspace_id, 'admin'::system_profile));

CREATE POLICY "Masters can manage all workspace configurations" ON public.workspace_configurations
FOR ALL USING (is_current_user_master());