import { describe, expect, test } from 'bun:test';

import type { FilesAPI } from '@/lib/api/types';
import { createEmptyKanbanBoard, createKanbanTask } from './schema';
import { resolveKanbanBoardPath } from './projectBoardFile';
import {
  createProjectKanbanTask,
  loadProjectKanbanBoard,
  moveProjectKanbanTask,
  updateProjectKanbanTask,
} from './projectBoardController';
import { upsertKanbanTasks } from './store';

const createMemoryFiles = (initialContent: string) => {
  const writes = new Map<string, string>();
  const files: Pick<FilesAPI, 'createDirectory' | 'readFile' | 'writeFile'> = {
    createDirectory: async (directoryPath) => ({ success: true, path: directoryPath }),
    readFile: async (filePath) => ({ path: filePath, content: writes.get(filePath) ?? initialContent }),
    writeFile: async (filePath, content) => {
      writes.set(filePath, content);
      return { success: true, path: filePath };
    },
  };
  return { files, writes };
};

describe('project kanban board controller', () => {
  test('loads project board through files API', async () => {
    const board = upsertKanbanTasks(createEmptyKanbanBoard('initial'), [createKanbanTask({
      title: 'Wire kanban view',
      status: 'ready',
      createdAt: '2026-07-06T10:00:00.000Z',
    })], 'with-task');
    const path = resolveKanbanBoardPath('/repo');
    const { files } = createMemoryFiles(JSON.stringify(board));

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
    const { files, writes } = createMemoryFiles(JSON.stringify(board));

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

  test('persists blocked reason when moving a task to blocked', async () => {
    const task = createKanbanTask({
      title: 'Wait for review',
      status: 'in_progress',
      createdAt: '2026-07-06T12:30:00.000Z',
    });
    const board = upsertKanbanTasks(createEmptyKanbanBoard('initial'), [task], 'with-task');
    const { files, writes } = createMemoryFiles(JSON.stringify(board));

    const blocked = await moveProjectKanbanTask({
      files,
      projectRoot: '/repo',
      taskId: task.id,
      status: 'blocked',
      blockedReason: '  Waiting on dependency  ',
      now: '2026-07-06T12:45:00.000Z',
    });

    expect({
      status: blocked.tasks[0]?.status,
      blockedReason: blocked.tasks[0]?.blockedReason,
    }).toEqual({
      status: 'blocked',
      blockedReason: 'Waiting on dependency',
    });
    expect(writes.get('/repo/.openchamber/tasks/board.json')).toContain('Waiting on dependency');
  });

  test('creates and persists a new task', async () => {
    const { files, writes } = createMemoryFiles(JSON.stringify(createEmptyKanbanBoard('initial')));

    const { board, task } = await createProjectKanbanTask({
      files,
      projectRoot: '/repo',
      draft: { title: 'Create task from board', description: 'Captured in the UI', status: 'ready' },
      now: '2026-07-06T13:00:00.000Z',
    });

    expect(task.id).toBe('kt_nlk3s9');
    expect({
      id: board.tasks[0]?.id,
      title: board.tasks[0]?.title,
      description: board.tasks[0]?.description,
      status: board.tasks[0]?.status,
    }).toEqual({
      id: task.id,
      title: 'Create task from board',
      description: 'Captured in the UI',
      status: 'ready',
    });
    expect(writes.get('/repo/.openchamber/tasks/board.json')).toContain('Create task from board');
  });

  test('updates task details and persists the board', async () => {
    const task = createKanbanTask({
      title: 'Rough title',
      status: 'backlog',
      createdAt: '2026-07-06T14:00:00.000Z',
    });
    const board = upsertKanbanTasks(createEmptyKanbanBoard('initial'), [task], 'with-task');
    const { files, writes } = createMemoryFiles(JSON.stringify(board));

    const updated = await updateProjectKanbanTask({
      files,
      projectRoot: '/repo',
      taskId: task.id,
      patch: { title: 'Edited title', description: 'Ready for an agent', priority: 'high', sessionIds: ['sess-b', 'sess-a', 'sess-a'] },
      now: '2026-07-06T15:00:00.000Z',
    });

    expect({
      id: updated.tasks[0]?.id,
      title: updated.tasks[0]?.title,
      description: updated.tasks[0]?.description,
      priority: updated.tasks[0]?.priority,
      sessionIds: updated.tasks[0]?.sessionIds,
      updatedAt: updated.tasks[0]?.updatedAt,
    }).toEqual({
      id: task.id,
      title: 'Edited title',
      description: 'Ready for an agent',
      priority: 'high',
      sessionIds: ['sess-a', 'sess-b'],
      updatedAt: '2026-07-06T15:00:00.000Z',
    });
    expect(writes.get('/repo/.openchamber/tasks/board.json')).toContain('Edited title');
  });
});
