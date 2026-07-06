import { describe, expect, mock, test } from 'bun:test';

import type { FilesAPI } from '../api/types';
import { buildRepositoryIndexFromFilesApi } from './fromFilesApi';

const filesApi = (scanRepoIndex: NonNullable<FilesAPI['scanRepoIndex']>): Pick<FilesAPI, 'scanRepoIndex'> => ({ scanRepoIndex });

describe('buildRepositoryIndexFromFilesApi', () => {
  test('scans the runtime files api and builds a repo index from relative paths', async () => {
    const calls: unknown[] = [];
    const scanRepoIndex = mock(async (options) => {
      calls.push(options);
      return {
        directory: '/workspace',
        truncated: false,
        files: [
          {
            path: '/workspace/package.json',
            relativePath: 'package.json',
            size: 54,
            mtimeMs: 1000,
            content: JSON.stringify({ name: '@demo/root', dependencies: { react: '^19.0.0' } }),
          },
          {
            path: '/workspace/src/App.tsx',
            relativePath: 'src/App.tsx',
            size: 42,
            mtimeMs: 2000,
            content: 'export function App() { return null; }',
          },
        ],
      };
    });

    const index = await buildRepositoryIndexFromFilesApi(filesApi(scanRepoIndex), {
      directory: '/workspace',
      maxFiles: 100,
      maxFileSize: 10000,
    });

    expect(calls[0]).toEqual({
      directory: '/workspace',
      maxFiles: 100,
      maxFileSize: 10000,
      includeContent: true,
      respectGitignore: true,
    });
    expect(index.files.map((file) => file.path)).toEqual(['package.json', 'src/App.tsx']);
    expect(index.packageBoundaries.find((entry) => entry.path === '')).toEqual({
      path: '',
      name: '@demo/root',
      hasPackageJson: true,
      hasTsconfig: false,
    });
    expect(index.symbols.find((entry) => entry.name === 'App')).toEqual({
      name: 'App',
      kind: 'component',
      path: 'src/App.tsx',
      line: 1,
    });
  });

  test('throws when runtime scanning is unavailable', async () => {
    let message = '';
    try {
      await buildRepositoryIndexFromFilesApi({});
    } catch (error) {
      message = error instanceof Error ? error.message : String(error);
    }
    expect(message).toBe('Repository index scanning is not available in this runtime');
  });
});
