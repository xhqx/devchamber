import type {
  RepoIndexedDirectory,
  RepoIndexedFile,
  RepoIndexedSymbol,
  RepoIndex,
  RepoLanguage,
  RepoPackageBoundary,
} from './schema';

export type RepoMapTreeNode = {
  path: string;
  name: string;
  kind: 'directory' | 'file';
  depth: number;
  fileCount: number;
  totalSize: number;
  language?: RepoLanguage;
  isDocs?: boolean;
  packageName?: string;
  children: RepoMapTreeNode[];
};

export type RepoMapPackageSummary = {
  path: string;
  name: string;
  fileCount: number;
  docsFileCount: number;
  symbolCount: number;
  hasTsconfig: boolean;
  hasPackageJson: boolean;
};

export type RepoMapSymbolSummary = {
  name: string;
  kind: RepoIndexedSymbol['kind'];
  path: string;
  line: number;
};

export type RepoMapViewModel = {
  generatedAt: string;
  totals: {
    files: number;
    directories: number;
    symbols: number;
    docsFiles: number;
    packages: number;
    ignored: number;
    totalSize: number;
  };
  root: RepoMapTreeNode;
  packages: RepoMapPackageSummary[];
  topSymbols: RepoMapSymbolSummary[];
  recentFiles: RepoIndexedFile[];
  docsCoverage: {
    docsFiles: string[];
    codeFileCount: number;
    docsFileCount: number;
    docsRatio: number;
  };
};

export type RepoMapTreeFilterOptions = {
  query?: string;
  languages?: RepoLanguage[];
  packageNames?: string[];
};

export type RepoMapTreeFilterResult = {
  root: RepoMapTreeNode;
  matchedFileCount: number;
  matchedDirectoryCount: number;
  matchedPaths: string[];
};

export type RepoMapSymbolFilterResult = {
  symbols: RepoMapSymbolSummary[];
  matchedCount: number;
};

const ROOT_NODE_PATH = '';

const baseName = (path: string): string => path.split('/').filter(Boolean).at(-1) ?? path;

const directoryPath = (path: string): string => {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
};

const createDirectoryNode = (path: string, directory?: RepoIndexedDirectory): RepoMapTreeNode => ({
  path,
  name: path === ROOT_NODE_PATH ? 'Repository' : baseName(path),
  kind: 'directory',
  depth: path === ROOT_NODE_PATH ? 0 : path.split('/').length,
  fileCount: directory?.fileCount ?? 0,
  totalSize: directory?.totalSize ?? 0,
  children: [],
});

const sortTreeNodes = (nodes: RepoMapTreeNode[]): RepoMapTreeNode[] => nodes
  .sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name) || a.path.localeCompare(b.path);
  })
  .map((node) => ({ ...node, children: sortTreeNodes(node.children) }));

const buildTree = (index: RepoIndex): RepoMapTreeNode => {
  const directoriesByPath = new Map(index.directories.map((directory) => [directory.path, directory]));
  const nodes = new Map<string, RepoMapTreeNode>();
  const root = createDirectoryNode(ROOT_NODE_PATH, directoriesByPath.get(ROOT_NODE_PATH));
  nodes.set(ROOT_NODE_PATH, root);

  const ensureDirectory = (path: string): RepoMapTreeNode => {
    const existing = nodes.get(path);
    if (existing) return existing;

    const node = createDirectoryNode(path, directoriesByPath.get(path));
    nodes.set(path, node);
    const parent = ensureDirectory(directoryPath(path));
    parent.children.push(node);
    return node;
  };

  for (const directory of index.directories) {
    ensureDirectory(directory.path);
  }

  for (const file of index.files) {
    const parent = ensureDirectory(file.directory);
    parent.children.push({
      path: file.path,
      name: file.name,
      kind: 'file',
      depth: file.path.split('/').length,
      fileCount: 1,
      totalSize: file.size,
      language: file.language,
      isDocs: file.isDocs,
      packageName: file.packageName,
      children: [],
    });
  }

  return { ...root, children: sortTreeNodes(root.children) };
};

const isFileInsideBoundary = (file: RepoIndexedFile, boundary: RepoPackageBoundary): boolean => {
  if (!boundary.path) return !file.directory.includes('/');
  return file.path === boundary.path || file.path.startsWith(`${boundary.path}/`);
};

const buildPackageSummaries = (index: RepoIndex): RepoMapPackageSummary[] => index.packageBoundaries.map((boundary) => {
  const files = index.files.filter((file) => isFileInsideBoundary(file, boundary));
  const symbols = index.symbols.filter((symbol) => !boundary.path || symbol.path.startsWith(`${boundary.path}/`));
  return {
    path: boundary.path,
    name: boundary.name ?? (boundary.path || 'root'),
    fileCount: files.length,
    docsFileCount: files.filter((file) => file.isDocs).length,
    symbolCount: symbols.length,
    hasTsconfig: boundary.hasTsconfig,
    hasPackageJson: boundary.hasPackageJson,
  };
}).sort((a, b) => a.path.localeCompare(b.path));

const normalizeTreeFilterQuery = (query: string): string => query.trim().toLowerCase();

const normalizeFilterSet = (values: string[] | undefined): Set<string> => new Set(
  (values ?? [])
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean),
);

const getFilterOptions = (filter: string | RepoMapTreeFilterOptions): Required<Pick<RepoMapTreeFilterOptions, 'query'>> & Pick<RepoMapTreeFilterOptions, 'languages' | 'packageNames'> => (
  typeof filter === 'string' ? { query: filter } : { query: filter.query ?? '', languages: filter.languages, packageNames: filter.packageNames }
);

export const filterRepoMapTree = (root: RepoMapTreeNode, filter: string | RepoMapTreeFilterOptions): RepoMapTreeFilterResult => {
  const options = getFilterOptions(filter);
  const normalizedQuery = normalizeTreeFilterQuery(options.query);
  const languageFilter = normalizeFilterSet(options.languages);
  const packageFilter = normalizeFilterSet(options.packageNames);
  const hasLanguageFilter = languageFilter.size > 0;
  const hasPackageFilter = packageFilter.size > 0;
  if (!normalizedQuery && !hasLanguageFilter && !hasPackageFilter) {
    return {
      root,
      matchedFileCount: root.fileCount,
      matchedDirectoryCount: 0,
      matchedPaths: [],
    };
  }

  const matchedPaths: string[] = [];
  let matchedFileCount = 0;
  let matchedDirectoryCount = 0;

  const visit = (node: RepoMapTreeNode): RepoMapTreeNode | null => {
    const searchable = [node.name, node.path, node.language, node.packageName]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const queryMatches = !normalizedQuery || searchable.includes(normalizedQuery);
    const languageMatches = !hasLanguageFilter || (node.kind === 'file' && Boolean(node.language && languageFilter.has(node.language)));
    const packageMatches = !hasPackageFilter || (node.kind === 'file' && Boolean(node.packageName && packageFilter.has(node.packageName.toLowerCase())));
    const selfMatches = queryMatches && languageMatches && packageMatches;
    const filteredChildren = node.children
      .map(visit)
      .filter((child): child is RepoMapTreeNode => child !== null);

    if (!selfMatches && filteredChildren.length === 0) return null;

    if (selfMatches) {
      matchedPaths.push(node.path);
      if (node.kind === 'file') matchedFileCount += 1;
      else if (node.path) matchedDirectoryCount += 1;
    }

    return { ...node, children: filteredChildren };
  };

  return {
    root: visit(root) ?? { ...root, children: [], fileCount: 0, totalSize: 0 },
    matchedFileCount,
    matchedDirectoryCount,
    matchedPaths,
  };
};

export const filterRepoMapSymbols = (
  symbols: RepoMapSymbolSummary[],
  query: string,
  options: { limit?: number } = {},
): RepoMapSymbolFilterResult => {
  const normalizedQuery = normalizeTreeFilterQuery(query);
  const matchingSymbols = normalizedQuery
    ? symbols.filter((symbol) => {
      const searchable = [symbol.name, symbol.kind, symbol.path, String(symbol.line)]
        .join(' ')
        .toLowerCase();
      return normalizedQuery.split(/\s+/).every((token) => searchable.includes(token));
    })
    : symbols;
  return {
    symbols: matchingSymbols.slice(0, options.limit ?? 20),
    matchedCount: matchingSymbols.length,
  };
};

export const buildRepoMapViewModel = (index: RepoIndex, options: { maxSymbols?: number; maxRecentFiles?: number } = {}): RepoMapViewModel => {
  const maxSymbols = options.maxSymbols ?? 20;
  const maxRecentFiles = options.maxRecentFiles ?? 10;
  const totalSize = index.files.reduce((sum, file) => sum + file.size, 0);
  const docsFileCount = index.files.filter((file) => file.isDocs).length;
  const codeFileCount = index.files.length - docsFileCount;

  return {
    generatedAt: index.generatedAt,
    totals: {
      files: index.files.length,
      directories: index.directories.length,
      symbols: index.symbols.length,
      docsFiles: docsFileCount,
      packages: index.packageBoundaries.length,
      ignored: index.ignoredCount,
      totalSize,
    },
    root: buildTree(index),
    packages: buildPackageSummaries(index),
    topSymbols: index.symbols
      .slice()
      .sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line || a.name.localeCompare(b.name))
      .slice(0, maxSymbols),
    recentFiles: index.files
      .slice()
      .sort((a, b) => b.mtimeMs - a.mtimeMs || a.path.localeCompare(b.path))
      .slice(0, maxRecentFiles),
    docsCoverage: {
      docsFiles: index.docsFiles,
      codeFileCount,
      docsFileCount,
      docsRatio: index.files.length === 0 ? 0 : docsFileCount / index.files.length,
    },
  };
};
