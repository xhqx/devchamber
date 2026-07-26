import { describe, expect, test } from 'bun:test';
import {
  buildProjectDocsDirectoryPath,
  buildProjectDocsModulesDirectoryPath,
  buildProjectDocsPath,
  renderProjectDocsMarkdown,
  saveProjectDocsFile,
} from './projectDocsFile';
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
    {
      path: 'src/api/client.ts',
      name: 'client.ts',
      directory: 'src/api',
      extension: '.ts',
      language: 'typescript',
      size: 800,
      mtimeMs: 1000,
      isDocs: false,
      packageName: 'repo',
    },
  ],
  directories: [{ path: 'src', fileCount: 2, totalSize: 2000 }],
  symbols: [
    { kind: 'component', name: 'App', path: 'src/App.tsx', line: 3 },
    { kind: 'function', name: 'fetchUser', path: 'src/api/client.ts', line: 4 },
  ],
  docsFiles: ['README.md'],
  packageBoundaries: [{ path: '', name: 'repo', hasPackageJson: true, hasTsconfig: true }],
  dependencyGraph: [],
  ignoredCount: 2,
};

describe('project docs file helpers', () => {
  test('builds stable project-local extension docs paths', () => {
    expect(buildProjectDocsDirectoryPath('/workspace/project/')).toBe('/workspace/project/.openchamber/repo-docs');
    expect(buildProjectDocsModulesDirectoryPath('/workspace/project/')).toBe('/workspace/project/.openchamber/repo-docs/modules');
    expect(buildProjectDocsPath('/workspace/project/')).toBe('/workspace/project/.openchamber/repo-docs/INDEX.md');
  });

  test('renders a persistent project docs markdown index from the repo index', () => {
    const markdown = renderProjectDocsMarkdown(sampleIndex, '/workspace/project');

    expect(markdown).toContain('# Project Docs Index');
    expect(markdown).toContain('Workspace: /workspace/project');
    expect(markdown).toContain('- Files: 3');
    expect(markdown).toContain('- Source files documented: 2');
    expect(markdown).toContain('- README.md');
    expect(markdown).toContain('- src/App.tsx (typescript, 1200 bytes)');
    expect(markdown).toContain('- component App — src/App.tsx:3');
  });

  test('creates split module markdown docs with content-derived file descriptions', async () => {
    const calls: string[] = [];
    const writes = new Map<string, string>();

    const result = await saveProjectDocsFile({
      files: {
        createDirectory: async (path) => {
          calls.push(`mkdir:${path}`);
          return { success: true, path };
        },
        scanRepoIndex: async (options) => {
          calls.push(`scan:${options?.includeContent}:${options?.directory}`);
          return {
            directory: '/workspace/project',
            truncated: false,
            files: [
              {
                path: '/workspace/project/src/App.tsx',
                relativePath: 'src/App.tsx',
                size: 1200,
                mtimeMs: 1000,
                content: "import React from 'react';\nexport function App() { return <main />; }",
              },
              {
                path: '/workspace/project/src/api/client.ts',
                relativePath: 'src/api/client.ts',
                size: 800,
                mtimeMs: 1000,
                content: "export async function fetchUser() { return fetch('/api/user'); }",
              },
            ],
          };
        },
        writeFile: async (path, content) => {
          calls.push(`write:${path}`);
          writes.set(path, content);
          return { success: true, path };
        },
      },
      index: sampleIndex,
      projectRoot: '/workspace/project',
    });

    expect(result.path).toBe('/workspace/project/.openchamber/repo-docs/INDEX.md');
    expect(result.paths).toEqual([
      '/workspace/project/.openchamber/repo-docs/INDEX.md',
      '/workspace/project/.openchamber/repo-docs/modules/src.md',
    ]);

    expect(calls).toEqual([
      'scan:true:/workspace/project',
      'mkdir:/workspace/project/.openchamber/repo-docs',
      'mkdir:/workspace/project/.openchamber/repo-docs/modules',
      'write:/workspace/project/.openchamber/repo-docs/INDEX.md',
      'write:/workspace/project/.openchamber/repo-docs/modules/src.md',
    ]);

    const moduleDoc = writes.get('/workspace/project/.openchamber/repo-docs/modules/src.md') ?? '';
    expect(moduleDoc).toContain('# Module: src');
    expect(moduleDoc).toContain('### src/App.tsx');
    expect(moduleDoc).toContain('What it does: renders UI or React logic; declares 1 indexed symbol.');
    expect(moduleDoc).toContain('Main dependencies: react');
    expect(moduleDoc).toContain('Public exports: App');
    expect(moduleDoc).toContain('### src/api/client.ts');
    expect(moduleDoc).toContain('talks to runtime/server APIs');
  });
});
