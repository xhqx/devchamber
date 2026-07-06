import { describe, expect, test } from 'bun:test';
import { buildDocsCommitStatus } from './docsStatus';

describe('buildDocsCommitStatus', () => {
  test('blocks code-only staged changes when docs are required', () => {
    const status = buildDocsCommitStatus({
      files: [{ path: 'packages/ui/src/lib/example.ts', index: 'M', working_dir: '' }],
      docsRequiredOnCodeChange: true,
    });

    expect(status.hasCodeChanges).toBe(true);
    expect(status.hasDocsChanges).toBe(false);
    expect(status.docsRequired).toBe(true);
    expect(status.isBlocked).toBe(true);
    expect(status.codePaths).toEqual(['packages/ui/src/lib/example.ts']);
  });

  test('does not block when documentation is staged with code', () => {
    const status = buildDocsCommitStatus({
      files: [
        { path: 'packages/ui/src/lib/example.ts', index: 'M', working_dir: '' },
        { path: 'docs/fork/ARCHITECTURE.md', index: 'M', working_dir: '' },
      ],
      docsRequiredOnCodeChange: true,
    });

    expect(status.docsRequired).toBe(false);
    expect(status.isBlocked).toBe(false);
    expect(status.docsPaths).toEqual(['docs/fork/ARCHITECTURE.md']);
  });

  test('manual not-needed reason unblocks code-only changes', () => {
    const status = buildDocsCommitStatus({
      files: [{ path: 'packages/ui/src/lib/example.ts', index: 'M', working_dir: '' }],
      docsRequiredOnCodeChange: true,
      notNeededReason: 'Internal refactor only.',
    });

    expect(status.docsRequired).toBe(true);
    expect(status.isBlocked).toBe(false);
  });

  test('disabled setting leaves code-only changes advisory-only', () => {
    const status = buildDocsCommitStatus({
      files: [{ path: 'packages/ui/src/lib/example.ts', index: 'M', working_dir: '' }],
      docsRequiredOnCodeChange: false,
    });

    expect(status.hasCodeChanges).toBe(true);
    expect(status.docsRequired).toBe(false);
    expect(status.isBlocked).toBe(false);
  });
});
