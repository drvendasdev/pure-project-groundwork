-- Fix RLS issues for user role access to conversations and messages

-- Enable RLS on missing views
ALTER TABLE workspaces_view ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_users_view ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for workspaces_view
CREATE POLICY "workspaces_view_select" 
ON workspaces_view FOR SELECT 
USING (
  is_current_user_master() OR 
  EXISTS (
    SELECT 1 FROM workspace_members wm 
    WHERE wm.workspace_id = workspaces_view.workspace_id 
    AND wm.user_id = current_system_user_id()
  )
);

-- Create RLS policies for system_users_view  
CREATE POLICY "system_users_view_select" 
ON system_users_view FOR SELECT 
USING (
  is_current_user_master() OR 
  is_current_user_admin() OR 
  id = current_system_user_id()
);

-- Update conversations policy to be more permissive for user role
DROP POLICY IF EXISTS "conversations_select" ON conversations;
CREATE POLICY "conversations_select" 
ON conversations FOR SELECT 
USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND 
  (
    -- Masters and admins can see all conversations in their workspaces
    is_workspace_member(workspace_id, 'admin'::system_profile) OR 
    -- Regular users can see conversations from their assigned connections or default channel
    (
      connection_id IN (
        -- From assigned instances
        SELECT c.id FROM connections c 
        JOIN instance_user_assignments iua ON c.instance_name = iua.instance 
        WHERE iua.user_id = current_system_user_id()
        UNION
        -- From default channel
        SELECT su.default_channel FROM system_users su 
        WHERE su.id = current_system_user_id() AND su.default_channel IS NOT NULL
      ) AND 
      -- Either unassigned or assigned to current user
      (assigned_user_id IS NULL OR assigned_user_id = current_system_user_id())
    )
  )
);