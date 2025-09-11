-- Migration to ensure all existing conversations have a connection_id
-- This will link orphaned conversations to the first available connection in their workspace

-- First, let's see how many conversations are missing connection_id
SELECT 
  COUNT(*) as conversations_without_connection,
  workspace_id
FROM conversations 
WHERE connection_id IS NULL 
GROUP BY workspace_id;

-- Update conversations without connection_id to use the first available connection in their workspace
UPDATE conversations 
SET connection_id = (
  SELECT c.id 
  FROM connections c 
  WHERE c.workspace_id = conversations.workspace_id 
  ORDER BY c.created_at ASC 
  LIMIT 1
)
WHERE connection_id IS NULL 
AND EXISTS (
  SELECT 1 FROM connections c 
  WHERE c.workspace_id = conversations.workspace_id
);

-- Log the results
SELECT 
  COUNT(*) as conversations_still_without_connection,
  workspace_id
FROM conversations 
WHERE connection_id IS NULL 
GROUP BY workspace_id;