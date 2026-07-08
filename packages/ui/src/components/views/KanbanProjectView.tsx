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
  const [syncMessage, setSyncMessage] = React.useState<string | null>(null);
  const [pendingTaskIds, setPendingTaskIds] = React.useState<Set<string>>(() => new Set());

  const projectRoot = activeProject?.path ?? '';

  const markTaskPending = React.useCallback((taskId: string, isPending: boolean) => {
    setPendingTaskIds((current) => {
      const next = new Set(current);
      if (isPending) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }, []);

  const setSavedMessage = React.useCallback((action: string, updatedAt: string) => {
    setSyncMessage(`${action} · saved ${new Date(updatedAt).toLocaleTimeString()}`);
  }, []);

  const refresh = React.useCallback(async () => {
    if (!projectRoot) {
      setBoard(createEmptyKanbanBoard());
      setError('Select a project to load its board.');
      setSyncMessage(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setSyncMessage('Loading board…');
    try {
      const nextBoard = await loadProjectKanbanBoard({ files, projectRoot });
      setBoard(nextBoard);
      setSavedMessage('Board synced', nextBoard.updatedAt);
    } catch (refreshError) {
      setSyncMessage(null);
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to load project board.');
    } finally {
      setIsLoading(false);
    }
  }, [files, projectRoot, setSavedMessage]);

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
      setSyncMessage('Creating task…');
      const { board: persistedBoard } = await createProjectKanbanTask({
        files,
        projectRoot,
        draft: { title, description, status: 'backlog' },
        now: updatedAt,
      });
      setBoard(persistedBoard);
      setSavedMessage('Task created', persistedBoard.updatedAt);
    } catch (createError) {
      setSyncMessage(null);
      setError(createError instanceof Error ? createError.message : 'Failed to create task.');
    }
  }, [files, projectRoot, setSavedMessage]);

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
    setSyncMessage(`Saving “${title}”…`);
    markTaskPending(task.id, true);

    try {
      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch, now: updatedAt });
      setBoard(persistedBoard);
      setSavedMessage('Task saved', persistedBoard.updatedAt);
    } catch (editError) {
      setBoard(previousBoard);
      setSyncMessage(null);
      setError(editError instanceof Error ? editError.message : 'Failed to edit task.');
    } finally {
      markTaskPending(task.id, false);
    }
  }, [board, files, markTaskPending, projectRoot, setSavedMessage]);

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
    setSyncMessage('Attaching session…');
    markTaskPending(task.id, true);

    try {
      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch: { sessionIds }, now: updatedAt });
      setBoard(persistedBoard);
      setSavedMessage('Session attached', persistedBoard.updatedAt);
    } catch (attachError) {
      setBoard(previousBoard);
      setSyncMessage(null);
      setError(attachError instanceof Error ? attachError.message : 'Failed to attach current session.');
    } finally {
      markTaskPending(task.id, false);
    }
  }, [board, currentSessionId, files, markTaskPending, projectRoot, setSavedMessage]);

  const handleAttachChangedFiles = React.useCallback(async (task: KanbanTask) => {
    if (!projectRoot) {
      setError('Select a project before attaching changed files.');
      return;
    }

    const previousBoard = board;
    markTaskPending(task.id, true);
    try {
      setError(null);
      setSyncMessage('Collecting changed files…');
      const status = await git.getGitStatus(projectRoot, { mode: 'light' });
      const changedFiles = collectKanbanAttachableChangedFiles(status);
      if (changedFiles.length === 0) {
        setSyncMessage(null);
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

      setSyncMessage(`Attaching ${changedFiles.length} changed file${changedFiles.length === 1 ? '' : 's'}…`);
      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch: { filePaths }, now: updatedAt });
      setBoard(persistedBoard);
      setSavedMessage('Changed files attached', persistedBoard.updatedAt);
    } catch (attachError) {
      setBoard(previousBoard);
      setSyncMessage(null);
      setError(attachError instanceof Error ? attachError.message : 'Failed to attach changed files.');
    } finally {
      markTaskPending(task.id, false);
    }
  }, [board, files, git, markTaskPending, projectRoot, setSavedMessage]);

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
    setSyncMessage(`Creating branch ${branch}…`);
    markTaskPending(task.id, true);

    try {
      await git.createBranch(projectRoot, branch);
      const persistedBoard = await updateProjectKanbanTask({ files, projectRoot, taskId: task.id, patch: { branch }, now: updatedAt });
      setBoard(persistedBoard);
      setSavedMessage('Branch created', persistedBoard.updatedAt);
    } catch (branchError) {
      setBoard(previousBoard);
      setSyncMessage(null);
      setError(branchError instanceof Error ? branchError.message : 'Failed to create task branch.');
    } finally {
      markTaskPending(task.id, false);
    }
  }, [board, files, git, markTaskPending, projectRoot, setSavedMessage]);

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
    setSyncMessage(`Moving “${task?.title ?? 'task'}” to ${status}…`);
    markTaskPending(taskId, true);

    try {
      const persistedBoard = await moveProjectKanbanTask({ files, projectRoot, taskId, status, blockedReason, now: updatedAt });
      setBoard(persistedBoard);
      setSavedMessage('Task moved', persistedBoard.updatedAt);
    } catch (moveError) {
      setBoard(previousBoard);
      setSyncMessage(null);
      setError(moveError instanceof Error ? moveError.message : 'Failed to move task.');
    } finally {
      markTaskPending(taskId, false);
    }
  }, [board, files, markTaskPending, projectRoot, setSavedMessage]);

  return (
    <KanbanView
      board={board}
      isLoading={isLoading}
      error={error}
      syncMessage={syncMessage}
      pendingTaskIds={pendingTaskIds}
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
