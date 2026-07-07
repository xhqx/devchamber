import React from 'react';

import { KanbanView } from './KanbanView';
import { useRuntimeAPIs } from '@/hooks/useRuntimeAPIs';
import { createEmptyKanbanBoard, type KanbanBoard, type KanbanTask, type KanbanTaskPatch, type KanbanTaskStatus } from '@/lib/kanban/schema';
import {
  createProjectKanbanTask,
  loadProjectKanbanBoard,
  moveProjectKanbanTask,
  updateProjectKanbanTask,
} from '@/lib/kanban/projectBoardController';
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

  const handleCreateTask = React.useCallback(async () => {
    if (!projectRoot) {
      setError('Select a project before creating board tasks.');
      return;
    }

    const title = window.prompt('Task title')?.trim();
    if (!title) return;
    const description = window.prompt('Task description (optional)')?.trim() || undefined;
    const updatedAt = new Date().toISOString();

    try {
      setError(null);
      const { board: persistedBoard } = await createProjectKanbanTask({
        files,
        projectRoot,
        draft: { title, description, status: 'backlog' },
        now: updatedAt,
      });
      setBoard(persistedBoard);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create task.');
    }
  }, [files, projectRoot]);

  const handleEditTask = React.useCallback(async (task: KanbanTask) => {
    if (!projectRoot) {
      setError('Select a project before editing board tasks.');
      return;
    }

    const title = window.prompt('Task title', task.title)?.trim();
    if (!title) return;
    const descriptionInput = window.prompt('Task description (optional)', task.description ?? '');
    if (descriptionInput === null) return;

    const patch: KanbanTaskPatch = {
      title,
      description: descriptionInput.trim() || undefined,
    };
    const previousBoard = board;
    const updatedAt = new Date().toISOString();
    setBoard({
      ...board,
      tasks: board.tasks.map((candidate) => (candidate.id === task.id ? { ...candidate, ...patch, updatedAt } : candidate)),
      updatedAt,
    });
    setError(null);

    try {
      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch, now: updatedAt });
      setBoard(persistedBoard);
    } catch (editError) {
      setBoard(previousBoard);
      setError(editError instanceof Error ? editError.message : 'Failed to edit task.');
    }
  }, [board, files, projectRoot]);

  const handleMoveTask = React.useCallback(async (taskId: string, status: KanbanTaskStatus) => {
    if (!projectRoot) {
      setError('Select a project before moving board tasks.');
      return;
    }

    const task = board.tasks.find((candidate) => candidate.id === taskId);
    const blockedReason = status === 'blocked'
      ? window.prompt('Blocked reason', task?.blockedReason ?? '')?.trim()
      : undefined;
    if (status === 'blocked' && !blockedReason) return;

    const previousBoard = board;
    const updatedAt = new Date().toISOString();
    const optimisticBoard: KanbanBoard = {
      ...board,
      tasks: board.tasks.map((candidate) => (
        candidate.id === taskId
          ? { ...candidate, status, updatedAt, blockedReason: status === 'blocked' ? blockedReason : undefined }
          : candidate
      )),
      updatedAt,
    };
    setBoard(optimisticBoard);
    setError(null);

    try {
      const persistedBoard = await moveProjectKanbanTask({ files, projectRoot, taskId, status, blockedReason, now: updatedAt });
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
      onCreateTask={handleCreateTask}
      onEditTask={handleEditTask}
      onMoveTask={handleMoveTask}
      onRefresh={refresh}
    />
  );
};
