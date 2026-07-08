import React from 'react';

import { cn } from '@/lib/utils';
import type { KanbanBoard, KanbanTask, KanbanTaskStatus } from '@/lib/kanban/schema';
import type { KanbanColumnViewModel } from '@/lib/kanban/viewModel';
import { KanbanTaskCard } from './KanbanTaskCard';

type KanbanColumnProps = {
  board: KanbanBoard;
  column: KanbanColumnViewModel;
  activeDragTaskId?: string | null;
  pendingTaskIds?: Set<string>;
  onEditTask?: (task: KanbanTask) => void;
  currentSessionId?: string | null;
  onAttachCurrentSession?: (task: KanbanTask) => void;
  onAttachChangedFiles?: (task: KanbanTask) => void;
  onCreateBranch?: (task: KanbanTask) => void;
  onMoveTask?: (taskId: string, status: KanbanTaskStatus) => void;
  onTaskDragStart?: (taskId: string) => void;
  onTaskDragEnd?: () => void;
};

export const KanbanColumn: React.FC<KanbanColumnProps> = ({ board, column, activeDragTaskId = null, pendingTaskIds, onEditTask, currentSessionId, onAttachCurrentSession, onAttachChangedFiles, onCreateBranch, onMoveTask, onTaskDragStart, onTaskDragEnd }) => {
  const canDropActiveTask = Boolean(activeDragTaskId && board.tasks.find((task) => task.id === activeDragTaskId)?.status !== column.id);

  return (
    <section
      className={cn(
        'flex min-h-0 min-w-[17rem] flex-1 flex-col rounded-xl border border-border/60 bg-[var(--surface-elevated)]/60 transition-colors',
        canDropActiveTask ? 'border-primary/50 bg-primary/5' : '',
      )}
      onDragOver={(event) => {
        if (!canDropActiveTask) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      }}
      onDrop={(event) => {
        const taskId = event.dataTransfer.getData('text/plain') || activeDragTaskId;
        if (!taskId || !canDropActiveTask) return;
        event.preventDefault();
        onMoveTask?.(taskId, column.id);
        onTaskDragEnd?.();
      }}
    >
    <header className="border-b border-border/50 px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate typography-ui-label font-semibold text-foreground">{column.title}</h3>
          {column.description ? <p className="mt-0.5 line-clamp-2 typography-meta text-muted-foreground">{column.description}</p> : null}
        </div>
        <span className={cn(
          'shrink-0 rounded-full border px-2 py-0.5 typography-micro font-medium',
          column.isOverLimit
            ? 'border-[color-mix(in_srgb,var(--status-warning)_35%,transparent)] text-[var(--status-warning)]'
            : 'border-border/60 text-muted-foreground',
        )}>
          {column.limit ? `${column.taskCount}/${column.limit}` : column.taskCount}
        </span>
      </div>
    </header>

    <div className="min-h-32 flex-1 space-y-2 overflow-auto p-2">
      {column.tasks.length > 0 ? (
        column.tasks.map((task) => (
          <KanbanTaskCard
            key={task.id}
            board={board}
            task={task}
            isPending={pendingTaskIds?.has(task.id) ?? false}
            onEditTask={onEditTask}
            currentSessionId={currentSessionId}
            onAttachCurrentSession={onAttachCurrentSession}
            onAttachChangedFiles={onAttachChangedFiles}
            onCreateBranch={onCreateBranch}
            onMoveTask={onMoveTask}
            onDragStart={onTaskDragStart}
            onDragEnd={onTaskDragEnd}
          />
        ))
      ) : (
        <div className="rounded-lg border border-dashed border-border/70 px-3 py-6 text-center typography-meta text-muted-foreground">
          No tasks here yet.
        </div>
      )}
    </div>
    </section>
  );
};
