import React from 'react';

import { KanbanView } from './KanbanView';
import { useRuntimeAPIs } from '@/hooks/useRuntimeAPIs';
import { createEmptyKanbanBoard, type KanbanBoard, type KanbanTaskStatus } from '@/lib/kanban/schema';
import { loadProjectKanbanBoard, moveProjectKanbanTask } from '@/lib/kanban/projectBoardController';
import { useProjectsStore } from '@/stores/useProjectsStore';

export const KanbanProjectView: React.FC = () => {
  const { files } = useRuntimeAPIs();
  const activeProject = useProjectsStore((state) => state.getActiveProject());
  const [board, setBoard] = React.useState<KanbanBoard>(() => createEmptyKanbanBoard());
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const projectRoot = activeProject?.path ?? '';

  const refresh = React.useCallback(async () => {
    if (!projectRoot) {
      setBoard(createEmptyKanbanBoard());
      setError('Select a project to load its board.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextBoard = await loadProjectKanbanBoard({ files, projectRoot });
      setBoard(nextBoard);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load project board.');
    } finally {
      setIsLoading(false);
    }
  }, [files, projectRoot]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleMoveTask = React.useCallback(async (taskId: string, status: KanbanTaskStatus) => {
    if (!projectRoot) {
      setError('Select a project before moving board tasks.');
      return;
    }

    const previousBoard = board;
    const updatedAt = new Date().toISOString();
    const optimisticBoard: KanbanBoard = {
      ...board,
      tasks: board.tasks.map((task) => (
        task.id === taskId
          ? { ...task, status, updatedAt, blockedReason: status === 'blocked' ? task.blockedReason : undefined }
          : task
      )),
      updatedAt,
    };
    setBoard(optimisticBoard);
    setError(null);

    try {
      const persistedBoard = await moveProjectKanbanTask({ files, projectRoot, taskId, status, now: updatedAt });
      setBoard(persistedBoard);
    } catch (moveError) {
      setBoard(previousBoard);
      setError(moveError instanceof Error ? moveError.message : 'Failed to move task.');
    }
  }, [board, files, projectRoot]);

  return (
    <KanbanView
      board={board}
      isLoading={isLoading}
      error={error}
      onMoveTask={handleMoveTask}
      onRefresh={refresh}
    />
  );
};
