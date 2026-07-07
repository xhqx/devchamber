import { describe, expect, test } from 'bun:test';

import { createEmptyKanbanBoard, createKanbanTask } from './schema';
import { moveKanbanTask, parseKanbanBoard, selectKanbanTasksByStatus, selectKanbanTasksForFile, selectKanbanTasksForSession, updateKanbanTask, upsertKanbanTasks } from './store';

describe('kanban schema/store', () => {
  test('normalizes task drafts into stable task records', () => {
    const task = createKanbanTask({
      title: '  Implement docs guard  ',
      description: '  Block commits until docs are handled  ',
      status: 'ready',
      priority: 'high',
      sessionIds: ['ses_2', 'ses_1', 'ses_1', ''],
      filePaths: ['./src\\App.tsx', 'README.md', 'src/App.tsx'],
      branch: '  fork/docs-guard  ',
      assignee: ' agent ',
      createdAt: '2026-07-06T10:00:00.000Z',
    });

    expect({
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      sessionIds: task.sessionIds,
      filePaths: task.filePaths,
      branch: task.branch,
      assignee: task.assignee,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    }).toEqual({
      title: 'Implement docs guard',
      description: 'Block commits until docs are handled',
      status: 'ready',
      priority: 'high',
      sessionIds: ['ses_1', 'ses_2'],
      filePaths: ['README.md', 'src/App.tsx'],
      branch: 'fork/docs-guard',
      assignee: 'agent',
      createdAt: '2026-07-06T10:00:00.000Z',
      updatedAt: '2026-07-06T10:00:00.000Z',
    });
    expect(task.id.startsWith('kt_')).toBe(true);
  });

  test('upserts, sorts, moves, and selects tasks deterministically', () => {
    const first = createKanbanTask({
      title: 'Write UI',
      status: 'in_progress',
      sessionIds: ['ses_1'],
      filePaths: ['src/App.tsx'],
      createdAt: '2026-07-06T10:00:00.000Z',
    });
    const replacement = { ...first, title: 'Write board UI', updatedAt: '2026-07-06T10:02:00.000Z' };
    const second = createKanbanTask({
      title: 'Create schema',
      status: 'ready',
      sessionIds: ['ses_2'],
      filePaths: ['src/lib/kanban/schema.ts'],
      createdAt: '2026-07-06T10:01:00.000Z',
    });

    const board = upsertKanbanTasks(createEmptyKanbanBoard('now'), [first, second, replacement], 'later');

    expect(board.updatedAt).toBe('later');
    expect(board.tasks.map((task) => task.title)).toEqual(['Create schema', 'Write board UI']);
    expect(selectKanbanTasksByStatus(board, 'ready')).toEqual([second]);
    expect(selectKanbanTasksForSession(board, 'ses_1')).toEqual([replacement]);
    expect(selectKanbanTasksForFile(board, 'src/lib/kanban/schema.ts')).toEqual([second]);

    const blocked = moveKanbanTask(board, second.id, 'blocked', 'blocked-at', 'Waiting on review');
    const blockedTask = selectKanbanTasksByStatus(blocked, 'blocked')[0];
    expect({
      id: blockedTask?.id,
      status: blockedTask?.status,
      blockedReason: blockedTask?.blockedReason,
      updatedAt: blockedTask?.updatedAt,
    }).toEqual({
      id: second.id,
      status: 'blocked',
      blockedReason: 'Waiting on review',
      updatedAt: 'blocked-at',
    });

    const unblocked = moveKanbanTask(blocked, second.id, 'review', 'review-at');
    expect(selectKanbanTasksByStatus(unblocked, 'review')[0]?.blockedReason).toBe(undefined);
  });

  test('parses unknown persisted board values safely', () => {
    expect(parseKanbanBoard(null, 'fallback')).toEqual(createEmptyKanbanBoard('fallback'));

    const parsed = parseKanbanBoard({
      version: 1,
      columns: [{ id: 'ready', title: ' Ready ', limit: 3 }, { id: 'unknown', title: 'Nope' }],
      tasks: [
        {
          id: 'task_1',
          title: '  Valid task  ',
          status: 'done',
          priority: 'urgent',
          sessionIds: ['ses_1', 123, 'ses_1'],
          filePaths: ['README.md', 'README.md'],
          createdAt: 'created',
          updatedAt: 'updated',
        },
        { id: 'task_2', title: 'Missing status' },
      ],
      updatedAt: 'saved',
    });

    expect(parsed).toEqual({
      version: 1,
      columns: [{ id: 'ready', title: 'Ready', limit: 3 }],
      tasks: [{
        id: 'task_1',
        title: 'Valid task',
        description: undefined,
        status: 'done',
        priority: undefined,
        sessionIds: ['ses_1'],
        filePaths: ['README.md'],
        branch: undefined,
        assignee: undefined,
        blockedReason: undefined,
        createdAt: 'created',
        updatedAt: 'updated',
      }],
      updatedAt: 'saved',
    });
  });

  test('updates task details without accepting blank titles', () => {
    const task = createKanbanTask({
      title: 'Original title',
      description: 'Original details',
      createdAt: '2026-07-06T16:00:00.000Z',
    });
    const board = upsertKanbanTasks(createEmptyKanbanBoard('initial'), [task], 'with-task');

    const updated = updateKanbanTask(board, task.id, {
      title: '  Edited title  ',
      description: '  Edited details  ',
      filePaths: ['./src\\Board.tsx', 'src/Board.tsx'],
    }, 'edited-at');

    expect({
      title: updated.tasks[0]?.title,
      description: updated.tasks[0]?.description,
      filePaths: updated.tasks[0]?.filePaths,
      updatedAt: updated.tasks[0]?.updatedAt,
    }).toEqual({
      title: 'Edited title',
      description: 'Edited details',
      filePaths: ['./src\\Board.tsx', 'src/Board.tsx'],
      updatedAt: 'edited-at',
    });

    const rejected = updateKanbanTask(updated, task.id, { title: '   ' }, 'rejected-at');
    expect(rejected.tasks[0]?.title).toBe('Edited title');
  });
});
