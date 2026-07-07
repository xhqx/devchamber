import { describe, expect, test } from 'bun:test';

import { collectKanbanAttachableChangedFiles } from './changedFiles';

describe('kanban changed files', () => {
  test('collects unique changed file paths and skips the board file', () => {
    const files = collectKanbanAttachableChangedFiles({
      files: [
        { path: 'packages/ui/src/App.tsx', index: 'M', working_dir: ' ' },
        { path: '.openchamber/tasks/board.json', index: 'M', working_dir: ' ' },
        { path: ' packages/ui/src/App.tsx ', index: ' ', working_dir: 'M' },
        { path: 'README.md', index: '?', working_dir: '?' },
        { path: '   ', index: 'M', working_dir: 'M' },
      ],
    });

    expect(files).toEqual(['README.md', 'packages/ui/src/App.tsx']);
  });

  test('returns an empty list for missing status', () => {
    expect(collectKanbanAttachableChangedFiles(null)).toEqual([]);
  });
});
