import { describe, expect, test } from 'bun:test';
import { buildCommitSuggestions, inferCommitScopesFromFiles } from './commitScopes';

describe('commitScopes autocomplete', () => {
  test('infers package scopes from staged files', () => {
    expect(inferCommitScopesFromFiles([
      'packages/ui/src/lib/gitApi.ts',
      'packages/vscode/src/extension.ts',
      'README.md',
    ])).toEqual(['ui', 'vscode', 'readme.md']);
  });

  test('normalizes docs and tests aliases', () => {
    expect(inferCommitScopesFromFiles([
      'docs/fork/ROADMAP.md',
      'tests/smoke.test.ts',
    ])).toEqual(['docs', 'test']);
  });

  test('builds conventional suggestions with inferred scopes', () => {
    const suggestions = buildCommitSuggestions({
      files: ['packages/ui/src/lib/gitApi.ts'],
      currentValue: 'fe',
    });

    expect(suggestions.map((item) => item.value)).toContain('feat: ');
    expect(suggestions.map((item) => item.value)).toContain('feat(ui): ');
    expect(suggestions.every((item) => item.value.startsWith('fe') || item.label.toLowerCase().includes('fe'))).toBe(true);
  });
});
