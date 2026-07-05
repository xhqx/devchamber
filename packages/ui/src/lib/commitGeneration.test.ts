import { describe, expect, test } from 'bun:test';
import {
  applyCommitGenerationFileBudget,
  buildCommitGenerationVariants,
  normalizeCommitGenerationFileBudget,
} from './commitGeneration';

describe('normalizeCommitGenerationFileBudget', () => {
  test('clamps unsafe values', () => {
    expect(normalizeCommitGenerationFileBudget(0)).toBe(1);
    expect(normalizeCommitGenerationFileBudget(999)).toBe(300);
    expect(normalizeCommitGenerationFileBudget(12.8)).toBe(12);
    expect(normalizeCommitGenerationFileBudget('bad')).toBe(40);
  });
});

describe('applyCommitGenerationFileBudget', () => {
  test('sorts, dedupes, and reports omitted files', () => {
    const budget = applyCommitGenerationFileBudget(['b.ts', 'a.ts', 'b.ts', ''], 1);

    expect(budget).toEqual({
      maxFiles: 1,
      includedFiles: ['a.ts'],
      omittedFiles: ['b.ts'],
    });
  });
});

describe('buildCommitGenerationVariants', () => {
  test('builds direct, conventional, and release-note variants', () => {
    const variants = buildCommitGenerationVariants({
      subject: 'add safe fallback support',
      highlights: ['Adds retry behavior'],
    });

    expect(variants.map((variant) => variant.id)).toEqual(['direct', 'conventional', 'release-note']);
    expect(variants[1].subject).toBe('feat: add safe fallback support');
    expect(variants[2].subject).toBe('Add safe fallback support.');
  });

  test('preserves existing conventional prefix', () => {
    const variants = buildCommitGenerationVariants({ subject: 'fix(ui): handle empty commits' });

    expect(variants[0].subject).toBe('fix(ui): handle empty commits');
    expect(variants.some((variant) => variant.subject === 'fix(ui): handle empty commits')).toBe(true);
  });
});
