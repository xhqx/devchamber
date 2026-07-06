import { describe, expect, test } from 'bun:test';

import { codeChangesRequireDocsDecision, detectCodeChanges, docsChangedForCodeChanges, isCodePath, isDocumentationPath } from './detectCodeChanges';

describe('detectCodeChanges', () => {
  test('classifies code and documentation paths', () => {
    expect(isCodePath('src/App.tsx')).toBe(true);
    expect(isCodePath('docs/architecture.md')).toBe(false);
    expect(isDocumentationPath('README.md')).toBe(true);
    expect(isDocumentationPath('packages/ui/docs/usage.mdx')).toBe(true);
  });

  test('detects code and docs changes from session diffs', () => {
    const changes = detectCodeChanges({
      diffs: [
        { file: 'src/App.tsx', status: 'M' },
        { file: 'README.md', status: 'M' },
        { file: 'assets/logo.png', status: 'M' },
        { file: 'src/old.ts', status: 'D' },
        { file: 'src/new.ts', status: 'A' },
      ],
    });

    expect(changes).toEqual([
      { filePath: 'README.md', changeKind: 'docs', source: 'diff', summary: 'docs README.md' },
      { filePath: 'src/App.tsx', changeKind: 'modify', source: 'diff', summary: 'modify src/App.tsx' },
      { filePath: 'src/new.ts', changeKind: 'add', source: 'diff', summary: 'add src/new.ts' },
      { filePath: 'src/old.ts', changeKind: 'delete', source: 'diff', summary: 'delete src/old.ts' },
    ]);
    expect(docsChangedForCodeChanges(changes)).toBe(true);
    expect(codeChangesRequireDocsDecision(changes)).toBe(true);
  });

  test('detects file-changing tool parts without requiring concrete SDK shapes', () => {
    const changes = detectCodeChanges({
      parts: [
        { type: 'tool', tool: 'write_file', input: { path: './src\\feature.ts' } },
        { type: 'tool', tool: 'read_file', input: { path: 'src/feature.ts' } },
        { type: 'patch', path: 'docs/notes.md' },
      ],
    });

    expect(changes).toEqual([
      { filePath: 'docs/notes.md', changeKind: 'docs', source: 'part', summary: 'patch changed docs/notes.md' },
      { filePath: 'src/feature.ts', changeKind: 'modify', source: 'part', summary: 'write_file changed src/feature.ts' },
    ]);
  });
});
