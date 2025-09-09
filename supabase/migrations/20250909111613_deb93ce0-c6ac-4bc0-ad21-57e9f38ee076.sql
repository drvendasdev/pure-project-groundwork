-- Verify current state of user assignments and fix the conversation access logic

-- First, let's see what users exist and their assignments
SELECT 
  su.id, 
  su.name, 
  su.profile,
  su.default_channel,
  COUNT(iua.instance) as assigned_instances_count
FROM system_users su
LEFT JOIN instance_user_assignments iua ON su.id = iua.user_id
WHERE su.profile = 'user' AND su.status = 'active'
GROUP BY su.id, su.name, su.profile, su.default_channel;