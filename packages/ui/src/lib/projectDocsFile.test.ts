import { describe, expect, test } from 'bun:test';
import { buildProjectDocsDirectoryPath, buildProjectDocsPath, renderProjectDocsMarkdown, saveProjectDocsFile } from './projectDocsFile';
import type { RepoIndex } from './repoIndex/schema';

const sampleIndex: RepoIndex = {
  generatedAt: '2026-07-25T10:00:00.000Z',
  files: [
    {
      path: 'README.md',
      name: 'README.md',
      directory: '',
      extension: '.md',
      language: 'markdown',
      size: 20,
      mtimeMs: 1000,
      isDocs: true,
    },
    {
      path: 'src/App.tsx',
      name: 'App.tsx',
      directory: 'src',
      extension: '.tsx',
      language: 'typescript',
      size: 1200,
      mtimeMs: 1000,
      isDocs: false,
      packageName: 'repo',
    },
  ],
  directories: [{ path: 'src', fileCount: 1, totalSize: 1200 }],
  symbols: [{ kind: 'component', name: 'App', path: 'src/App.tsx', line: 3 }],
  docsFiles: ['README.md'],
  packageBoundaries: [{ path: '', name: 'repo', hasPackageJson: true, hasTsconfig: true }],
  dependencyGraph: [],
  ignoredCount: 2,
};

describe('project docs file helpers', () => {
  test('builds a stable workspace-local docs path', () => {
    expect(buildProjectDocsDirectoryPath('/workspace/project/')).toBe('/workspace/project/docs');
    expect(buildProjectDocsPath('/workspace/project/')).toBe('/workspace/project/docs/PROJECT_DOCS.md');
  });

  test('renders a persistent project docs markdown scaffold from the repo index', () => {
    const markdown = renderProjectDocsMarkdown(sampleIndex, '/workspace/project');

    expect(markdown).toContain('# Project Docs');
    expect(markdown).toContain('Workspace: /workspace/project');
    expect(markdown).toContain('- Files: 2');
    expect(markdown).toContain('- README.md');
    expect(markdown).toContain('- src/App.tsx (typescript, 1200 bytes)');
    expect(markdown).toContain('- component App — src/App.tsx:3');
  });

  test('creates the docs directory before writing the persisted docs file', async () => {
    const calls: string[] = [];

    const result = await saveProjectDocsFile({
      files: {
        createDirectory: async (path) => {
          calls.push(`mkdir:${path}`);
          return { success: true, path };
        },
        writeFile: async (path, content) => {
          calls.push(`write:${path}:${content.includes('# Project Docs')}`);
          return { success: true, path };
        },
      },
      index: sampleIndex,
      projectRoot: '/workspace/project',
    });

    expect(result).toEqual({ path: '/workspace/project/docs/PROJECT_DOCS.md' });

    expect(calls).toEqual([
      'mkdir:/workspace/project/docs',
      'write:/workspace/project/docs/PROJECT_DOCS.md:true',
    ]);
  });
});
