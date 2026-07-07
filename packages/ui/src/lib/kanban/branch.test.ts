import { describe, expect, test } from 'bun:test';

import { buildKanbanTaskBranchName, slugifyKanbanTaskBranchPart } from './branch';

describe('kanban task branch helpers', () => {
  test('slugifies branch parts into safe ref segments', () => {
    expect(slugifyKanbanTaskBranchPart('  refs/heads/Fix: OAuth Flow!  ')).toBe('fix-oauth-flow');
    expect(slugifyKanbanTaskBranchPart('---')).toBe('');
  });

  test('builds deterministic task branch names from title and id', () => {
    expect(buildKanbanTaskBranchName({ id: 'kt_abc123xyz', title: 'Attach changed files to board' })).toBe(
      'task/attach-changed-files-to-board-bc123xyz',
    );
  });

  test('falls back for empty titles and prefixes', () => {
    expect(buildKanbanTaskBranchName({ id: 'kt_1', title: '  ' }, '')).toBe('task-kt-1');
  });
});
