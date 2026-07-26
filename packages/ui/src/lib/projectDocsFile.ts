import type { FilesAPI, RepoIndexScanFile } from '@/lib/api/types';
import type { RepoIndexedFile, RepoIndex, RepoIndexedSymbol } from '@/lib/repoIndex/schema';

export const PROJECT_DOCS_DIRECTORY = '.openchamber/repo-docs';
export const PROJECT_DOCS_MODULES_DIRECTORY = `${PROJECT_DOCS_DIRECTORY}/modules`;
export const PROJECT_DOCS_FILE_NAME = 'INDEX.md';

const normalizeRoot = (projectRoot: string): string => projectRoot.replace(/\\/g, '/').replace(/\/+$/, '');

const joinPath = (...parts: string[]): string => parts
  .filter((part) => part.length > 0)
  .map((part, index) => (index === 0 ? part.replace(/\/+$/, '') : part.replace(/^\/+|\/+$/g, '')))
  .join('/');

export const buildProjectDocsPath = (projectRoot: string): string => {
  const root = normalizeRoot(projectRoot.trim());
  return joinPath(root, PROJECT_DOCS_DIRECTORY, PROJECT_DOCS_FILE_NAME);
};

export const buildProjectDocsDirectoryPath = (projectRoot: string): string => {
  const root = normalizeRoot(projectRoot.trim());
  return joinPath(root, PROJECT_DOCS_DIRECTORY);
};

export const buildProjectDocsModulesDirectoryPath = (projectRoot: string): string => {
  const root = normalizeRoot(projectRoot.trim());
  return joinPath(root, PROJECT_DOCS_MODULES_DIRECTORY);
};

const listItems = (items: string[], empty = '- none detected'): string => (items.length ? items.map((item) => `- ${item}`).join('\n') : empty);

const sourceLanguages = new Set(['typescript', 'javascript', 'python', 'shell', 'go', 'rust', 'css', 'html']);

const isSourceFile = (file: RepoIndexedFile): boolean => !file.isDocs && sourceLanguages.has(file.language);

const moduleNameForPath = (path: string): string => {
  const clean = path.replace(/\\/g, '/').replace(/^\/+/, '');
  const [first, second] = clean.split('/');
  if (!first || !second) return 'root';
  if (first === 'packages' && second) return `packages/${second}`;
  if (first === 'apps' && second) return `apps/${second}`;
  return first;
};

const slugify = (value: string): string => value
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '') || 'root';

const firstNonEmptyLines = (content: string, maxLines = 4): string[] => content
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('*') && !line.startsWith('/*'))
  .slice(0, maxLines);

const extractMatches = (content: string, regex: RegExp, max = 12): string[] => {
  const values: string[] = [];
  for (const match of content.matchAll(regex)) {
    const value = match[1]?.trim();
    if (value && !values.includes(value)) values.push(value);
    if (values.length >= max) break;
  }
  return values;
};

const extractImportTargets = (content: string): string[] => {
  const imports = extractMatches(content, /^\s*import(?:\s+type)?[\s\S]*?\sfrom\s['"]([^'"]+)['"]/gm, 10);
  const requires = extractMatches(content, /require\(['"]([^'"]+)['"]\)/g, 6);
  return [...imports, ...requires].filter((value, index, all) => all.indexOf(value) === index).slice(0, 12);
};

const extractExportNames = (content: string): string[] => {
  const declarations = extractMatches(
    content,
    /^\s*export\s+(?:default\s+)?(?:abstract\s+)?(?:async\s+)?(?:function|class|const|let|var|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gm,
    16,
  );
  const namedExports = extractMatches(content, /^\s*export\s*\{([^}]+)\}/gm, 6)
    .flatMap((group) => group.split(',').map((name) => name.replace(/\s+as\s+.+$/, '').trim()))
    .filter(Boolean);
  return [...declarations, ...namedExports].filter((value, index, all) => all.indexOf(value) === index).slice(0, 20);
};

const detectResponsibilities = (file: RepoIndexedFile, content: string, symbols: RepoIndexedSymbol[]): string[] => {
  const hints: string[] = [];
  const lowerPath = file.path.toLowerCase();
  const lowerContent = content.toLowerCase();

  if (/\.test\.|\.spec\.|__tests__/.test(lowerPath)) hints.push('tests or verifies behavior');
  if (/react|jsx|tsx|usestate|useeffect/.test(lowerContent) || file.extension === '.tsx') hints.push('renders UI or React logic');
  if (/zustand|createstore|redux|store/.test(lowerContent) || lowerPath.includes('/stores/')) hints.push('manages client state');
  if (/fetch\(|runtimefetch|express|router\.|app\.(get|post|put|delete)|websocket/.test(lowerContent)) hints.push('talks to runtime/server APIs');
  if (/readfile|writefile|createdirectory|filesystem|\bfs\./.test(lowerContent)) hints.push('works with files or workspace persistence');
  if (/schema|interface |type |zod|validation/.test(lowerContent)) hints.push('defines types, schemas, or validation');
  if (/prompt|agent|opencode|session\.prompt|promptasync/.test(lowerContent)) hints.push('coordinates agent/prompt behavior');
  if (/git|commit|diff|branch/.test(lowerContent)) hints.push('handles Git/change workflows');
  if (/css|tailwind|className|style/.test(lowerContent)) hints.push('contains styling or layout behavior');
  if (symbols.length > 0) hints.push(`declares ${symbols.length} indexed symbol${symbols.length === 1 ? '' : 's'}`);

  return hints.filter((value, index, all) => all.indexOf(value) === index).slice(0, 6);
};

type FileDocContext = {
  file: RepoIndexedFile;
  scanFile?: RepoIndexScanFile;
  symbols: RepoIndexedSymbol[];
};

type ModuleDoc = {
  moduleName: string;
  path: string;
  markdown: string;
  fileCount: number;
};

export type ProjectDocsWrite = {
  path: string;
  content: string;
};

const renderFileSection = ({ file, scanFile, symbols }: FileDocContext): string => {
  const content = scanFile?.content ?? '';
  const imports = content ? extractImportTargets(content) : [];
  const exports = content ? extractExportNames(content) : [];
  const responsibilities = content ? detectResponsibilities(file, content, symbols) : [];
  const openingLines = content ? firstNonEmptyLines(content) : [];

  return [
    `### ${file.path}`,
    '',
    `- Language: ${file.language}`,
    `- Size: ${file.size} bytes`,
    file.packageName ? `- Package: ${file.packageName}` : null,
    symbols.length ? `- Symbols: ${symbols.slice(0, 12).map((symbol) => `${symbol.kind} ${symbol.name}`).join(', ')}` : '- Symbols: none indexed',
    responsibilities.length ? `- What it does: ${responsibilities.join('; ')}.` : '- What it does: content was unavailable or no strong code signals were detected.',
    imports.length ? `- Main dependencies: ${imports.join(', ')}` : null,
    exports.length ? `- Public exports: ${exports.join(', ')}` : null,
    openingLines.length ? `- Opening code signals: ${openingLines.map((line) => `\`${line.replace(/`/g, '\\`').slice(0, 160)}\``).join(' / ')}` : null,
    '',
  ].filter((line): line is string => line !== null).join('\n');
};

const buildFileContexts = (index: RepoIndex, scanFiles: RepoIndexScanFile[]): FileDocContext[] => {
  const scanByPath = new Map<string, RepoIndexScanFile>();
  for (const file of scanFiles) {
    scanByPath.set(file.relativePath || file.path, file);
  }

  return index.files
    .filter(isSourceFile)
    .map((file) => ({
      file,
      scanFile: scanByPath.get(file.path),
      symbols: index.symbols.filter((symbol) => symbol.path === file.path),
    }))
    .sort((a, b) => a.file.path.localeCompare(b.file.path));
};

const renderModuleDoc = (moduleName: string, contexts: FileDocContext[], generatedAt: string): string => {
  const languages = Array.from(new Set(contexts.map(({ file }) => file.language))).sort();
  const symbolCount = contexts.reduce((total, context) => total + context.symbols.length, 0);
  const filesWithContent = contexts.filter((context) => Boolean(context.scanFile?.content)).length;

  return [
    `# Module: ${moduleName}`,
    '',
    '<!-- Generated by DevChamber repository docs indexing. This file lives under .openchamber/repo-docs so extension-owned docs are inspectable and removable. -->',
    '',
    `Generated: ${new Date(generatedAt).toLocaleString()}`,
    '',
    '## Summary',
    '',
    `- Files documented: ${contexts.length}`,
    `- Files with scanned content: ${filesWithContent}`,
    `- Indexed symbols: ${symbolCount}`,
    `- Languages: ${languages.join(', ') || 'none'}`,
    '',
    '## Files',
    '',
    contexts.map(renderFileSection).join('\n'),
  ].join('\n');
};

const buildModuleDocs = (index: RepoIndex, scanFiles: RepoIndexScanFile[], projectRoot: string): ModuleDoc[] => {
  const contexts = buildFileContexts(index, scanFiles);
  const byModule = new Map<string, FileDocContext[]>();
  for (const context of contexts) {
    const moduleName = moduleNameForPath(context.file.path);
    const list = byModule.get(moduleName) ?? [];
    list.push(context);
    byModule.set(moduleName, list);
  }

  const modulesPath = buildProjectDocsModulesDirectoryPath(projectRoot);
  return Array.from(byModule.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([moduleName, moduleContexts]) => ({
      moduleName,
      path: joinPath(modulesPath, `${slugify(moduleName)}.md`),
      markdown: renderModuleDoc(moduleName, moduleContexts, index.generatedAt),
      fileCount: moduleContexts.length,
    }));
};

export const renderProjectDocsMarkdown = (index: RepoIndex, projectRoot: string, moduleDocs: ModuleDoc[] = []): string => {
  const generatedAt = new Date(index.generatedAt).toLocaleString();
  const docsFiles = index.files.filter((file) => file.isDocs).slice(0, 30).map((file) => file.path);
  const packages = index.packageBoundaries.slice(0, 30).map((pkg) => pkg.name || pkg.path || 'repo root');
  const sourceFiles = index.files.filter(isSourceFile);
  const largestSourceFiles = [...sourceFiles]
    .sort((a, b) => b.size - a.size)
    .slice(0, 30)
    .map((file) => `${file.path} (${file.language}, ${file.size} bytes)`);
  const symbols = index.symbols
    .slice(0, 80)
    .map((symbol) => `${symbol.kind} ${symbol.name} — ${symbol.path}:${symbol.line}`);
  const moduleItems = moduleDocs.map((moduleDoc) => `- [${moduleDoc.moduleName}](${moduleDoc.path.split('/').slice(-2).join('/')}) — ${moduleDoc.fileCount} files`);

  return [
    '# Project Docs Index',
    '',
    '<!-- Generated by DevChamber. Split repository docs are stored under .openchamber/repo-docs, the project-local extension folder. -->',
    '',
    `Workspace: ${projectRoot || 'current workspace'}`,
    `Generated: ${generatedAt}`,
    '',
    '## Repository scan',
    '',
    `- Files: ${index.files.length}`,
    `- Source files documented: ${sourceFiles.length}`,
    `- Directories: ${index.directories.length}`,
    `- Symbols: ${index.symbols.length}`,
    `- Existing docs files: ${index.docsFiles.length}`,
    `- Package boundaries: ${index.packageBoundaries.length}`,
    index.ignoredCount > 0 ? `- Ignored/skipped files: ${index.ignoredCount}` : null,
    '',
    '## Split module docs',
    '',
    listItems(moduleItems, '- no source modules detected'),
    '',
    '## Existing documentation',
    '',
    listItems(docsFiles),
    '',
    '## Main packages',
    '',
    listItems(packages),
    '',
    '## Source files to inspect first',
    '',
    listItems(largestSourceFiles),
    '',
    '## Indexed symbols sample',
    '',
    listItems(symbols),
    '',
    '## Agent instructions',
    '',
    'Improve these Markdown files into durable, user-facing project documentation. Keep the split-by-module structure, add concrete explanations of what files/modules do internally, and update this index when module docs change.',
    '',
  ].filter((line): line is string => line !== null).join('\n');
};

const buildProjectDocsWrites = (index: RepoIndex, scanFiles: RepoIndexScanFile[], projectRoot: string): ProjectDocsWrite[] => {
  const moduleDocs = buildModuleDocs(index, scanFiles, projectRoot);
  return [
    { path: buildProjectDocsPath(projectRoot), content: renderProjectDocsMarkdown(index, projectRoot, moduleDocs) },
    ...moduleDocs.map((moduleDoc) => ({ path: moduleDoc.path, content: moduleDoc.markdown })),
  ];
};

export const saveProjectDocsFile = async ({
  files,
  index,
  projectRoot,
}: {
  files: Pick<FilesAPI, 'createDirectory' | 'writeFile' | 'scanRepoIndex'>;
  index: RepoIndex;
  projectRoot: string;
}): Promise<{ path: string; paths: string[] }> => {
  if (!files.writeFile) {
    throw new Error('Project docs persistence is not available in this runtime.');
  }

  const scan = files.scanRepoIndex
    ? await files.scanRepoIndex({
      directory: projectRoot,
      maxFiles: 2500,
      maxFileSize: 80_000,
      includeContent: true,
      respectGitignore: true,
    })
    : { files: [] };

  const directory = buildProjectDocsDirectoryPath(projectRoot);
  const modulesDirectory = buildProjectDocsModulesDirectoryPath(projectRoot);
  if (files.createDirectory) {
    await files.createDirectory(directory);
    await files.createDirectory(modulesDirectory);
  }

  const writes = buildProjectDocsWrites(index, scan.files, projectRoot);
  for (const write of writes) {
    await files.writeFile(write.path, write.content);
  }

  return { path: buildProjectDocsPath(projectRoot), paths: writes.map((write) => write.path) };
};
