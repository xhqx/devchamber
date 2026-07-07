import type { GitStatus } from '@/lib/api/types';

export const KANBAN_BOARD_FILE_PATH = '.openchamber/tasks/board.json';

export const collectKanbanAttachableChangedFiles = (status: Pick<GitStatus, 'files'> | null | undefined): string[] => {
  if (!status?.files?.length) return [];

  return Array.from(new Set(
    status.files
      .map((file) => file.path.trim())
      .filter((path) => path && path !== KANBAN_BOARD_FILE_PATH),
  )).sort();
};
