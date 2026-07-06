import React from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/icon/Icon';
import type { DocsCommitStatus } from '@/lib/changeExplanations/docsStatus';

type DocsRequiredBannerProps = {
  status: DocsCommitStatus;
  notNeededReason: string;
  onNotNeededReasonChange: (reason: string) => void;
};

const MAX_VISIBLE_PATHS = 4;

export const DocsRequiredBanner: React.FC<DocsRequiredBannerProps> = ({
  status,
  notNeededReason,
  onNotNeededReasonChange,
}) => {
  if (!status.hasCodeChanges || status.hasDocsChanges || !status.docsRequired) {
    return null;
  }

  const trimmedReason = notNeededReason.trim();
  const visiblePaths = status.codePaths.slice(0, MAX_VISIBLE_PATHS);
  const hiddenPathCount = Math.max(0, status.codePaths.length - visiblePaths.length);

  return (
    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
      <div className="flex items-start gap-2">
        <Icon name="alert" className="mt-0.5 size-4 shrink-0 text-amber-500" />
        <div className="min-w-0 flex-1 space-y-2">
          <div>
            <div className="font-medium">Documentation decision required</div>
            <p className="text-muted-foreground">
              Staged code changes do not include docs. Update docs or explain why documentation is not needed before committing.
            </p>
          </div>

          <div className="rounded-sm bg-background/70 p-2 typography-meta text-muted-foreground">
            <div className="mb-1 font-medium text-foreground">Code changes</div>
            <ul className="space-y-1">
              {visiblePaths.map((path) => (
                <li key={path} className="truncate">{path}</li>
              ))}
              {hiddenPathCount > 0 ? <li>+{hiddenPathCount} more</li> : null}
            </ul>
          </div>

          <label className="block space-y-1">
            <span className="typography-meta font-medium text-foreground">Mark docs not needed</span>
            <textarea
              value={notNeededReason}
              onChange={(event) => onNotNeededReasonChange(event.target.value)}
              placeholder="Reason, e.g. internal-only refactor with no user-facing behavior change"
              className="min-h-16 w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
          </label>

          {trimmedReason ? (
            <div className="flex items-center gap-2 typography-meta text-emerald-600 dark:text-emerald-400">
              <Icon name="check" className="size-3.5" />
              Commit unblocked with a manual docs-not-needed reason.
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 typography-meta text-muted-foreground">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onNotNeededReasonChange('No documentation update needed: internal-only change with no user-facing behavior impact.')}
              >
                Use internal-only reason
              </Button>
              Commit is blocked until this checklist is resolved.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
