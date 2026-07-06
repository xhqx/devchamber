import { describe, expect, test } from 'bun:test';

import type { FilesAPI } from '@/lib/api/types';
import { createChangeExplanation, type ChangeExplanation, type ChangeExplanationDraft } from './schema';
import {
  persistChangeNotesToProject,
  renderChangeNotesMarkdown,
  sanitizeChangeNotesSessionId,
  upsertChangeNotesIndexEntry,
} from './projectNotes';

const explanation = (overrides: Partial<ChangeExplanationDraft> = {}): ChangeExplanation => createChangeExplanation({
  sessionId: 'session/one',
  directory: '/repo',
  filePath: 'src/App.tsx',
  changeKind: 'modify',
  summary: 'Adds panel actions',
  why: 'Reviewers need durable notes.',
  risks: ['UI can become stale'],
  docs: { required: true, paths: ['docs/fork/ARCHITECTURE.md'] },
  range: { startLine: 10, endLine: 12 },
  createdAt: '2026-07-06T00:00:00.000Z',
  ...overrides,
} as ChangeExplanationDraft);

describe('project change notes', () => {
  test('sanitizes session ids for project-local filenames', () => {
    expect(sanitizeChangeNotesSessionId('abc/def:ghi')).toBe('abc-def-ghi');
    expect(sanitizeChangeNotesSessionId('   ')).toBe('session');
  });

  test('renders markdown grouped as an audit-friendly session note', () => {
    const markdown = renderChangeNotesMarkdown({
      sessionId: 'session/one',
      explanations: [explanation()],
      updatedAt: '2026-07-06T12:00:00.000Z',
    });

    expect(markdown).toContain('# Change notes for session/one');
    expect(markdown).toContain('- Explanations: 1');
    expect(markdown).toContain('### src/App.tsx:10-12');
    expect(markdown).toContain('- Summary: Adds panel actions');
    expect(markdown).toContain('  - `docs/fork/ARCHITECTURE.md`');
  });

  test('upserts index entries by session id and keeps newest first', () => {
    const index = upsertChangeNotesIndexEntry({
      version: 1,
      entries: [{ sessionId: 'old', path: 'old.md', explanationCount: 1, files: ['a'], updatedAt: '2026-07-05T00:00:00.000Z' }],
    }, { sessionId: 'new', path: 'new.md', explanationCount: 2, files: ['b'], updatedAt: '2026-07-06T00:00:00.000Z' });

    expect(index.entries.map((entry) => entry.sessionId)).toEqual(['new', 'old']);
  });

  test('persists markdown and index under .openchamber/change-notes', async () => {
    const writes = new Map<string, string>();
    const api: Pick<FilesAPI, 'createDirectory' | 'readFile' | 'writeFile'> = {
      createDirectory: async (path) => ({ success: true, path }),
      readFile: async (path) => ({ path, content: writes.get(path) ?? '' }),
      writeFile: async (path, content) => {
        writes.set(path, content);
        return { success: true, path };
      },
    };

    const result = await persistChangeNotesToProject({
      files: api,
      projectRoot: '/repo',
      sessionId: 'session/one',
      explanations: [explanation()],
      now: '2026-07-06T12:00:00.000Z',
    });

    expect(result.notesPath).toBe('/repo/.openchamber/change-notes/session-one.md');
    expect(writes.get(result.notesPath)).toContain('# Change notes for session/one');
    expect(writes.get('/repo/.openchamber/change-notes/index.json')).toContain('"sessionId": "session/one"');
  });
});
