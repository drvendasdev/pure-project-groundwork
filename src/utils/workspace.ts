// DEPRECATED: This utility is deprecated after workspace restructuring
// Use actual workspace context or workspace_id from props instead

export const getDefaultWorkspaceId = (): string => {
  console.warn('getDefaultWorkspaceId is deprecated - use proper workspace context');
  return '00000000-0000-0000-0000-000000000000';
};

export const getCurrentWorkspaceId = (): string => {
  console.warn('getCurrentWorkspaceId is deprecated - use proper workspace context');
  return getDefaultWorkspaceId();
};