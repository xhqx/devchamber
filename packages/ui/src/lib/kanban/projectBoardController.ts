import {
  createKanbanTask,
  type KanbanBoard,
  type KanbanTask,
  type KanbanTaskDraft,
  type KanbanTaskPatch,
  type KanbanTaskStatus,
} from './schema';
import type { KanbanProjectFilesAPI } from './projectBoardFile';
import { persistKanbanBoardToProject, readKanbanBoardFromProject } from './projectBoardFile';
import { moveKanbanTask, updateKanbanTask, upsertKanbanTasks } from './store';

export type ProjectKanbanBoardControllerFilesAPI = KanbanProjectFilesAPI;

export type LoadProjectKanbanBoardRequest = {
  files: ProjectKanbanBoardControllerFilesAPI;
  projectRoot: string;
  fallbackUpdatedAt?: string;
};

export type MoveProjectKanbanTaskRequest = {
  files: ProjectKanbanBoardControllerFilesAPI;
  projectRoot: string;
  taskId: string;
  status: KanbanTaskStatus;
  blockedReason?: string;
  now?: string;
};

export type CreateProjectKanbanTaskRequest = {
  files: ProjectKanbanBoardControllerFilesAPI;
  projectRoot: string;
  draft: KanbanTaskDraft;
  now?: string;
};

export type UpdateProjectKanbanTaskRequest = {
  files: ProjectKanbanBoardControllerFilesAPI;
  projectRoot: string;
  taskId: string;
  patch: KanbanTaskPatch;
  now?: string;
};

export const loadProjectKanbanBoard = async ({
  files,
  projectRoot,
  fallbackUpdatedAt,
}: LoadProjectKanbanBoardRequest): Promise<KanbanBoard> => (
  readKanbanBoardFromProject({ files, projectRoot, fallbackUpdatedAt })
);

export const moveProjectKanbanTask = async ({
  files,
  projectRoot,
  taskId,
  status,
  blockedReason,
  now = new Date().toISOString(),
}: MoveProjectKanbanTaskRequest): Promise<KanbanBoard> => {
  const board = await readKanbanBoardFromProject({ files, projectRoot, fallbackUpdatedAt: now });
  const nextBoard = moveKanbanTask(board, taskId, status, now, blockedReason);
  await persistKanbanBoardToProject({ files, projectRoot, board: nextBoard, now });
  return nextBoard;
};

export const createProjectKanbanTask = async ({
  files,
  projectRoot,
  draft,
  now = new Date().toISOString(),
}: CreateProjectKanbanTaskRequest): Promise<{ board: KanbanBoard; task: KanbanTask }> => {
  const board = await readKanbanBoardFromProject({ files, projectRoot, fallbackUpdatedAt: now });
  const task = createKanbanTask({ ...draft, createdAt: draft.createdAt ?? now, updatedAt: draft.updatedAt ?? now });
  const nextBoard = upsertKanbanTasks(board, [task], now);
  await persistKanbanBoardToProject({ files, projectRoot, board: nextBoard, now });
  return { board: nextBoard, task };
};

export const updateProjectKanbanTask = async ({
  files,
  projectRoot,
  taskId,
  patch,
  now = new Date().toISOString(),
}: UpdateProjectKanbanTaskRequest): Promise<KanbanBoard> => {
  const board = await readKanbanBoardFromProject({ files, projectRoot, fallbackUpdatedAt: now });
  const nextBoard = updateKanbanTask(board, taskId, patch, now);
  await persistKanbanBoardToProject({ files, projectRoot, board: nextBoard, now });
  return nextBoard;
};
