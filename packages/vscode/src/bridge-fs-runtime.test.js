import { beforeEach, describe, expect, it, mock } from 'bun:test';
import { promisify } from 'node:util';

const execCalls = [];
const execMock = mock(() => {
  throw new Error('exec should be called through promisify');
});

execMock[promisify.custom] = (command, options) => {
  execCalls.push({ command, options });
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({ stdout: '/repo/.git\n/repo/.git\n', stderr: '' });
    }, 10);
  });
};

mock.module('child_process', () => ({
  exec: execMock,
}));

mock.module('vscode', () => ({
  workspace: {
    workspaceFolders: [{ uri: { fsPath: '/workspace' } }],
    fs: {},
  },
  Uri: {
    file: (fsPath) => ({ fsPath }),
  },
  FileType: {
    Directory: 2,
  },
  window: {},
}));

const { clearGitReadCacheForTests, handleFsBridgeMessage } = await import('./bridge-fs-runtime');

const deps = {
  resolveUserPath: (value) => value,
  listDirectoryEntries: mock(),
  normalizeFsPath: (value) => value,
  execGit: mock(),
  searchDirectory: mock(),
  scanRepoIndexFiles: mock(),
  resolveFileReadPath: mock(),
  parseDroppedFileReference: mock(),
  readUriAsAttachment: mock(),
};

describe('bridge fs exec git read cache', () => {
  beforeEach(() => {
    execCalls.length = 0;
    clearGitReadCacheForTests();
  });

  it('dedupes in-flight cacheable git reads and reuses fresh results', async () => {
    const command = 'git rev-parse --absolute-git-dir --git-common-dir';
    const cwd = '/repo';

    const [first, second] = await Promise.all([
      handleFsBridgeMessage({ id: '1', type: 'api:fs:exec', payload: { commands: [command], cwd } }, deps),
      handleFsBridgeMessage({ id: '2', type: 'api:fs:exec', payload: { commands: [command], cwd } }, deps),
    ]);

    expect(first?.success).toBe(true);
    expect(second?.success).toBe(true);
    expect(execCalls).toHaveLength(1);

    const spacedCommand = 'git   rev-parse   --absolute-git-dir   --git-common-dir';
    const cached = await handleFsBridgeMessage({ id: '3', type: 'api:fs:exec', payload: { commands: [spacedCommand], cwd } }, deps);

    expect(execCalls).toHaveLength(1);
    expect(cached?.data?.results?.[0]).toMatchObject({
      command: spacedCommand,
      success: true,
      stdout: '/repo/.git\n/repo/.git',
    });
  });

  it('does not cache arbitrary exec commands', async () => {
    const command = 'git status --porcelain';
    const cwd = '/repo';

    await handleFsBridgeMessage({ id: '1', type: 'api:fs:exec', payload: { commands: [command], cwd } }, deps);
    await handleFsBridgeMessage({ id: '2', type: 'api:fs:exec', payload: { commands: [command], cwd } }, deps);

    expect(execCalls).toHaveLength(2);
  });
});

describe('bridge fs repo index scan', () => {
  beforeEach(() => {
    deps.scanRepoIndexFiles.mockReset();
  });

  it('forwards bounded repo index scan options through the fs bridge', async () => {
    deps.scanRepoIndexFiles.mockResolvedValueOnce({
      directory: '/workspace',
      truncated: false,
      files: [{ path: '/workspace/src/index.ts', relativePath: 'src/index.ts', size: 42, mtimeMs: 1234, content: 'export const ok = true;' }],
    });

    const response = await handleFsBridgeMessage({
      id: 'scan',
      type: 'api:fs:scan-repo-index',
      payload: { directory: '/workspace', maxFiles: 50, maxFileSize: 1000, includeContent: false },
    }, deps);

    expect(deps.scanRepoIndexFiles).toHaveBeenCalledWith({
      directory: '/workspace',
      maxFiles: 50,
      maxFileSize: 1000,
      includeContent: false,
      respectGitignore: true,
    });
    expect(response).toMatchObject({
      id: 'scan',
      type: 'api:fs:scan-repo-index',
      success: true,
      data: {
        directory: '/workspace',
        truncated: false,
        files: [{ relativePath: 'src/index.ts', size: 42 }],
      },
    });
  });
});
