import React from 'react';

import { Button } from '@/components/ui/button';
import { useRuntimeAPIs } from '@/hooks/useRuntimeAPIs';
import { buildRepositoryIndexFromFilesApi } from '@/lib/repoIndex/fromFilesApi';
import type { RepoMapTreeNode, RepoMapViewModel } from '@/lib/repoIndex/viewModel';
import { buildRepoMapViewModel } from '@/lib/repoIndex/viewModel';
import { cn } from '@/lib/utils';
import { useProjectsStore } from '@/stores/useProjectsStore';

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

type RepoMapMetricCardProps = {
  label: string;
  value: React.ReactNode;
  detail?: React.ReactNode;
};

const RepoMapMetricCard: React.FC<RepoMapMetricCardProps> = ({ label, value, detail }) => (
  <div className="rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-3">
    <p className="typography-meta text-muted-foreground">{label}</p>
    <p className="mt-1 typography-title font-semibold text-foreground">{value}</p>
    {detail ? <p className="mt-1 typography-meta text-muted-foreground">{detail}</p> : null}
  </div>
);

type RepoTreeProps = {
  node: RepoMapTreeNode;
  onOpenFile?: (path: string) => void;
};

const RepoTreeNodeRow: React.FC<RepoTreeProps> = ({ node, onOpenFile }) => {
  const isFile = node.kind === 'file';
  const isRoot = node.path === '';
  return (
    <li>
      <div
        className={cn(
          'flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5 typography-meta',
          isFile ? 'text-muted-foreground hover:bg-muted/50 hover:text-foreground' : 'text-foreground',
          isFile && onOpenFile ? 'cursor-pointer' : '',
        )}
        style={{ paddingLeft: `${Math.max(node.depth, isRoot ? 0 : node.depth - 1) * 12 + 8}px` }}
        onClick={() => {
          if (isFile) onOpenFile?.(node.path);
        }}
        role={isFile && onOpenFile ? 'button' : undefined}
        tabIndex={isFile && onOpenFile ? 0 : undefined}
        onKeyDown={(event) => {
          if (!isFile || !onOpenFile || (event.key !== 'Enter' && event.key !== ' ')) return;
          event.preventDefault();
          onOpenFile(node.path);
        }}
      >
        <span aria-hidden="true" className="shrink-0">{isFile ? '•' : '▾'}</span>
        <span className="truncate font-medium">{node.name}</span>
        {isFile && node.language ? <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">{node.language}</span> : null}
        {node.isDocs ? <span className="shrink-0 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] uppercase text-primary">docs</span> : null}
        <span className="ml-auto shrink-0 text-muted-foreground">{isFile ? formatBytes(node.totalSize) : `${node.fileCount} files`}</span>
      </div>
      {node.children.length > 0 ? (
        <ul className="space-y-0.5">
          {node.children.map((child) => (
            <RepoTreeNodeRow key={`${child.kind}:${child.path}`} node={child} onOpenFile={onOpenFile} />
          ))}
        </ul>
      ) : null}
    </li>
  );
};

type RepoMapContentProps = {
  viewModel: RepoMapViewModel;
  projectRoot: string;
  onOpenFile?: (path: string, line?: number) => void;
};

const RepoMapContent: React.FC<RepoMapContentProps> = ({ viewModel, projectRoot, onOpenFile }) => {
  const docsPercent = Math.round(viewModel.docsCoverage.docsRatio * 100);
  return (
    <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.7fr)]">
      <section className="min-h-0 rounded-xl border border-border/60 bg-background/60">
        <div className="border-b border-border/60 px-4 py-3">
          <h3 className="typography-ui-label font-semibold text-foreground">Repository tree</h3>
          <p className="typography-meta text-muted-foreground">{projectRoot || 'Active project'} · {formatBytes(viewModel.totals.totalSize)}</p>
        </div>
        <div className="max-h-[calc(100vh-260px)] overflow-auto p-2">
          <ul className="space-y-0.5">
            <RepoTreeNodeRow node={viewModel.root} onOpenFile={(path) => onOpenFile?.(path)} />
          </ul>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <RepoMapMetricCard label="Files" value={viewModel.totals.files} detail={`${viewModel.totals.directories} directories`} />
          <RepoMapMetricCard label="Symbols" value={viewModel.totals.symbols} detail={`${viewModel.totals.packages} packages`} />
          <RepoMapMetricCard label="Docs" value={`${docsPercent}%`} detail={`${viewModel.docsCoverage.docsFileCount} docs files`} />
          <RepoMapMetricCard label="Ignored" value={viewModel.totals.ignored} detail="index scan" />
        </div>

        <section className="rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-3">
          <h3 className="typography-ui-label font-semibold text-foreground">Packages</h3>
          <div className="mt-3 space-y-2">
            {viewModel.packages.length === 0 ? (
              <p className="typography-meta text-muted-foreground">No package boundaries found.</p>
            ) : viewModel.packages.map((entry) => (
              <div key={entry.path || 'root'} className="rounded-lg border border-border/50 bg-background/60 p-2">
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <p className="truncate typography-ui-label font-medium text-foreground">{entry.name}</p>
                  <p className="shrink-0 typography-meta text-muted-foreground">{entry.fileCount} files</p>
                </div>
                <p className="truncate typography-meta text-muted-foreground">{entry.path || 'root'} · {entry.symbolCount} symbols · {entry.docsFileCount} docs</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-3">
          <h3 className="typography-ui-label font-semibold text-foreground">Top symbols</h3>
          <div className="mt-3 space-y-1.5">
            {viewModel.topSymbols.length === 0 ? (
              <p className="typography-meta text-muted-foreground">No exported symbols indexed yet.</p>
            ) : viewModel.topSymbols.map((symbol) => (
              <button
                key={`${symbol.path}:${symbol.line}:${symbol.name}`}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                onClick={() => onOpenFile?.(symbol.path, symbol.line)}
              >
                <span className="block truncate typography-ui-label text-foreground">{symbol.name}</span>
                <span className="block truncate typography-meta text-muted-foreground">{symbol.kind} · {symbol.path}:{symbol.line}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-3">
          <h3 className="typography-ui-label font-semibold text-foreground">Recent files</h3>
          <div className="mt-3 space-y-1.5">
            {viewModel.recentFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                className="block w-full rounded-md px-2 py-1.5 text-left hover:bg-muted/50"
                onClick={() => onOpenFile?.(file.path)}
              >
                <span className="block truncate typography-ui-label text-foreground">{file.name}</span>
                <span className="block truncate typography-meta text-muted-foreground">{file.path} · {formatBytes(file.size)}</span>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
};

export const RepoMapView: React.FC = () => {
  const { files, editor } = useRuntimeAPIs();
  const activeProject = useProjectsStore((state) => state.getActiveProject());
  const projectRoot = activeProject?.path ?? '';
  const [viewModel, setViewModel] = React.useState<RepoMapViewModel | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    if (!projectRoot) {
      setViewModel(null);
      setError('Select a project to build its repo map.');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const index = await buildRepositoryIndexFromFilesApi(files, { directory: projectRoot, maxFiles: 2000 });
      setViewModel(buildRepoMapViewModel(index, { maxSymbols: 24, maxRecentFiles: 12 }));
    } catch (refreshError) {
      setViewModel(null);
      setError(refreshError instanceof Error ? refreshError.message : 'Failed to build repo map.');
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
          <h2 className="typography-title font-semibold text-foreground">Repo map</h2>
          <p className="typography-meta text-muted-foreground">
            {viewModel ? `${viewModel.totals.files} files · ${viewModel.totals.symbols} symbols · updated ${new Date(viewModel.generatedAt).toLocaleString()}` : 'Repository structure, packages, symbols, and docs coverage'}
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
          Building repo map…
        </div>
      ) : viewModel ? (
        <RepoMapContent viewModel={viewModel} projectRoot={projectRoot} onOpenFile={handleOpenFile} />
      ) : (
        <div className="m-4 rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-6 typography-meta text-muted-foreground">
          Select a project and refresh to build a repo map.
        </div>
      )}
    </div>
  );
};
