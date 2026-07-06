export type RepoLanguage =
  | 'typescript'
  | 'javascript'
  | 'json'
  | 'markdown'
  | 'css'
  | 'html'
  | 'python'
  | 'shell'
  | 'go'
  | 'rust'
  | 'other';

export type RepoSymbolKind = 'function' | 'class' | 'component' | 'type' | 'const';

export type RepoIndexInputFile = {
  path: string;
  size: number;
  mtimeMs: number;
  content?: string;
};

export type RepoIndexedFile = {
  path: string;
  name: string;
  directory: string;
  extension: string;
  language: RepoLanguage;
  size: number;
  mtimeMs: number;
  isDocs: boolean;
  packageName?: string;
};

export type RepoIndexedDirectory = {
  path: string;
  fileCount: number;
  totalSize: number;
};

export type RepoIndexedSymbol = {
  name: string;
  kind: RepoSymbolKind;
  path: string;
  line: number;
};

export type RepoPackageBoundary = {
  path: string;
  name?: string;
  hasTsconfig: boolean;
  hasPackageJson: boolean;
};

export type RepoDependencyEdge = {
  from: string;
  to: string;
  kind: 'workspace' | 'external';
};

export type RepoIndex = {
  generatedAt: string;
  files: RepoIndexedFile[];
  directories: RepoIndexedDirectory[];
  symbols: RepoIndexedSymbol[];
  docsFiles: string[];
  packageBoundaries: RepoPackageBoundary[];
  dependencyGraph: RepoDependencyEdge[];
  ignoredCount: number;
};
