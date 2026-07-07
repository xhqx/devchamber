import React from 'react';

import { KanbanColumn } from '@/components/kanban/KanbanColumn';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { KanbanBoard, KanbanTask, KanbanTaskStatus } from '@/lib/kanban/schema';
import { buildKanbanBoardViewModel } from '@/lib/kanban/viewModel';

type KanbanViewProps = {
  board: KanbanBoard;
  className?: string;
  isLoading?: boolean;
  error?: string | null;
  onCreateTask?: () => void;
  onEditTask?: (task: KanbanTask) => void;
  onAttachChangedFiles?: (task: KanbanTask) => void;
  onMoveTask?: (taskId: string, status: KanbanTaskStatus) => void;
  onRefresh?: () => void;
};

export const KanbanView: React.FC<KanbanViewProps> = ({
  board,
  className,
  isLoading = false,
  error = null,
  onCreateTask,
  onEditTask,
  onAttachChangedFiles,
  onMoveTask,
  onRefresh,
}) => {
  const viewModel = React.useMemo(() => buildKanbanBoardViewModel(board), [board]);

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background text-foreground', className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <h2 className="typography-title font-semibold text-foreground">Project board</h2>
          <p className="typography-meta text-muted-foreground">
            {viewModel.taskCount} tasks · updated {viewModel.updatedAt}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {onRefresh ? <Button size="sm" variant="outline" onClick={onRefresh} disabled={isLoading}>Refresh</Button> : null}
          {onCreateTask ? <Button size="sm" onClick={onCreateTask}>New task</Button> : null}
        </div>
      </header>

      {error ? (
        <div className="mx-4 mt-3 rounded-md border border-[color-mix(in_srgb,var(--status-error)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-error)_8%,transparent)] px-3 py-2 text-sm text-[var(--status-error)]">
          {error}
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-x-auto p-4">
        {isLoading ? (
          <div className="rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 p-6 typography-meta text-muted-foreground">
            Loading project board…
          </div>
        ) : (
          <div className="flex min-h-full gap-3">
            {viewModel.columns.map((column) => (
              <KanbanColumn
                key={column.id}
                board={board}
                column={column}
                onEditTask={onEditTask}
                onAttachChangedFiles={onAttachChangedFiles}
                onMoveTask={onMoveTask}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
