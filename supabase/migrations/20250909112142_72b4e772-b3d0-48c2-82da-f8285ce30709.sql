-- Check user leopoldo's workspace membership and default channel
SELECT 
  su.id, 
  su.name, 
  su.email, 
  su.profile,
  su.default_channel,
  wm.workspace_id,
  wm.role as workspace_role,
  c.instance_name,
  c.status as connection_status
FROM system_users su
LEFT JOIN workspace_members wm ON su.id = wm.user_id
LEFT JOIN connections c ON su.default_channel = c.id
WHERE su.email = 'leopoldo@gmail.com';