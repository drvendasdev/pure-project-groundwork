-- Test RLS policy for user leopoldo by simulating the function call
-- First, simulate setting the user context
SET LOCAL "request.jwt.claims" = '{"system_user_id": "bc4e0b11-5ebb-4602-bcd0-d9e0f63f595c", "system_email": "leopoldo@gmail.com"}';

-- Test if the user can see conversations
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
WHERE c.workspace_id = '9379d213-8df0-47a8-a1b0-9d71e036fa5d'
ORDER BY c.last_activity_at DESC
LIMIT 5;