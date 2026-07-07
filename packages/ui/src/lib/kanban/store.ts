import type { KanbanBoard, KanbanColumn, KanbanTask, KanbanTaskPatch, KanbanTaskStatus } from './schema';
import { DEFAULT_KANBAN_COLUMNS, createEmptyKanbanBoard, isKanbanTaskPriority, isKanbanTaskStatus } from './schema';

export type KanbanBoardStore = KanbanBoard;

const statusRank = new Map<KanbanTaskStatus, number>(DEFAULT_KANBAN_COLUMNS.map((column, index) => [column.id, index]));

const sortTasks = (tasks: KanbanTask[]): KanbanTask[] => (
  [...tasks].sort((left, right) => {
    const leftRank = statusRank.get(left.status) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = statusRank.get(right.status) ?? Number.MAX_SAFE_INTEGER;
    if (leftRank !== rightRank) return leftRank - rightRank;
    if (left.updatedAt !== right.updatedAt) return right.updatedAt.localeCompare(left.updatedAt);
    if (left.title !== right.title) return left.title.localeCompare(right.title);
    return left.id.localeCompare(right.id);
  })
);

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((entry): entry is string => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))).sort();
};

const parseColumn = (value: unknown): KanbanColumn | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<KanbanColumn>;
  if (!isKanbanTaskStatus(record.id) || typeof record.title !== 'string' || !record.title.trim()) return null;
  return {
    id: record.id,
    title: record.title.trim(),
    description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : undefined,
    limit: typeof record.limit === 'number' && Number.isFinite(record.limit) && record.limit > 0 ? record.limit : undefined,
  };
};

const parseTask = (value: unknown): KanbanTask | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Partial<KanbanTask>;
  if (typeof record.id !== 'string' || !record.id.trim()) return null;
  if (typeof record.title !== 'string' || !record.title.trim()) return null;
  if (!isKanbanTaskStatus(record.status)) return null;
  if (typeof record.createdAt !== 'string' || typeof record.updatedAt !== 'string') return null;
  return {
    id: record.id.trim(),
    title: record.title.trim(),
    description: typeof record.description === 'string' && record.description.trim() ? record.description.trim() : undefined,
    status: record.status,
    priority: isKanbanTaskPriority(record.priority) ? record.priority : undefined,
    sessionIds: normalizeStringArray(record.sessionIds),
    filePaths: normalizeStringArray(record.filePaths),
    branch: typeof record.branch === 'string' && record.branch.trim() ? record.branch.trim() : undefined,
    assignee: typeof record.assignee === 'string' && record.assignee.trim() ? record.assignee.trim() : undefined,
    blockedReason: typeof record.blockedReason === 'string' && record.blockedReason.trim() ? record.blockedReason.trim() : undefined,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
};

export const upsertKanbanTasks = (
  board: KanbanBoardStore,
  tasks: KanbanTask[],
  updatedAt = new Date().toISOString(),
): KanbanBoardStore => {
  const byId = new Map(board.tasks.map((task) => [task.id, task]));
  for (const task of tasks) {
    byId.set(task.id, task);
  }
  return {
    ...board,
    tasks: sortTasks(Array.from(byId.values())),
    updatedAt,
  };
};

export const removeKanbanTask = (
  board: KanbanBoardStore,
  id: string,
  updatedAt = new Date().toISOString(),
): KanbanBoardStore => ({
  ...board,
  tasks: board.tasks.filter((task) => task.id !== id),
  updatedAt,
});

export const moveKanbanTask = (
  board: KanbanBoardStore,
  id: string,
  status: KanbanTaskStatus,
  updatedAt = new Date().toISOString(),
  blockedReason?: string,
): KanbanBoardStore => ({
  ...board,
  tasks: sortTasks(board.tasks.map((task) => (
    task.id === id
      ? {
        ...task,
        status,
        blockedReason: status === 'blocked' ? blockedReason?.trim() || task.blockedReason : undefined,
        updatedAt,
      }
      : task
  ))),
  updatedAt,
});

export const updateKanbanTask = (
  board: KanbanBoardStore,
  id: string,
  patch: KanbanTaskPatch,
  updatedAt = new Date().toISOString(),
): KanbanBoardStore => ({
  ...board,
  tasks: sortTasks(board.tasks.map((task) => {
    if (task.id !== id) return task;
    const title = patch.title?.trim();
    if (patch.title !== undefined && !title) return task;
    return {
      ...task,
      ...(title ? { title } : null),
      ...(patch.description !== undefined ? { description: patch.description.trim() || undefined } : null),
      ...(patch.status !== undefined ? { status: patch.status } : null),
      ...(patch.priority !== undefined ? { priority: patch.priority } : null),
      ...(patch.sessionIds !== undefined ? { sessionIds: normalizeStringArray(patch.sessionIds) } : null),
      ...(patch.filePaths !== undefined ? { filePaths: normalizeStringArray(patch.filePaths) } : null),
      ...(patch.branch !== undefined ? { branch: patch.branch.trim() || undefined } : null),
      ...(patch.assignee !== undefined ? { assignee: patch.assignee.trim() || undefined } : null),
      ...(patch.blockedReason !== undefined ? { blockedReason: patch.blockedReason.trim() || undefined } : null),
      updatedAt,
    };
  })),
  updatedAt,
});

export const selectKanbanTasksByStatus = (
  board: KanbanBoardStore,
  status: KanbanTaskStatus,
): KanbanTask[] => board.tasks.filter((task) => task.status === status);

export const selectKanbanTasksForSession = (
  board: KanbanBoardStore,
  sessionId: string,
): KanbanTask[] => board.tasks.filter((task) => task.sessionIds.includes(sessionId));

export const selectKanbanTasksForFile = (
  board: KanbanBoardStore,
  filePath: string,
): KanbanTask[] => board.tasks.filter((task) => task.filePaths.includes(filePath));

export const parseKanbanBoard = (value: unknown, updatedAt = new Date().toISOString()): KanbanBoardStore => {
  if (!value || typeof value !== 'object') {
    return createEmptyKanbanBoard(updatedAt);
  }

  const record = value as Partial<KanbanBoard>;
  if (record.version !== 1 || !Array.isArray(record.tasks)) {
    return createEmptyKanbanBoard(updatedAt);
  }

  const parsedColumns = Array.isArray(record.columns) ? record.columns.map(parseColumn).filter((column): column is KanbanColumn => column !== null) : [];

  return {
    version: 1,
    columns: parsedColumns.length > 0 ? parsedColumns : DEFAULT_KANBAN_COLUMNS,
    tasks: sortTasks(record.tasks.map(parseTask).filter((task): task is KanbanTask => task !== null)),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : updatedAt,
  };
};
