import type { User, Workspace } from '@jobward/schemas';
import { createContext, useContext } from 'react';

interface WorkspaceContextValue {
  user: User;
  workspace: Workspace;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error('useWorkspace va usato dentro WorkspaceGate');
  return value;
}
