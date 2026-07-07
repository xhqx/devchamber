import { describe, expect, test } from 'bun:test';

import type { FilesAPI } from '@/lib/api/types';
import { createEmptyKanbanBoard, createKanbanTask } from './schema';
import {
  KANBAN_PROJECT_BOARD_FILE,
  persistKanbanBoardToProject,
  readKanbanBoardFromProject,
  resolveKanbanBoardPath,
} from './projectBoardFile';
import { upsertKanbanTasks } from './store';

describe('project kanban board persistence', () => {
  test('resolves project-local board path and rejects missing roots', () => {
    expect(KANBAN_PROJECT_BOARD_FILE).toBe('.openchamber/tasks/board.json');
    expect(resolveKanbanBoardPath('/repo/')).toBe('/repo/.openchamber/tasks/board.json');
    expect(() => resolveKanbanBoardPath('   ')).toThrow('Project root is required');
  });

  test('reads missing or invalid board files as empty boards', async () => {
    const missingApi: Pick<FilesAPI, 'readFile'> = {
      readFile: async () => {
        throw new Error('not found');
      },
    };

    expect(await readKanbanBoardFromProject({
      files: missingApi,
      projectRoot: '/repo',
      fallbackUpdatedAt: 'fallback',
    })).toEqual(createEmptyKanbanBoard('fallback'));

    const invalidApi: Pick<FilesAPI, 'readFile'> = {
      readFile: async (path) => ({ path, content: '{ not-json' }),
    };

    expect(await readKanbanBoardFromProject({
      files: invalidApi,
      projectRoot: '/repo',
      fallbackUpdatedAt: 'invalid-fallback',
    })).toEqual(createEmptyKanbanBoard('invalid-fallback'));
  });

  test('persists and reads board JSON under .openchamber/tasks', async () => {
    const writes = new Map<string, string>();
    const createdDirectories: string[] = [];
    const api: Pick<FilesAPI, 'createDirectory' | 'readFile' | 'writeFile'> = {
      createDirectory: async (path) => {
        createdDirectories.push(path);
        return { success: true, path };
      },
      readFile: async (path) => ({ path, content: writes.get(path) ?? '' }),
      writeFile: async (path, content) => {
        writes.set(path, content);
        return { success: true, path };
      },
    };

    const task = createKanbanTask({
      title: 'Add board persistence',
      status: 'ready',
      sessionIds: ['ses_1'],
      filePaths: ['packages/ui/src/lib/kanban/projectBoardFile.ts'],
      createdAt: '2026-07-06T10:00:00.000Z',
    });
    const board = upsertKanbanTasks(createEmptyKanbanBoard('initial'), [task], 'with-task');

    const result = await persistKanbanBoardToProject({
      files: api,
      projectRoot: '/repo/',
      board,
      now: '2026-07-06T12:00:00.000Z',
    });

    expect(result).toEqual({
      boardPath: '/repo/.openchamber/tasks/board.json',
      taskCount: 1,
      updatedAt: '2026-07-06T12:00:00.000Z',
    });
    expect(createdDirectories).toEqual(['/repo/.openchamber/tasks']);
    expect(writes.get(result.boardPath)).toContain('"title": "Add board persistence"');

    const reloaded = await readKanbanBoardFromProject({
      files: api,
      projectRoot: '/repo',
      fallbackUpdatedAt: 'fallback',
    });

    expect(reloaded.updatedAt).toBe('2026-07-06T12:00:00.000Z');
    expect(reloaded.tasks.map((entry) => entry.title)).toEqual(['Add board persistence']);
  });
});
