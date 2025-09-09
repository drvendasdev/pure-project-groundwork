-- Check if there are conversations for leopoldo's connection
SELECT 
  c.id,
  c.status,
  c.unread_count,
  c.workspace_id,
  c.connection_id,
  c.assigned_user_id,
  ct.name as contact_name,
  ct.phone as contact_phone
FROM conversations c
JOIN contacts ct ON c.contact_id = ct.id
WHERE c.connection_id = 'faa3bae2-04ba-4626-a679-5c84a17f5d8c'
ORDER BY c.last_activity_at DESC
LIMIT 5;