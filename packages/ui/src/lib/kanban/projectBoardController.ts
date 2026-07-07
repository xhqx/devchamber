import type { KanbanBoard, KanbanTaskStatus } from './schema';
import type { KanbanProjectFilesAPI } from './projectBoardFile';
import { persistKanbanBoardToProject, readKanbanBoardFromProject } from './projectBoardFile';
import { moveKanbanTask } from './store';

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
