import { describe, expect, test } from 'bun:test';

import { buildRepoIndex } from './indexer';
import { buildRepoMapViewModel, filterRepoMapSymbols, filterRepoMapTree } from './viewModel';
import type { RepoIndexInputFile } from './schema';

const file = (path: string, content = '', size = content.length, mtimeMs = 1000): RepoIndexInputFile => ({
  path,
  content,
  size,
  mtimeMs,
});

describe('repo map view model', () => {
  test('builds a sorted repository tree with package and docs summaries', () => {
    const index = buildRepoIndex([
      file('package.json', JSON.stringify({ name: 'root' }), 100, 10),
      file('packages/ui/package.json', JSON.stringify({ name: '@scope/ui' }), 120, 20),
      file('packages/ui/tsconfig.json', '{}', 20, 30),
      file('packages/ui/src/Button.tsx', 'export function Button() { return null; }', 90, 50),
      file('packages/ui/src/useThing.ts', 'export const useThing = () => null', 80, 40),
      file('packages/api/package.json', JSON.stringify({ name: '@scope/api' }), 110, 15),
      file('docs/README.md', '# Docs', 30, 60),
    ], { generatedAt: '2026-07-07T00:00:00.000Z' });

    const viewModel = buildRepoMapViewModel(index, { maxSymbols: 1, maxRecentFiles: 2 });

    expect(viewModel.generatedAt).toBe('2026-07-07T00:00:00.000Z');
    expect(viewModel.totals).toEqual({
      files: 7,
      directories: index.directories.length,
      symbols: 2,
      docsFiles: 1,
      packages: 3,
      ignored: 0,
      totalSize: 550,
    });

    expect(viewModel.root.children.map((node) => `${node.kind}:${node.path}`)).toEqual([
      'directory:docs',
      'directory:packages',
      'file:package.json',
    ]);

    const packagesNode = viewModel.root.children.find((node) => node.path === 'packages');
    expect(packagesNode?.children.map((node) => node.path)).toEqual(['packages/api', 'packages/ui']);

    const uiPackage = viewModel.packages.find((entry) => entry.name === '@scope/ui');
    expect(uiPackage).toEqual({
      path: 'packages/ui',
      name: '@scope/ui',
      fileCount: 4,
      docsFileCount: 0,
      symbolCount: 2,
      hasTsconfig: true,
      hasPackageJson: true,
    });

    expect(viewModel.topSymbols).toEqual([
      { name: 'Button', kind: 'component', path: 'packages/ui/src/Button.tsx', line: 1 },
    ]);
    expect(viewModel.recentFiles.map((entry) => entry.path)).toEqual(['docs/README.md', 'packages/ui/src/Button.tsx']);
    expect(viewModel.docsCoverage).toEqual({
      docsFiles: ['docs/README.md'],
      codeFileCount: 6,
      docsFileCount: 1,
      docsRatio: 1 / 7,
    });
  });

  test('filters the tree while preserving ancestor directories', () => {
    const index = buildRepoIndex([
      file('packages/ui/src/Button.tsx', 'export function Button() { return null; }', 90, 50),
      file('packages/ui/src/useThing.ts', 'export const useThing = () => null', 80, 40),
      file('docs/README.md', '# Docs', 30, 60),
    ], { generatedAt: '2026-07-07T00:00:00.000Z' });

    const viewModel = buildRepoMapViewModel(index);
    const filtered = filterRepoMapTree(viewModel.root, 'button');

    expect(filtered.matchedFileCount).toBe(1);
    expect(filtered.matchedDirectoryCount).toBe(0);
    expect(filtered.matchedPaths).toEqual(['packages/ui/src/Button.tsx']);
    expect(filtered.root.children.map((node) => node.path)).toEqual(['packages']);
    expect(filtered.root.children[0]?.children[0]?.children[0]?.children.map((node) => node.path)).toEqual(['packages/ui/src/Button.tsx']);
  });

  test('combines language and package filters for tree results', () => {
    const index = buildRepoIndex([
      file('package.json', JSON.stringify({ name: 'root' }), 100, 10),
      file('packages/ui/package.json', JSON.stringify({ name: '@scope/ui' }), 120, 20),
      file('packages/ui/src/Button.tsx', 'export function Button() { return null; }', 90, 50),
      file('packages/ui/src/theme.css', '.button { color: red; }', 80, 40),
      file('packages/api/package.json', JSON.stringify({ name: '@scope/api' }), 110, 15),
      file('packages/api/src/server.ts', 'export function server() { return null; }', 70, 35),
    ], { generatedAt: '2026-07-07T00:00:00.000Z' });

    const viewModel = buildRepoMapViewModel(index);
    const filtered = filterRepoMapTree(viewModel.root, {
      languages: ['typescript'],
      packageNames: ['@scope/ui'],
    });

    expect(filtered.matchedFileCount).toBe(1);
    expect(filtered.matchedPaths).toEqual(['packages/ui/src/Button.tsx']);
    expect(filtered.root.children.map((node) => node.path)).toEqual(['packages']);
    expect(filtered.root.children[0]?.children.map((node) => node.path)).toEqual(['packages/ui']);
  });

  test('filters repo symbols by name kind and path', () => {
    const index = buildRepoIndex([
      file('packages/ui/src/Button.tsx', 'export function Button() { return null; }', 90, 50),
      file('packages/ui/src/Card.tsx', 'export const Card = () => null', 80, 40),
      file('packages/api/src/server.ts', 'export class Server {}', 70, 35),
    ], { generatedAt: '2026-07-07T00:00:00.000Z' });

    const viewModel = buildRepoMapViewModel(index, { maxSymbols: 10 });
    const filtered = filterRepoMapSymbols(viewModel.topSymbols, 'ui src', { limit: 1 });

    expect(filtered.matchedCount).toBe(2);
    expect(filtered.symbols).toEqual([
      { name: 'Button', kind: 'component', path: 'packages/ui/src/Button.tsx', line: 1 },
    ]);
  });
});
