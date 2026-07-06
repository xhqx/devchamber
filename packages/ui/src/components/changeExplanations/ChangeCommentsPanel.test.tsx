import { describe, expect, test } from 'bun:test';

import { getChangeCommentStatuses, groupChangeCommentsByFile } from './changeCommentGroups';
import { createChangeExplanation, type ChangeExplanationDraft } from '@/lib/changeExplanations/schema';

const baseDraft: ChangeExplanationDraft = {
  sessionId: 'ses_1',
  directory: '/repo',
  filePath: 'src/index.ts',
  changeKind: 'modify',
  summary: 'Changed implementation',
  why: 'Keeps the feature working',
  risks: [],
  docs: { required: true, paths: ['docs/feature.md'] },
  createdAt: '2026-07-06T00:00:00.000Z',
};

const baseExplanation = (overrides: Partial<ChangeExplanationDraft> = {}) => createChangeExplanation({
  ...baseDraft,
  ...overrides,
});

describe('getChangeCommentStatuses', () => {
  test('marks explanations with docs and no risks as accepted/docs updated', () => {
    expect(getChangeCommentStatuses(baseExplanation())).toEqual(['docs-updated', 'accepted']);
  });

  test('marks missing docs and risks for follow-up', () => {
    expect(getChangeCommentStatuses(baseExplanation({ docs: { required: true, paths: [] }, risks: ['Could break API'] }))).toEqual(['docs-missing', 'needs-revision']);
  });
});

describe('groupChangeCommentsByFile', () => {
  test('groups by normalized file path and preserves changed-file ordering', () => {
    const docs = baseExplanation({ filePath: './docs/feature.md', summary: 'Docs updated', createdAt: '2026-07-06T00:00:02.000Z' });
    const codeLater = baseExplanation({ range: { startLine: 20, endLine: 22 }, summary: 'Later code', createdAt: '2026-07-06T00:00:03.000Z' });
    const codeEarlier = baseExplanation({ range: { startLine: 3, endLine: 3 }, summary: 'Earlier code', createdAt: '2026-07-06T00:00:01.000Z' });

    const groups = groupChangeCommentsByFile([docs, codeLater, codeEarlier], ['src/index.ts', 'docs/feature.md']);

    expect(groups.map((group) => group.filePath)).toEqual(['src/index.ts', 'docs/feature.md']);
    expect(groups[0].explanations.map((entry) => entry.summary)).toEqual(['Earlier code', 'Later code']);
    expect(groups[1].statuses).toContain('docs-updated');
  });
});
