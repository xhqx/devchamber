export const KANBAN_STATUSES = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done'] as const;

export type KanbanTaskStatus = (typeof KANBAN_STATUSES)[number];

export const KANBAN_PRIORITIES = ['low', 'medium', 'high'] as const;

export type KanbanTaskPriority = (typeof KANBAN_PRIORITIES)[number];

export type KanbanColumn = {
  id: KanbanTaskStatus;
  title: string;
  description?: string;
  limit?: number;
};

export type KanbanTask = {
  id: string;
  title: string;
  description?: string;
  status: KanbanTaskStatus;
  priority?: KanbanTaskPriority;
  sessionIds: string[];
  filePaths: string[];
  branch?: string;
  assignee?: 'human' | 'agent' | string;
  blockedReason?: string;
  createdAt: string;
  updatedAt: string;
};

export type KanbanTaskDraft = {
  title: string;
  description?: string;
  status?: KanbanTaskStatus;
  priority?: KanbanTaskPriority;
  sessionIds?: string[];
  filePaths?: string[];
  branch?: string;
  assignee?: 'human' | 'agent' | string;
  blockedReason?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type KanbanBoard = {
  version: 1;
  columns: KanbanColumn[];
  tasks: KanbanTask[];
  updatedAt: string;
};

export const DEFAULT_KANBAN_COLUMNS: KanbanColumn[] = [
  { id: 'backlog', title: 'Backlog', description: 'Captured work that is not ready to start yet.' },
  { id: 'ready', title: 'Ready', description: 'Small, clear tasks that can be picked up next.' },
  { id: 'in_progress', title: 'In progress', description: 'Active human or agent work.' },
  { id: 'blocked', title: 'Blocked', description: 'Work waiting on a decision, dependency, or external input.' },
  { id: 'review', title: 'Review', description: 'Implemented work awaiting verification or user review.' },
  { id: 'done', title: 'Done', description: 'Verified and complete work.' },
];

const normalizePath = (path: string): string => (
  path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/^\/+/, '').trim()
);

const uniqueSorted = (values: string[] | undefined, normalize = (value: string) => value.trim()): string[] => (
  Array.from(new Set((values ?? []).map(normalize).filter(Boolean))).sort()
);

const stableHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

export const isKanbanTaskStatus = (value: unknown): value is KanbanTaskStatus => (
  typeof value === 'string' && KANBAN_STATUSES.includes(value as KanbanTaskStatus)
);

export const isKanbanTaskPriority = (value: unknown): value is KanbanTaskPriority => (
  typeof value === 'string' && KANBAN_PRIORITIES.includes(value as KanbanTaskPriority)
);

export const createKanbanTaskId = (draft: Pick<KanbanTaskDraft, 'title' | 'createdAt'>): string => (
  `kt_${stableHash([draft.createdAt ?? '', draft.title.trim()].join('|'))}`
);

export const createKanbanTask = (draft: KanbanTaskDraft): KanbanTask => {
  const now = draft.createdAt ?? new Date().toISOString();
  const title = draft.title.trim();
  return {
    id: createKanbanTaskId({ title, createdAt: now }),
    title,
    description: draft.description?.trim() || undefined,
    status: draft.status ?? 'backlog',
    priority: draft.priority,
    sessionIds: uniqueSorted(draft.sessionIds),
    filePaths: uniqueSorted(draft.filePaths, normalizePath),
    branch: draft.branch?.trim() || undefined,
    assignee: draft.assignee?.trim() || undefined,
    blockedReason: draft.blockedReason?.trim() || undefined,
    createdAt: now,
    updatedAt: draft.updatedAt ?? now,
  };
};

export const createEmptyKanbanBoard = (updatedAt = new Date().toISOString()): KanbanBoard => ({
  version: 1,
  columns: DEFAULT_KANBAN_COLUMNS,
  tasks: [],
  updatedAt,
});
