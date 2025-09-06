// Temporary utility to provide fallback workspace_id until workspace selection is fully implemented
export const getDefaultWorkspaceId = (): string => {
  // Return a default workspace ID - this will be replaced by actual workspace selection
  return '00000000-0000-0000-0000-000000000000';
};

export const getCurrentWorkspaceId = (): string => {
  // For now, return the default workspace ID
  // This will be replaced by reading from workspace context
  return getDefaultWorkspaceId();
};