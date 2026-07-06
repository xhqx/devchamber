import { describe, expect, test } from 'bun:test';
import { shouldIgnoreRepoPath } from './ignore';
import { buildRepoIndex, extractRepoSymbols } from './indexer';
import type { RepoIndexInputFile } from './schema';

const file = (path: string, content = '', size = content.length): RepoIndexInputFile => ({
  path,
  content,
  size,
  mtimeMs: 1000,
});

describe('repo index ignore rules', () => {
  test('ignores common generated paths and oversized files', () => {
    expect(shouldIgnoreRepoPath('node_modules/pkg/index.js')).toBe(true);
    expect(shouldIgnoreRepoPath('packages/ui/dist/app.js')).toBe(true);
    expect(shouldIgnoreRepoPath('packages/ui/src/App.tsx', 1024)).toBe(false);
    expect(shouldIgnoreRepoPath('big.bin', 1024, { maxFileSize: 10 })).toBe(true);
  });
});

describe('repo indexer core', () => {
  test('indexes files, directories, docs, package boundaries, and dependencies', () => {
    const index = buildRepoIndex([
      file('package.json', JSON.stringify({ name: 'root', dependencies: { '@scope/ui': 'workspace:*', react: '^19.0.0' } })),
      file('packages/ui/package.json', JSON.stringify({ name: '@scope/ui', dependencies: { '@scope/core': 'workspace:*' } })),
      file('packages/ui/tsconfig.json', '{}'),
      file('packages/core/package.json', JSON.stringify({ name: '@scope/core' })),
      file('packages/ui/src/Button.tsx', 'export function Button() { return null; }\nexport type ButtonProps = {};'),
      file('docs/fork/ROADMAP.md', '# Roadmap'),
      file('node_modules/react/index.js', 'ignored'),
    ], { generatedAt: '2026-07-05T00:00:00.000Z' });

    expect(index.generatedAt).toBe('2026-07-05T00:00:00.000Z');
    expect(index.ignoredCount).toBe(1);
    expect(index.files.map((entry) => entry.path)).toContain('packages/ui/src/Button.tsx');
    expect(index.files.find((entry) => entry.path === 'packages/ui/src/Button.tsx')?.packageName).toBe('@scope/ui');
    expect(index.directories.find((entry) => entry.path === 'packages/ui')?.fileCount).toBe(3);
    expect(index.docsFiles).toEqual(['docs/fork/ROADMAP.md']);
    expect(index.packageBoundaries.find((entry) => entry.path === 'packages/ui')).toEqual({
      path: 'packages/ui',
      name: '@scope/ui',
      hasTsconfig: true,
      hasPackageJson: true,
    });
    expect(index.dependencyGraph.find((entry) => entry.from === 'root' && entry.to === '@scope/ui')).toEqual({ from: 'root', to: '@scope/ui', kind: 'workspace' });
    expect(index.dependencyGraph.find((entry) => entry.from === 'root' && entry.to === 'react')).toEqual({ from: 'root', to: 'react', kind: 'external' });
  });

  test('extracts cheap exported symbols from TypeScript files', () => {
    expect(extractRepoSymbols(file('src/example.ts', [
      'export function loadThing() {}',
      'export class Thing {}',
      'export interface ThingProps {}',
      'export const useThing = () => null',
    ].join('\n')))).toEqual([
      { name: 'loadThing', kind: 'function', path: 'src/example.ts', line: 1 },
      { name: 'Thing', kind: 'class', path: 'src/example.ts', line: 2 },
      { name: 'ThingProps', kind: 'type', path: 'src/example.ts', line: 3 },
      { name: 'useThing', kind: 'const', path: 'src/example.ts', line: 4 },
    ]);
  });
});
