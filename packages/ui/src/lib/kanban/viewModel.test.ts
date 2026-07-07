import { describe, expect, test } from 'bun:test';

import type { KanbanBoard, KanbanTaskDraft } from './schema';
import { createEmptyKanbanBoard, createKanbanTask } from './schema';
import { buildKanbanBoardViewModel, getAdjacentKanbanStatus, sortKanbanTasksForColumn } from './viewModel';

const task = (title: string, overrides: Partial<Omit<KanbanTaskDraft, 'title'>> = {}) => {
  const draft: KanbanTaskDraft = {
    title,
    status: 'ready',
    createdAt: `2026-07-06T10:00:0${title.length}.000Z`,
    ...overrides,
  };
  return createKanbanTask(draft);
};

describe('kanban board view model', () => {
  test('sorts column tasks by priority, update recency, title, and id', () => {
    const low = task('Low', { priority: 'low', updatedAt: '2026-07-06T10:03:00.000Z' });
    const highOld = task('High old', { priority: 'high', updatedAt: '2026-07-06T10:00:00.000Z' });
    const highNew = task('High new', { priority: 'high', updatedAt: '2026-07-06T10:02:00.000Z' });
    const noPriority = task('No priority', { updatedAt: '2026-07-06T10:04:00.000Z' });

    expect(sortKanbanTasksForColumn([low, highOld, noPriority, highNew]).map((entry) => entry.title)).toEqual([
      'High new',
      'High old',
      'Low',
      'No priority',
    ]);
  });

  test('builds every configured column with task counts and limit warnings', () => {
    const readyA = task('Ready A', { priority: 'medium', updatedAt: '2026-07-06T10:01:00.000Z' });
    const readyB = task('Ready B', { priority: 'high', updatedAt: '2026-07-06T10:02:00.000Z' });
    const done = task('Done', { status: 'done' });
    const board: KanbanBoard = {
      ...createEmptyKanbanBoard('updated'),
      columns: [
        { id: 'ready', title: 'Ready', limit: 1 },
        { id: 'done', title: 'Done' },
        { id: 'blocked', title: 'Blocked' },
      ],
      tasks: [done, readyA, readyB],
    };

    const viewModel = buildKanbanBoardViewModel(board);

    expect(viewModel.taskCount).toBe(3);
    expect(viewModel.columns.map((column) => ({ id: column.id, taskCount: column.taskCount, isOverLimit: column.isOverLimit }))).toEqual([
      { id: 'ready', taskCount: 2, isOverLimit: true },
      { id: 'done', taskCount: 1, isOverLimit: false },
      { id: 'blocked', taskCount: 0, isOverLimit: false },
    ]);
    expect(viewModel.columns[0]?.tasks.map((entry) => entry.title)).toEqual(['Ready B', 'Ready A']);
  });

  test('finds adjacent statuses from configured column order', () => {
    const board: KanbanBoard = {
      ...createEmptyKanbanBoard('updated'),
      columns: [
        { id: 'backlog', title: 'Backlog' },
        { id: 'ready', title: 'Ready' },
        { id: 'review', title: 'Review' },
      ],
      tasks: [],
    };

    expect(getAdjacentKanbanStatus(board, 'ready', 'previous')).toBe('backlog');
    expect(getAdjacentKanbanStatus(board, 'ready', 'next')).toBe('review');
    expect(getAdjacentKanbanStatus(board, 'backlog', 'previous')).toBe(null);
    expect(getAdjacentKanbanStatus(board, 'done', 'next')).toBe(null);
  });
});
