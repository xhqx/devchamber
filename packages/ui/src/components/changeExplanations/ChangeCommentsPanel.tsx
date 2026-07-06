import React from 'react';

import { Icon } from '@/components/icon/Icon';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ChangeExplanation } from '@/lib/changeExplanations/schema';
import { groupChangeCommentsByFile, normalizeChangeCommentPath, type ChangeCommentStatus } from './changeCommentGroups';

export type ChangeCommentPanelAction = 'accept' | 'edit' | 'create-docs-patch' | 'mark-not-needed';

type ChangeCommentsPanelProps = {
  explanations: ChangeExplanation[];
  filePaths?: string[];
  selectedFilePath?: string | null;
  compact?: boolean;
  className?: string;
  isSavingNotes?: boolean;
  onSelectFile?: (filePath: string) => void;
  onAction?: (action: ChangeCommentPanelAction, explanation: ChangeExplanation) => void;
  onSaveNotes?: () => void;
  editingExplanationId?: string | null;
  editingText?: string;
  onEditingTextChange?: (value: string) => void;
  onSaveEdit?: (explanation: ChangeExplanation, value: string) => void;
  onCancelEdit?: () => void;
};

const STATUS_LABELS: Record<ChangeCommentStatus, string> = {
  'docs-updated': 'docs updated',
  'docs-missing': 'docs missing',
  accepted: 'accepted',
  'needs-revision': 'needs revision',
};

const STATUS_CLASSES: Record<ChangeCommentStatus, string> = {
  'docs-updated': 'border-[color-mix(in_srgb,var(--status-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-success)_12%,transparent)] text-[var(--status-success)]',
  'docs-missing': 'border-[color-mix(in_srgb,var(--status-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_12%,transparent)] text-[var(--status-warning)]',
  accepted: 'border-[color-mix(in_srgb,var(--status-info)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-info)_12%,transparent)] text-[var(--status-info)]',
  'needs-revision': 'border-[color-mix(in_srgb,var(--status-error)_35%,transparent)] bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] text-[var(--status-error)]',
};

const StatusChip: React.FC<{ status: ChangeCommentStatus }> = ({ status }) => (
  <span className={cn('rounded-full border px-1.5 py-0.5 typography-micro font-medium', STATUS_CLASSES[status])}>
    {STATUS_LABELS[status]}
  </span>
);

const formatRange = (explanation: ChangeExplanation): string | null => {
  if (!explanation.range) return null;
  if (explanation.range.startLine === explanation.range.endLine) {
    return `L${explanation.range.startLine}`;
  }
  return `L${explanation.range.startLine}-L${explanation.range.endLine}`;
};

export const ChangeCommentsPanel: React.FC<ChangeCommentsPanelProps> = ({
  explanations,
  filePaths = [],
  selectedFilePath = null,
  compact = false,
  className,
  isSavingNotes = false,
  onSelectFile,
  onAction,
  onSaveNotes,
  editingExplanationId = null,
  editingText = '',
  onEditingTextChange,
  onSaveEdit,
  onCancelEdit,
}) => {
  const groups = React.useMemo(() => groupChangeCommentsByFile(explanations, filePaths), [explanations, filePaths]);

  if (groups.length === 0) {
    return (
      <aside className={cn('rounded-xl border border-border/60 bg-background/70 p-3 text-sm', className)}>
        <div className="flex items-center gap-2 font-medium text-foreground">
          <Icon name="chat-3" className="size-4 text-muted-foreground" />
          Change explanations
        </div>
        <p className="mt-2 typography-meta text-muted-foreground">
          No generated explanations yet. Once agent change notes exist, they will appear here grouped by file.
        </p>
      </aside>
    );
  }

  return (
    <aside className={cn('rounded-xl border border-border/60 bg-background/70 text-sm', className)}>
      <div className="flex items-center justify-between gap-2 border-b border-border/40 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2 font-medium text-foreground">
          <Icon name="chat-3" className="size-4 text-muted-foreground" />
          <span className="truncate">Change explanations</span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onSaveNotes ? (
            <Button size="xs" variant="ghost" onClick={onSaveNotes} disabled={isSavingNotes}>
              {isSavingNotes ? 'Saving…' : 'Save notes'}
            </Button>
          ) : null}
          <span className="typography-meta text-muted-foreground">{explanations.length}</span>
        </div>
      </div>
      <div className={cn('space-y-3 p-3', compact ? 'max-h-64 overflow-auto' : 'overflow-auto')}>
        {groups.map((group) => {
          const isSelected = selectedFilePath ? normalizeChangeCommentPath(selectedFilePath) === group.filePath : false;
          return (
            <section key={group.filePath} className={cn('rounded-lg border border-border/50 bg-[var(--surface-elevated)]/60 p-2', isSelected && 'border-primary/50')}>
              <button
                type="button"
                className="flex w-full min-w-0 items-center justify-between gap-2 text-left"
                onClick={() => onSelectFile?.(group.filePath)}
              >
                <span className="min-w-0 truncate typography-ui-label font-medium text-foreground" title={group.filePath}>
                  {group.filePath}
                </span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {group.statuses.map((status) => <StatusChip key={status} status={status} />)}
                </span>
              </button>
              <div className="mt-2 space-y-2">
                {group.explanations.map((explanation) => {
                  const isEditing = editingExplanationId === explanation.id;
                  return (
                    <article key={explanation.id} className="rounded-md border border-border/40 bg-background/70 p-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {formatRange(explanation) ? (
                              <span className="typography-micro text-muted-foreground">{formatRange(explanation)}</span>
                            ) : null}
                            <span className="typography-micro uppercase text-muted-foreground">{explanation.changeKind}</span>
                          </div>
                          <p className="mt-1 typography-ui-label font-medium text-foreground">{explanation.summary}</p>
                        </div>
                      </div>
                      {isEditing ? (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={editingText}
                            onChange={(event) => onEditingTextChange?.(event.target.value)}
                            className="min-h-20 text-sm"
                          />
                          <div className="flex justify-end gap-1">
                            <Button size="xs" variant="ghost" onClick={onCancelEdit}>Cancel</Button>
                            <Button size="xs" onClick={() => onSaveEdit?.(explanation, editingText)}>Save</Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="mt-1 typography-meta text-muted-foreground">{explanation.why}</p>
                          {explanation.risks.length > 0 ? (
                            <ul className="mt-2 list-disc space-y-1 pl-4 typography-meta text-muted-foreground">
                              {explanation.risks.map((risk) => <li key={risk}>{risk}</li>)}
                            </ul>
                          ) : null}
                          {explanation.docsPaths.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {explanation.docsPaths.map((path) => (
                                <span key={path} className="rounded bg-muted px-1.5 py-0.5 typography-micro text-muted-foreground">{path}</span>
                              ))}
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap gap-1">
                            <Button size="xs" variant="ghost" onClick={() => onAction?.('accept', explanation)}>Accept</Button>
                            <Button size="xs" variant="ghost" onClick={() => onAction?.('edit', explanation)}>Edit</Button>
                            <Button size="xs" variant="ghost" onClick={() => onAction?.('create-docs-patch', explanation)}>Create docs patch</Button>
                            <Button size="xs" variant="ghost" onClick={() => onAction?.('mark-not-needed', explanation)}>Mark not needed</Button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
};
