import type { FilesAPI } from '@/lib/api/types';
import type { KanbanBoard } from './schema';
import { createEmptyKanbanBoard } from './schema';
import { parseKanbanBoard } from './store';

export const KANBAN_PROJECT_DIRECTORY = '.openchamber/tasks';
export const KANBAN_PROJECT_BOARD_FILE = `${KANBAN_PROJECT_DIRECTORY}/board.json`;

export type KanbanProjectFilesAPI = Pick<FilesAPI, 'createDirectory' | 'readFile' | 'writeFile'>;

export type ReadKanbanBoardRequest = {
  files: Pick<FilesAPI, 'readFile'>;
  projectRoot: string;
  fallbackUpdatedAt?: string;
};

export type PersistKanbanBoardRequest = {
  files: KanbanProjectFilesAPI;
  projectRoot: string;
  board: KanbanBoard;
  now?: string;
};

export type PersistKanbanBoardResult = {
  boardPath: string;
  taskCount: number;
  updatedAt: string;
};

const normalizeRoot = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '').trim();

export const resolveKanbanBoardPath = (projectRoot: string): string => {
  const root = normalizeRoot(projectRoot);
  if (!root) {
    throw new Error('Project root is required for kanban board persistence.');
  }
  return `${root}/${KANBAN_PROJECT_BOARD_FILE}`;
};

const resolveKanbanDirectoryPath = (projectRoot: string): string => {
  const root = normalizeRoot(projectRoot);
  if (!root) {
    throw new Error('Project root is required for kanban board persistence.');
  }
  return `${root}/${KANBAN_PROJECT_DIRECTORY}`;
};

export const readKanbanBoardFromProject = async ({
  files,
  projectRoot,
  fallbackUpdatedAt = new Date().toISOString(),
}: ReadKanbanBoardRequest): Promise<KanbanBoard> => {
  if (!files.readFile) {
    return createEmptyKanbanBoard(fallbackUpdatedAt);
  }

  const boardPath = resolveKanbanBoardPath(projectRoot);
  const rawBoard = await files.readFile(boardPath, { optional: true })
    .then((result) => result.content)
    .catch(() => '');

  if (!rawBoard.trim()) {
    return createEmptyKanbanBoard(fallbackUpdatedAt);
  }

  try {
    return parseKanbanBoard(JSON.parse(rawBoard), fallbackUpdatedAt);
  } catch {
    return createEmptyKanbanBoard(fallbackUpdatedAt);
  }
};

export const persistKanbanBoardToProject = async ({
  files,
  projectRoot,
  board,
  now = new Date().toISOString(),
}: PersistKanbanBoardRequest): Promise<PersistKanbanBoardResult> => {
  if (!files.writeFile) {
    throw new Error('Project file writes are not available in this runtime.');
  }

  const directoryPath = resolveKanbanDirectoryPath(projectRoot);
  const boardPath = resolveKanbanBoardPath(projectRoot);
  const boardToPersist = parseKanbanBoard({ ...board, updatedAt: now }, now);

  await files.createDirectory(directoryPath);
  await files.writeFile(boardPath, `${JSON.stringify(boardToPersist, null, 2)}\n`);

  return {
    boardPath,
    taskCount: boardToPersist.tasks.length,
    updatedAt: boardToPersist.updatedAt,
  };
};
