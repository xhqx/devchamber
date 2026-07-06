import { describe, expect, test } from 'bun:test';

import { buildChangeExplanationPromptContext, generateChangeExplanation, parseGeneratedChangeExplanationPayload } from './generateExplanation';

describe('parseGeneratedChangeExplanationPayload', () => {
  test('normalizes structured output', () => {
    const payload = parseGeneratedChangeExplanationPayload({
      summary: ' Add docs context ',
      why: ' Commit generation needs docs awareness ',
      risks: [' stale docs ', 'stale docs', ''],
      docs: {
        required: true,
        paths: ['./docs\\fork.md', 'README.md'],
        suggestedPatch: ' Update docs ',
        reason: ' Code behavior changed ',
      },
    });

    expect(payload).toEqual({
      summary: 'Add docs context',
      why: 'Commit generation needs docs awareness',
      risks: ['stale docs'],
      docs: {
        required: true,
        paths: ['README.md', 'docs/fork.md'],
        suggestedPatch: 'Update docs',
        reason: 'Code behavior changed',
      },
    });
  });

  test('rejects missing required fields', () => {
    expect(() => parseGeneratedChangeExplanationPayload({ why: 'x', docs: {} })).toThrow('summary');
    expect(() => parseGeneratedChangeExplanationPayload({ summary: 'x', docs: {} })).toThrow('why');
  });
});

describe('buildChangeExplanationPromptContext', () => {
  test('formats detected changes and fallback diff context', () => {
    const context = buildChangeExplanationPromptContext([
      { filePath: 'src/a.ts', changeKind: 'modify', source: 'diff', summary: 'modify src/a.ts' },
      { filePath: 'README.md', changeKind: 'docs', source: 'part', summary: 'write changed README.md' },
    ]);

    expect(context.changed_files).toBe('- src/a.ts (modify, diff): modify src/a.ts\n- README.md (docs, part): write changed README.md');
    expect(context.diff_context).toBe('No bounded diff context supplied.');
  });
});

describe('generateChangeExplanation', () => {
  test('generates explanations for each detected change with fallback model metadata', async () => {
    const calls: string[] = [];
    const result = await generateChangeExplanation({
      sessionId: 'ses_1',
      directory: '/workspace',
      changes: [
        { filePath: './src\\feature.ts', changeKind: 'modify', source: 'diff', summary: 'modify src/feature.ts' },
        { filePath: 'docs/feature.md', changeKind: 'docs', source: 'diff', summary: 'docs docs/feature.md' },
      ],
      diffContext: '```diff\n+feature\n```',
      primaryModel: { providerID: 'openai', modelID: 'gpt-primary' },
      chains: [{
        purpose: 'docs',
        models: [{ providerID: 'anthropic', modelID: 'claude-fallback' }],
        maxAttempts: 2,
        retryOn: ['invalid_json'],
      }],
      createdAt: '2026-07-06T12:00:00.000Z',
      renderPrompt: async (id, variables = {}) => `${id}\n${variables.changed_files ?? ''}\n${variables.diff_context ?? ''}`,
      runStructured: async ({ model, hiddenPrompt }) => {
        calls.push(`${model.providerID}/${model.modelID}`);
        expect(hiddenPrompt.includes('src/feature.ts')).toBe(true);
        if (model.modelID === 'gpt-primary') {
          throw new Error('invalid json from model');
        }
        return {
          summary: 'Add feature behavior',
          why: 'The feature flow now needs explicit handling',
          risks: ['Regression in feature flow'],
          docs: { required: true, paths: ['docs/feature.md'], reason: 'Docs were updated' },
        };
      },
    });

    expect(calls).toEqual(['openai/gpt-primary', 'anthropic/claude-fallback']);
    expect(result.attempts).toBe(2);
    expect(result.failures.length).toBe(1);
    expect(result.model).toEqual({ providerID: 'anthropic', modelID: 'claude-fallback' });
    expect(result.explanations.map((entry) => ({ filePath: entry.filePath, changeKind: entry.changeKind, model: entry.model }))).toEqual([
      { filePath: 'src/feature.ts', changeKind: 'modify', model: { providerID: 'anthropic', modelID: 'claude-fallback' } },
      { filePath: 'docs/feature.md', changeKind: 'docs', model: { providerID: 'anthropic', modelID: 'claude-fallback' } },
    ]);
    expect(result.explanations[0].docsPaths).toEqual(['docs/feature.md']);
  });
});
