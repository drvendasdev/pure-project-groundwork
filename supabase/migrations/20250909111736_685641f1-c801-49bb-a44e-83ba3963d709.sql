-- Fix conversations access for user role

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

-- Also update messages policy to match
DROP POLICY IF EXISTS "messages_select" ON messages;
CREATE POLICY "messages_select" 
ON messages FOR SELECT 
USING (
  is_workspace_member(workspace_id, 'user'::system_profile) AND 
  EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = messages.conversation_id AND 
    (
      -- Masters and admins can see all messages in their workspaces
      is_workspace_member(c.workspace_id, 'admin'::system_profile) OR 
      -- Regular users can see messages from their assigned connections or default channel
      (
        c.connection_id IN (
          -- From assigned instances
          SELECT conn.id FROM connections conn 
          JOIN instance_user_assignments iua ON conn.instance_name = iua.instance 
          WHERE iua.user_id = current_system_user_id()
          UNION
          -- From default channel
          SELECT su.default_channel FROM system_users su 
          WHERE su.id = current_system_user_id() AND su.default_channel IS NOT NULL
        ) AND 
        -- Either unassigned or assigned to current user
        (c.assigned_user_id IS NULL OR c.assigned_user_id = current_system_user_id())
      )
    )
  )
);