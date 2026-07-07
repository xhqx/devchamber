import type { KanbanBoard, KanbanColumn, KanbanTask, KanbanTaskPriority, KanbanTaskStatus } from './schema';
import { KANBAN_PRIORITIES } from './schema';

export type KanbanColumnViewModel = KanbanColumn & {
  tasks: KanbanTask[];
  taskCount: number;
  isOverLimit: boolean;
};

export type KanbanBoardViewModel = {
  columns: KanbanColumnViewModel[];
  taskCount: number;
  updatedAt: string;
};

const PRIORITY_RANK: Record<KanbanTaskPriority, number> = KANBAN_PRIORITIES.reduce((acc, priority, index) => ({
  ...acc,
  [priority]: KANBAN_PRIORITIES.length - index,
}), {} as Record<KanbanTaskPriority, number>);

const priorityRank = (priority: KanbanTaskPriority | undefined): number => (
  priority ? PRIORITY_RANK[priority] : Number.MAX_SAFE_INTEGER
);

export const sortKanbanTasksForColumn = (tasks: KanbanTask[]): KanbanTask[] => (
  [...tasks].sort((left, right) => {
    const priorityDelta = priorityRank(left.priority) - priorityRank(right.priority);
    if (priorityDelta !== 0) return priorityDelta;
    if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
    if (left.title !== right.title) return left.title.localeCompare(right.title);
    return left.id.localeCompare(right.id);
  })
);

export const buildKanbanBoardViewModel = (board: KanbanBoard): KanbanBoardViewModel => {
  const tasksByStatus = new Map<KanbanTaskStatus, KanbanTask[]>();
  for (const task of board.tasks) {
    tasksByStatus.set(task.status, [...(tasksByStatus.get(task.status) ?? []), task]);
  }

  return {
    columns: board.columns.map((column) => {
      const tasks = sortKanbanTasksForColumn(tasksByStatus.get(column.id) ?? []);
      return {
        ...column,
        tasks,
        taskCount: tasks.length,
        isOverLimit: typeof column.limit === 'number' && tasks.length > column.limit,
      };
    }),
    taskCount: board.tasks.length,
    updatedAt: board.updatedAt,
  };
};

export const getAdjacentKanbanStatus = (
  board: KanbanBoard,
  status: KanbanTaskStatus,
  direction: 'previous' | 'next',
): KanbanTaskStatus | null => {
  const index = board.columns.findIndex((column) => column.id === status);
  if (index < 0) return null;
  const nextIndex = direction === 'previous' ? index - 1 : index + 1;
  return board.columns[nextIndex]?.id ?? null;
};
