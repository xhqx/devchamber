import { normalizeRepoPath, shouldIgnoreRepoPath, type RepoIgnoreOptions } from './ignore';
import type {
  RepoDependencyEdge,
  RepoIndexedDirectory,
  RepoIndexedFile,
  RepoIndexedSymbol,
  RepoIndex,
  RepoIndexInputFile,
  RepoLanguage,
  RepoPackageBoundary,
  RepoSymbolKind,
} from './schema';

const LANGUAGE_BY_EXTENSION: Record<string, RepoLanguage> = {
  ts: 'typescript',
  tsx: 'typescript',
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  json: 'json',
  md: 'markdown',
  mdx: 'markdown',
  css: 'css',
  scss: 'css',
  html: 'html',
  py: 'python',
  sh: 'shell',
  bash: 'shell',
  go: 'go',
  rs: 'rust',
};

const DOCS_FILE_RE = /(^|\/)(readme|changelog|contributing|license)(\.[^/]*)?$/i;
const DOCS_DIR_RE = /(^|\/)(docs|documentation|adr|decisions)(\/|$)/i;
const SYMBOL_PATTERNS: Array<{ kind: RepoSymbolKind; re: RegExp }> = [
  { kind: 'component', re: /export\s+(?:default\s+)?function\s+([A-Z][A-Za-z0-9_]*)\s*\(/g },
  { kind: 'function', re: /export\s+(?:async\s+)?function\s+([a-z_][A-Za-z0-9_]*)\s*\(/g },
  { kind: 'class', re: /export\s+(?:default\s+)?class\s+([A-Za-z_][A-Za-z0-9_]*)/g },
  { kind: 'type', re: /export\s+(?:type|interface)\s+([A-Za-z_][A-Za-z0-9_]*)/g },
  { kind: 'const', re: /export\s+const\s+([A-Za-z_][A-Za-z0-9_]*)/g },
];

const directoryName = (path: string): string => {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
};

const baseName = (path: string): string => path.split('/').at(-1) ?? path;

const extensionOf = (path: string): string => {
  const name = baseName(path);
  const dotIndex = name.lastIndexOf('.');
  return dotIndex > 0 ? name.slice(dotIndex + 1).toLowerCase() : '';
};

const inferLanguage = (extension: string): RepoLanguage => LANGUAGE_BY_EXTENSION[extension] ?? 'other';

const isDocsPath = (path: string, extension: string): boolean => (
  extension === 'md' || extension === 'mdx' || DOCS_FILE_RE.test(path) || DOCS_DIR_RE.test(path)
);

const lineNumberAt = (content: string, index: number): number => content.slice(0, index).split('\n').length;

export const extractRepoSymbols = (file: Pick<RepoIndexInputFile, 'path' | 'content'>): RepoIndexedSymbol[] => {
  if (!file.content) return [];
  const path = normalizeRepoPath(file.path);
  const extension = extensionOf(path);
  if (!['ts', 'tsx', 'js', 'jsx'].includes(extension)) return [];

  const symbols: RepoIndexedSymbol[] = [];
  for (const { kind, re } of SYMBOL_PATTERNS) {
    re.lastIndex = 0;
    for (const match of file.content.matchAll(re)) {
      const name = match[1];
      if (!name) continue;
      symbols.push({
        name,
        kind,
        path,
        line: lineNumberAt(file.content, match.index ?? 0),
      });
    }
  }

  return symbols.sort((a, b) => a.line - b.line || a.name.localeCompare(b.name));
};

const buildDirectoryIndex = (files: RepoIndexedFile[]): RepoIndexedDirectory[] => {
  const directories = new Map<string, RepoIndexedDirectory>();

  for (const file of files) {
    const parts = file.directory ? file.directory.split('/') : [];
    for (let depth = 0; depth <= parts.length; depth += 1) {
      const path = parts.slice(0, depth).join('/');
      const entry = directories.get(path) ?? { path, fileCount: 0, totalSize: 0 };
      entry.fileCount += 1;
      entry.totalSize += file.size;
      directories.set(path, entry);
    }
  }

  return Array.from(directories.values()).sort((a, b) => a.path.localeCompare(b.path));
};

const parsePackageName = (content?: string): string | undefined => {
  if (!content) return undefined;
  try {
    const parsed = JSON.parse(content) as { name?: unknown };
    return typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name.trim() : undefined;
  } catch {
    return undefined;
  }
};

const parseDependencies = (content?: string): string[] => {
  if (!content) return [];
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const keys = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
    return Array.from(new Set(keys.flatMap((key) => {
      const deps = parsed[key];
      return deps && typeof deps === 'object' ? Object.keys(deps as Record<string, unknown>) : [];
    })));
  } catch {
    return [];
  }
};

const findPackageBoundaries = (entries: RepoIndexInputFile[]): RepoPackageBoundary[] => {
  const boundaries = new Map<string, RepoPackageBoundary>();

  for (const entry of entries) {
    const path = normalizeRepoPath(entry.path);
    const dir = directoryName(path);
    if (baseName(path) === 'package.json') {
      const current = boundaries.get(dir) ?? { path: dir, hasTsconfig: false, hasPackageJson: false };
      boundaries.set(dir, {
        ...current,
        name: parsePackageName(entry.content),
        hasPackageJson: true,
      });
    }
    if (baseName(path) === 'tsconfig.json') {
      const current = boundaries.get(dir) ?? { path: dir, hasTsconfig: false, hasPackageJson: false };
      boundaries.set(dir, { ...current, hasTsconfig: true });
    }
  }

  return Array.from(boundaries.values()).sort((a, b) => a.path.localeCompare(b.path));
};

const buildDependencyGraph = (
  entries: RepoIndexInputFile[],
  packageBoundaries: RepoPackageBoundary[],
): RepoDependencyEdge[] => {
  const workspaceNames = new Set(packageBoundaries.map((boundary) => boundary.name).filter((name): name is string => Boolean(name)));
  const edges: RepoDependencyEdge[] = [];

  for (const entry of entries) {
    const path = normalizeRepoPath(entry.path);
    if (baseName(path) !== 'package.json') continue;
    const from = parsePackageName(entry.content) ?? (directoryName(path) || '.');
    for (const dependency of parseDependencies(entry.content)) {
      edges.push({
        from,
        to: dependency,
        kind: workspaceNames.has(dependency) ? 'workspace' : 'external',
      });
    }
  }

  return edges.sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to));
};

export const buildRepoIndex = (
  inputFiles: RepoIndexInputFile[],
  options: RepoIgnoreOptions & { generatedAt?: string } = {},
): RepoIndex => {
  const includedInputs: RepoIndexInputFile[] = [];
  let ignoredCount = 0;

  for (const input of inputFiles) {
    const path = normalizeRepoPath(input.path);
    if (shouldIgnoreRepoPath(path, input.size, options)) {
      ignoredCount += 1;
      continue;
    }
    includedInputs.push({ ...input, path });
  }

  const files: RepoIndexedFile[] = includedInputs
    .map((input) => {
      const extension = extensionOf(input.path);
      return {
        path: input.path,
        name: baseName(input.path),
        directory: directoryName(input.path),
        extension,
        language: inferLanguage(extension),
        size: input.size,
        mtimeMs: input.mtimeMs,
        isDocs: isDocsPath(input.path, extension),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const packageBoundaries = findPackageBoundaries(includedInputs);
  const packageByDir = new Map(packageBoundaries.map((boundary) => [boundary.path, boundary.name]));
  const filesWithPackages = files.map((file) => {
    const directories = file.directory ? file.directory.split('/') : [];
    for (let depth = directories.length; depth >= 0; depth -= 1) {
      const packageName = packageByDir.get(directories.slice(0, depth).join('/'));
      if (packageName) return { ...file, packageName };
    }
    return file;
  });

  return {
    generatedAt: options.generatedAt ?? new Date().toISOString(),
    files: filesWithPackages,
    directories: buildDirectoryIndex(filesWithPackages),
    symbols: includedInputs.flatMap(extractRepoSymbols),
    docsFiles: filesWithPackages.filter((file) => file.isDocs).map((file) => file.path),
    packageBoundaries,
    dependencyGraph: buildDependencyGraph(includedInputs, packageBoundaries),
    ignoredCount,
  };
};
