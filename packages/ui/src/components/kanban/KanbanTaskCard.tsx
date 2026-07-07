import React from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KanbanBoard, KanbanTask, KanbanTaskStatus } from '@/lib/kanban/schema';
import { getAdjacentKanbanStatus } from '@/lib/kanban/viewModel';

const PRIORITY_CLASSES: Record<'low' | 'medium' | 'high', string> = {
  low: 'border-[color-mix(in_srgb,var(--status-info)_25%,transparent)] text-[var(--status-info)]',
  medium: 'border-[color-mix(in_srgb,var(--status-warning)_30%,transparent)] text-[var(--status-warning)]',
  high: 'border-[color-mix(in_srgb,var(--status-error)_30%,transparent)] text-[var(--status-error)]',
};

type KanbanTaskCardProps = {
  board: KanbanBoard;
  task: KanbanTask;
  onEditTask?: (task: KanbanTask) => void;
  onAttachChangedFiles?: (task: KanbanTask) => void;
  onCreateBranch?: (task: KanbanTask) => void;
  onMoveTask?: (taskId: string, status: KanbanTaskStatus) => void;
};

export const KanbanTaskCard: React.FC<KanbanTaskCardProps> = ({ board, task, onEditTask, onAttachChangedFiles, onCreateBranch, onMoveTask }) => {
  const previousStatus = getAdjacentKanbanStatus(board, task.status, 'previous');
  const nextStatus = getAdjacentKanbanStatus(board, task.status, 'next');

  return (
    <article className="rounded-lg border border-border/60 bg-background/80 p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="break-words typography-ui-label font-medium text-foreground">{task.title}</h4>
          {task.description ? <p className="mt-1 line-clamp-3 typography-meta text-muted-foreground">{task.description}</p> : null}
        </div>
        {task.priority ? (
          <span className={cn('shrink-0 rounded-full border px-1.5 py-0.5 typography-micro font-medium', PRIORITY_CLASSES[task.priority])}>
            {task.priority}
          </span>
        ) : null}
      </div>

      {task.blockedReason ? (
        <div className="mt-2 rounded-md border border-[color-mix(in_srgb,var(--status-warning)_25%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_8%,transparent)] px-2 py-1 typography-meta text-[var(--status-warning)]">
          {task.blockedReason}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-1.5">
        {task.branch ? <span className="rounded bg-muted px-1.5 py-0.5 typography-micro text-muted-foreground">{task.branch}</span> : null}
        {task.assignee ? <span className="rounded bg-muted px-1.5 py-0.5 typography-micro text-muted-foreground">{task.assignee}</span> : null}
        {task.filePaths.slice(0, 2).map((path) => (
          <span key={path} className="max-w-full truncate rounded bg-muted px-1.5 py-0.5 typography-micro text-muted-foreground" title={path}>{path}</span>
        ))}
        {task.filePaths.length > 2 ? <span className="rounded bg-muted px-1.5 py-0.5 typography-micro text-muted-foreground">+{task.filePaths.length - 2} files</span> : null}
      </div>

      {onMoveTask || onEditTask || onAttachChangedFiles || onCreateBranch ? (
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {onEditTask ? (
              <Button size="xs" variant="ghost" onClick={() => onEditTask(task)}>
                Edit
              </Button>
            ) : null}
            {onAttachChangedFiles ? (
              <Button size="xs" variant="ghost" onClick={() => onAttachChangedFiles(task)}>
                Attach changes
              </Button>
            ) : null}
            {onCreateBranch ? (
              <Button size="xs" variant="ghost" disabled={Boolean(task.branch)} onClick={() => onCreateBranch(task)}>
                {task.branch ? 'Branched' : 'Create branch'}
              </Button>
            ) : null}
          </div>
          {onMoveTask ? (
            <div className="flex items-center gap-1.5">
              {task.status !== 'blocked' ? (
                <Button size="xs" variant="ghost" onClick={() => onMoveTask(task.id, 'blocked')}>
                  Block
                </Button>
              ) : null}
              <Button size="xs" variant="ghost" disabled={!previousStatus} onClick={() => previousStatus && onMoveTask(task.id, previousStatus)}>
                ← Move
              </Button>
              <Button size="xs" variant="ghost" disabled={!nextStatus} onClick={() => nextStatus && onMoveTask(task.id, nextStatus)}>
                Move →
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
};
