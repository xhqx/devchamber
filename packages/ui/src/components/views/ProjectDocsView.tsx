import React from 'react';

import { Button } from '@/components/ui/button';
import { useRuntimeAPIs } from '@/hooks/useRuntimeAPIs';
import { useEffectiveDirectory } from '@/hooks/useEffectiveDirectory';
import { buildRepositoryIndexFromFilesApi } from '@/lib/repoIndex/fromFilesApi';
import type { RepoIndexedSymbol, RepoIndex, RepoLanguage } from '@/lib/repoIndex/schema';
import { buildRepoMapViewModel } from '@/lib/repoIndex/viewModel';
import { cn } from '@/lib/utils';

const formatBytes = (value: number): string => {
  if (value < 1024) return `${value} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = value / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const joinProjectPath = (projectRoot: string, relativePath: string): string => {
  if (!projectRoot) return relativePath;
  if (!relativePath) return projectRoot;
  return `${projectRoot.replace(/\/+$/, '')}/${relativePath.replace(/^\/+/, '')}`;
};

const bySizeDesc = (a: { size: number }, b: { size: number }) => b.size - a.size;

type ProjectPackageSummary = {
  name: string;
  path: string;
  fileCount: number;
  symbolCount: number;
  docsFileCount: number;
};

const bySymbolsDesc = (a: ProjectPackageSummary, b: ProjectPackageSummary) => b.symbolCount - a.symbolCount;

const isHumanReadableDocsFile = (file: RepoIndex['files'][number]): boolean => {
  if (file.isDocs) return true;
  return /(^|\/)(readme|architecture|contributing|docs?|overview|guide|manual|adr)(\.|\/|$)/i.test(file.path);
};

const summarizeLanguages = (files: RepoIndex['files']): Array<{ language: RepoLanguage; count: number; size: number }> => {
  const byLanguage = new Map<RepoLanguage, { language: RepoLanguage; count: number; size: number }>();
  for (const file of files) {
    const current = byLanguage.get(file.language) ?? { language: file.language, count: 0, size: 0 };
    current.count += 1;
    current.size += file.size;
    byLanguage.set(file.language, current);
  }
  return Array.from(byLanguage.values()).sort((a, b) => b.count - a.count);
};

const groupSymbolsByPath = (symbols: RepoIndexedSymbol[]): Array<{ path: string; symbols: RepoIndexedSymbol[] }> => {
  const byPath = new Map<string, RepoIndexedSymbol[]>();
  for (const symbol of symbols) {
    const list = byPath.get(symbol.path) ?? [];
    list.push(symbol);
    byPath.set(symbol.path, list);
  }
  return Array.from(byPath.entries())
    .map(([path, grouped]) => ({ path, symbols: grouped }))
    .sort((a, b) => b.symbols.length - a.symbols.length);
};

type ProjectDocsContentProps = {
  index: RepoIndex;
  projectRoot: string;
  onOpenFile?: (path: string, line?: number) => void;
  onGenerateDocs?: (index: RepoIndex) => void;
};

const ProjectDocsContent: React.FC<ProjectDocsContentProps> = ({ index, projectRoot, onOpenFile, onGenerateDocs }) => {
  const repoMap = React.useMemo(() => buildRepoMapViewModel(index, { maxSymbols: 80, maxRecentFiles: 8 }), [index]);
  const docsFiles = React.useMemo(() => index.files.filter(isHumanReadableDocsFile).slice(0, 12), [index.files]);
  const largestFiles = React.useMemo(() => [...index.files].sort(bySizeDesc).slice(0, 8), [index.files]);
  const packageSummaries = React.useMemo(() => [...repoMap.packages].sort(bySymbolsDesc).slice(0, 8), [repoMap.packages]);
  const symbolHotspots = React.useMemo(() => groupSymbolsByPath(index.symbols).slice(0, 8), [index.symbols]);
  const languageSummaries = React.useMemo(() => summarizeLanguages(index.files), [index.files]);
  const docsPercent = Math.round(repoMap.docsCoverage.docsRatio * 100);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      <div className="mx-auto max-w-5xl space-y-4">
        <section className="rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="typography-meta uppercase tracking-wide text-muted-foreground">Project briefing</p>
              <h2 className="mt-1 typography-title font-semibold text-foreground">What this project contains</h2>
              <p className="mt-2 typography-ui-body text-muted-foreground">
                DevChamber scanned the workspace and turned the repository structure into a readable overview for the user.
              </p>
              <p className="mt-1 truncate typography-meta text-muted-foreground" title={projectRoot}>{projectRoot}</p>
            </div>
            <div className="grid min-w-[260px] grid-cols-2 gap-2">
              <Metric label="Files" value={index.files.length} />
              <Metric label="Packages" value={repoMap.packages.length} />
              <Metric label="Symbols" value={index.symbols.length} />
              <Metric label="Docs" value={`${docsPercent}%`} />
            </div>
            {onGenerateDocs ? (
              <Button size="sm" onClick={() => onGenerateDocs(index)}>
                Generate docs with agent
              </Button>
            ) : null}
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="space-y-4">
            <Panel title="Existing readable docs" subtitle="README, docs, guides, architecture notes, and similar files found in the repo.">
              {docsFiles.length === 0 ? (
                <EmptyText>No obvious documentation files found. This project needs generated docs first.</EmptyText>
              ) : (
                <div className="space-y-2">
                  {docsFiles.map((file) => (
                    <FileButton key={file.path} file={file} onOpen={() => onOpenFile?.(file.path)} />
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Main code areas" subtitle="Packages and folders with the most indexed symbols.">
              {packageSummaries.length === 0 ? (
                <EmptyText>No package boundaries found yet.</EmptyText>
              ) : (
                <div className="space-y-2">
                  {packageSummaries.map((pkg) => (
                    <div key={pkg.path || 'root'} className="rounded-lg border border-border/50 bg-background/60 p-3">
                      <div className="flex min-w-0 items-center justify-between gap-3">
                        <p className="truncate typography-ui-label font-semibold text-foreground">{pkg.name}</p>
                        <p className="shrink-0 typography-meta text-muted-foreground">{pkg.fileCount} files</p>
                      </div>
                      <p className="mt-1 truncate typography-meta text-muted-foreground">{pkg.path || 'repo root'} · {pkg.symbolCount} symbols · {pkg.docsFileCount} docs files</p>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Symbol hotspots" subtitle="Files that define many classes, functions, types, or exports.">
              {symbolHotspots.length === 0 ? (
                <EmptyText>No symbols were extracted from supported source files.</EmptyText>
              ) : (
                <div className="space-y-2">
                  {symbolHotspots.map((entry) => (
                    <button
                      key={entry.path}
                      type="button"
                      className="block w-full rounded-lg border border-border/50 bg-background/60 p-3 text-left transition-colors hover:bg-muted/50"
                      onClick={() => onOpenFile?.(entry.path, entry.symbols[0]?.line)}
                    >
                      <span className="block truncate typography-ui-label font-semibold text-foreground">{entry.path}</span>
                      <span className="mt-1 block typography-meta text-muted-foreground">
                        {entry.symbols.length} symbols: {entry.symbols.slice(0, 5).map((symbol) => symbol.name).join(', ')}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
          </section>

          <aside className="space-y-4">
            <Panel title="Composition" compact>
              <div className="space-y-2">
                {languageSummaries.map((entry) => (
                  <div key={entry.language} className="flex items-center justify-between gap-3 rounded-md bg-background/60 px-2 py-1.5 typography-meta">
                    <span className="capitalize text-foreground">{entry.language}</span>
                    <span className="text-muted-foreground">{entry.count} · {formatBytes(entry.size)}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="Large files" compact>
              <div className="space-y-1.5">
                {largestFiles.map((file) => (
                  <FileButton key={file.path} file={file} compact onOpen={() => onOpenFile?.(file.path)} />
                ))}
              </div>
            </Panel>

            <Panel title="How to use this" compact>
              <ul className="space-y-2 typography-meta text-muted-foreground">
                <li>• Use Docs for a readable project briefing.</li>
                <li>• Use Project map for navigation and detailed tree/symbol search.</li>
                <li>• Open a file from either view, then ask the agent to document or explain that area.</li>
              </ul>
            </Panel>
          </aside>
        </div>
      </div>
    </div>
  );
};

const Metric: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="rounded-lg border border-border/60 bg-background/60 p-3">
    <p className="typography-meta text-muted-foreground">{label}</p>
    <p className="mt-1 typography-ui-header font-semibold text-foreground">{value}</p>
  </div>
);

const Panel: React.FC<{ title: string; subtitle?: string; compact?: boolean; children: React.ReactNode }> = ({ title, subtitle, compact, children }) => (
  <section className={cn('rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60', compact ? 'p-3' : 'p-4')}>
    <div className="mb-3">
      <h3 className="typography-ui-label font-semibold text-foreground">{title}</h3>
      {subtitle ? <p className="mt-1 typography-meta text-muted-foreground">{subtitle}</p> : null}
    </div>
    {children}
  </section>
);

const EmptyText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="rounded-lg border border-border/50 bg-background/60 p-3 typography-meta text-muted-foreground">{children}</p>
);

const FileButton: React.FC<{ file: RepoIndex['files'][number]; compact?: boolean; onOpen: () => void }> = ({ file, compact, onOpen }) => (
  <button
    type="button"
    className={cn(
      'block w-full rounded-lg border border-border/50 bg-background/60 text-left transition-colors hover:bg-muted/50',
      compact ? 'px-2 py-1.5' : 'p-3',
    )}
    onClick={onOpen}
  >
    <span className="block truncate typography-ui-label font-medium text-foreground">{file.path}</span>
    <span className="mt-1 block typography-meta text-muted-foreground">{file.language}{file.isDocs ? ' docs' : ''} · {formatBytes(file.size)}</span>
  </button>
);

export type ProjectDocsViewProps = {
  onGenerateDocs?: (index: RepoIndex) => void;
};

export const ProjectDocsView: React.FC<ProjectDocsViewProps> = ({ onGenerateDocs }) => {
  const { files, editor } = useRuntimeAPIs();
  const effectiveDirectory = useEffectiveDirectory();
  const projectRoot = effectiveDirectory ?? '';
  const [index, setIndex] = React.useState<RepoIndex | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!projectRoot) {
      setIndex(null);
      setError('Open a workspace folder to build project docs.');
      return;
    }
    if (!files.scanRepoIndex) {
      setIndex(null);
      setError('Project scanning is not available in this runtime. Open DevChamber from the VS Code extension to build docs.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const nextIndex = await buildRepositoryIndexFromFilesApi(files, { directory: projectRoot, maxFiles: 2500 });
      setIndex(nextIndex);
    } catch (refreshError) {
      setIndex(null);
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to scan this project.');
    } finally {
      setIsLoading(false);
    }
  }, [files, projectRoot]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleOpenFile = React.useCallback((path: string, line?: number) => {
    if (!editor?.openFile) return;
    void editor.openFile(joinProjectPath(projectRoot, path), line);
  }, [editor, projectRoot]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background text-foreground">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h2 className="typography-title font-semibold text-foreground">Project docs</h2>
          <p className="typography-meta text-muted-foreground">
            {index ? `${index.files.length} files scanned · updated ${new Date(index.generatedAt).toLocaleString()}` : 'Readable project overview from the repository scan'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={refresh} disabled={isLoading}>Refresh</Button>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-md border border-[color-mix(in_srgb,var(--status-error)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-error)_8%,transparent)] px-3 py-2 text-sm text-[var(--status-error)]">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="m-4 rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-6 typography-meta text-muted-foreground">
          Scanning project and preparing readable docs…
        </div>
      ) : index ? (
        <ProjectDocsContent index={index} projectRoot={projectRoot} onOpenFile={handleOpenFile} onGenerateDocs={onGenerateDocs} />
      ) : (
        <div className="m-4 rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-6 typography-meta text-muted-foreground">
          Open a workspace folder and refresh to build project docs.
        </div>
      )}
    </div>
  );
};
