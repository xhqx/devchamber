import { describe, expect, test } from 'bun:test';

import type { FilesAPI } from '@/lib/api/types';
import { createEmptyKanbanBoard, createKanbanTask } from './schema';
import { resolveKanbanBoardPath } from './projectBoardFile';
import { loadProjectKanbanBoard, moveProjectKanbanTask } from './projectBoardController';
import { upsertKanbanTasks } from './store';

describe('project kanban board controller', () => {
  test('loads project board through files API', async () => {
    const board = upsertKanbanTasks(createEmptyKanbanBoard('initial'), [createKanbanTask({
      title: 'Wire kanban view',
      status: 'ready',
      createdAt: '2026-07-06T10:00:00.000Z',
    })], 'with-task');
    const path = resolveKanbanBoardPath('/repo');
    const files: Pick<FilesAPI, 'createDirectory' | 'readFile' | 'writeFile'> = {
      createDirectory: async (directoryPath) => ({ success: true, path: directoryPath }),
      readFile: async (filePath) => ({ path: filePath, content: JSON.stringify(board) }),
      writeFile: async (filePath) => ({ success: true, path: filePath }),
    };

    const loaded = await loadProjectKanbanBoard({ files, projectRoot: '/repo', fallbackUpdatedAt: 'fallback' });

    expect(path).toBe('/repo/.openchamber/tasks/board.json');
    expect(loaded.tasks.map((task) => task.title)).toEqual(['Wire kanban view']);
  });

  test('moves a task and persists the updated board', async () => {
    const task = createKanbanTask({
      title: 'Persist moved tasks',
      status: 'ready',
      createdAt: '2026-07-06T11:00:00.000Z',
    });
    const board = upsertKanbanTasks(createEmptyKanbanBoard('initial'), [task], 'with-task');
    const writes = new Map<string, string>();
    const files: Pick<FilesAPI, 'createDirectory' | 'readFile' | 'writeFile'> = {
      createDirectory: async (directoryPath) => ({ success: true, path: directoryPath }),
      readFile: async (filePath) => ({ path: filePath, content: writes.get(filePath) ?? JSON.stringify(board) }),
      writeFile: async (filePath, content) => {
        writes.set(filePath, content);
        return { success: true, path: filePath };
      },
    };

    const moved = await moveProjectKanbanTask({
      files,
      projectRoot: '/repo',
      taskId: task.id,
      status: 'in_progress',
      now: '2026-07-06T12:00:00.000Z',
    });

    expect(moved.tasks[0]?.status).toBe('in_progress');
    expect(moved.updatedAt).toBe('2026-07-06T12:00:00.000Z');
    expect(writes.get('/repo/.openchamber/tasks/board.json')).toContain('"status": "in_progress"');
  });
});
