import React from 'react';

import { KanbanView } from './KanbanView';
import { useRuntimeAPIs } from '@/hooks/useRuntimeAPIs';
import { buildKanbanTaskBranchName } from '@/lib/kanban/branch';
import { collectKanbanAttachableChangedFiles } from '@/lib/kanban/changedFiles';
import { createEmptyKanbanBoard, type KanbanBoard, type KanbanTask, type KanbanTaskPatch, type KanbanTaskStatus } from '@/lib/kanban/schema';
import {
  createProjectKanbanTask,
  loadProjectKanbanBoard,
  moveProjectKanbanTask,
  updateProjectKanbanTask,
} from '@/lib/kanban/projectBoardController';
import { useProjectsStore } from '@/stores/useProjectsStore';
import { useSessionUIStore } from '@/sync/session-ui-store';

export const KanbanProjectView: React.FC = () => {
  const { files, git } = useRuntimeAPIs();
  const activeProject = useProjectsStore((state) => state.getActiveProject());
  const currentSessionId = useSessionUIStore((state) => state.currentSessionId);
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

  const handleAttachCurrentSession = React.useCallback(async (task: KanbanTask) => {
    if (!projectRoot) {
      setError('Select a project before attaching sessions.');
      return;
    }
    if (!currentSessionId) {
      setError('Open a session before attaching it to a board task.');
      return;
    }
    if (task.sessionIds.includes(currentSessionId)) {
      setError('Current session is already attached to this task.');
      return;
    }

    const sessionIds = Array.from(new Set([...task.sessionIds, currentSessionId])).sort();
    const previousBoard = board;
    const updatedAt = new Date().toISOString();
    setBoard({
      ...board,
      tasks: board.tasks.map((candidate) => (candidate.id === task.id ? { ...candidate, sessionIds, updatedAt } : candidate)),
      updatedAt,
    });
    setError(null);

    try {
      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch: { sessionIds }, now: updatedAt });
      setBoard(persistedBoard);
    } catch (attachError) {
      setBoard(previousBoard);
      setError(attachError instanceof Error ? attachError.message : 'Failed to attach current session.');
    }
  }, [board, currentSessionId, files, projectRoot]);

  const handleAttachChangedFiles = React.useCallback(async (task: KanbanTask) => {
    if (!projectRoot) {
      setError('Select a project before attaching changed files.');
      return;
    }

    const previousBoard = board;
    try {
      setError(null);
      const status = await git.getGitStatus(projectRoot, { mode: 'light' });
      const changedFiles = collectKanbanAttachableChangedFiles(status);
      if (changedFiles.length === 0) {
        setError('No changed files to attach.');
        return;
      }

      const filePaths = Array.from(new Set([...task.filePaths, ...changedFiles])).sort();
      const updatedAt = new Date().toISOString();
      setBoard({
        ...board,
        tasks: board.tasks.map((candidate) => (candidate.id === task.id ? { ...candidate, filePaths, updatedAt } : candidate)),
        updatedAt,
      });

      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch: { filePaths }, now: updatedAt });
      setBoard(persistedBoard);
    } catch (attachError) {
      setBoard(previousBoard);
      setError(attachError instanceof Error ? attachError.message : 'Failed to attach changed files.');
    }
  }, [board, files, git, projectRoot]);

  const handleCreateBranch = React.useCallback(async (task: KanbanTask) => {
    if (!projectRoot) {
      setError('Select a project before creating task branches.');
      return;
    }

    const suggestedBranch = buildKanbanTaskBranchName(task);
    const branch = window.prompt('Branch name', task.branch || suggestedBranch)?.trim();
    if (!branch) return;

    const previousBoard = board;
    const updatedAt = new Date().toISOString();
    setBoard({
      ...board,
      tasks: board.tasks.map((candidate) => (candidate.id === task.id ? { ...candidate, branch, updatedAt } : candidate)),
      updatedAt,
    });
    setError(null);

    try {
      await git.createBranch(projectRoot, branch);
      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch: { branch }, now: updatedAt });
      setBoard(persistedBoard);
    } catch (branchError) {
      setBoard(previousBoard);
      setError(branchError instanceof Error ? branchError.message : 'Failed to create task branch.');
    }
  }, [board, files, git, projectRoot]);

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
      currentSessionId={currentSessionId}
      onAttachCurrentSession={handleAttachCurrentSession}
      onAttachChangedFiles={handleAttachChangedFiles}
      onCreateBranch={handleCreateBranch}
      onMoveTask={handleMoveTask}
      onRefresh={refresh}
    />
  );
};
