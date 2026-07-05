import { describe, expect, test } from 'bun:test';
import { buildCommitGenerationPromptContext } from './commitGenerationContext';

describe('commit generation prompt context', () => {
  test('adds status metadata and bounded diff excerpts', () => {
    const context = buildCommitGenerationPromptContext({
      files: ['src/b.ts', 'src/a.ts', 'src/a.ts'],
      statusFiles: [
        { path: 'src/a.ts', index: 'M', working_dir: ' ' },
        { path: 'src/b.ts', index: 'A', working_dir: ' ' },
      ],
      diffs: [
        { path: 'src/a.ts', diff: 'diff --git a/src/a.ts b/src/a.ts\n+hello' },
        { path: 'src/b.ts', diff: 'diff --git a/src/b.ts b/src/b.ts\n+world' },
      ],
      maxChars: 10_000,
    });

    expect(context.selectedFiles).toBe([
      '- src/a.ts (index=M working=?)',
      '- src/b.ts (index=A working=?)',
    ].join('\n'));
    expect(context.diffContext).toContain('### src/a.ts (index=M working=?)');
    expect(context.diffContext).toContain('```diff\ndiff --git a/src/a.ts b/src/a.ts\n+hello\n```');
    expect(context.truncated).toBe(false);
  });

  test('reports missing diffs and truncates large contexts', () => {
    const context = buildCommitGenerationPromptContext({
      files: ['huge.ts', 'missing.ts'],
      diffs: [
        { path: 'huge.ts', diff: `diff --git a/huge.ts b/huge.ts\n${'+x\n'.repeat(2_000)}` },
        { path: 'missing.ts', error: 'binary file' },
      ],
      maxChars: 1_000,
    });

    expect(context.diffContext).toContain('### huge.ts');
    expect(context.diffContext).toContain('[diff context truncated to stay within prompt budget]');
    expect(context.truncated).toBe(true);
  });
});
