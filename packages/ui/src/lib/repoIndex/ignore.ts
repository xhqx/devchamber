const DEFAULT_IGNORED_SEGMENTS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '.openchamber',
]);

const DEFAULT_IGNORED_FILES = new Set([
  'bun.lock',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
]);

export type RepoIgnoreOptions = {
  maxFileSize?: number;
  ignoredSegments?: Iterable<string>;
  ignoredFiles?: Iterable<string>;
};

export const DEFAULT_REPO_INDEX_MAX_FILE_SIZE = 512 * 1024;

export const normalizeRepoPath = (path: string): string => path
  .replace(/\\/g, '/')
  .replace(/^\.\//, '')
  .replace(/\/+/g, '/')
  .replace(/^\/+|\/+$/g, '');

export const shouldIgnoreRepoPath = (
  rawPath: string,
  size = 0,
  options: RepoIgnoreOptions = {},
): boolean => {
  const path = normalizeRepoPath(rawPath);
  if (!path) return true;

  const maxFileSize = options.maxFileSize ?? DEFAULT_REPO_INDEX_MAX_FILE_SIZE;
  if (size > maxFileSize) return true;

  const ignoredSegments = new Set(options.ignoredSegments ?? DEFAULT_IGNORED_SEGMENTS);
  const ignoredFiles = new Set(options.ignoredFiles ?? DEFAULT_IGNORED_FILES);
  const parts = path.split('/').filter(Boolean);
  const fileName = parts.at(-1) ?? '';

  return parts.some((part) => ignoredSegments.has(part)) || ignoredFiles.has(fileName);
};
