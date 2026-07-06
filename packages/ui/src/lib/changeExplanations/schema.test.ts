import { describe, expect, test } from 'bun:test';

import { createChangeExplanation, createEmptyChangeExplanationIndex } from './schema';
import { parseChangeExplanationStore, selectChangeExplanationsForFile, selectChangeExplanationsForSession, upsertChangeExplanations } from './store';

describe('change explanation schema/store', () => {
  test('normalizes drafts into stable explanation records', () => {
    const explanation = createChangeExplanation({
      sessionId: 'ses_1',
      directory: '/workspace',
      filePath: './src\\App.tsx',
      changeKind: 'modify',
      summary: '  Add settings panel  ',
      why: '  Users need visible controls  ',
      risks: [' regression ', 'regression', ''],
      docs: { required: true, paths: ['./docs\\settings.md', 'README.md'] },
      createdAt: '2026-07-06T10:00:00.000Z',
      model: { providerID: 'openai', modelID: 'gpt-5.5' },
    });

    expect({
      sessionId: explanation.sessionId,
      directory: explanation.directory,
      filePath: explanation.filePath,
      changeKind: explanation.changeKind,
      summary: explanation.summary,
      why: explanation.why,
      risks: explanation.risks,
      docsUpdated: explanation.docsUpdated,
      docsPaths: explanation.docsPaths,
      createdAt: explanation.createdAt,
      model: explanation.model,
    }).toEqual({
      sessionId: 'ses_1',
      directory: '/workspace',
      filePath: 'src/App.tsx',
      changeKind: 'modify',
      summary: 'Add settings panel',
      why: 'Users need visible controls',
      risks: ['regression'],
      docsUpdated: true,
      docsPaths: ['README.md', 'docs/settings.md'],
      createdAt: '2026-07-06T10:00:00.000Z',
      model: { providerID: 'openai', modelID: 'gpt-5.5' },
    });
    expect(explanation.id.startsWith('ce_')).toBe(true);
  });

  test('upserts and selects explanations deterministically', () => {
    const first = createChangeExplanation({
      sessionId: 'ses_1',
      directory: '/workspace',
      filePath: 'src/App.tsx',
      changeKind: 'modify',
      summary: 'Initial summary',
      why: 'Initial reason',
      createdAt: '2026-07-06T10:00:00.000Z',
    });
    const replacement = { ...first, summary: 'Updated summary' };
    const second = createChangeExplanation({
      sessionId: 'ses_2',
      directory: '/workspace',
      filePath: 'src/index.ts',
      changeKind: 'add',
      summary: 'Add entrypoint',
      why: 'Needed for boot',
      createdAt: '2026-07-06T10:01:00.000Z',
    });

    const store = upsertChangeExplanations(createEmptyChangeExplanationIndex('now'), [first, second, replacement], 'later');

    expect(store.updatedAt).toBe('later');
    expect(store.explanations.map((entry) => entry.summary)).toEqual(['Updated summary', 'Add entrypoint']);
    expect(selectChangeExplanationsForSession(store, 'ses_1')).toEqual([replacement]);
    expect(selectChangeExplanationsForFile(store, 'src/index.ts')).toEqual([second]);
  });

  test('parses unknown persisted values safely', () => {
    expect(parseChangeExplanationStore(null, 'fallback')).toEqual({ version: 1, explanations: [], updatedAt: 'fallback' });
    expect(parseChangeExplanationStore({ version: 1, explanations: [{ id: 'x', sessionId: 's', filePath: 'a.ts' }], updatedAt: 'saved' })).toEqual({
      version: 1,
      explanations: [{ id: 'x', sessionId: 's', filePath: 'a.ts' }],
      updatedAt: 'saved',
    });
  });
});
