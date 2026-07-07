import type { KanbanTask } from './schema';

const MAX_BRANCH_SLUG_LENGTH = 56;

export const slugifyKanbanTaskBranchPart = (value: string): string => (
  value
    .trim()
    .toLowerCase()
    .replace(/^refs\/heads\//, '')
    .replace(/^heads\//, '')
    .replace(/[\s/_]+/g, '-')
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/\.+/g, '.')
    .replace(/-+/g, '-')
    .replace(/^[.-]+|[.-]+$/g, '')
    .slice(0, MAX_BRANCH_SLUG_LENGTH)
    .replace(/[.-]+$/g, '')
);

export const getKanbanTaskBranchSuffix = (taskId: string): string => (
  slugifyKanbanTaskBranchPart(taskId).slice(-8) || 'task'
);

export const buildKanbanTaskBranchName = (task: Pick<KanbanTask, 'id' | 'title'>, prefix = 'task'): string => {
  const cleanPrefix = slugifyKanbanTaskBranchPart(prefix).replace(/-+/g, '-');
  const slug = slugifyKanbanTaskBranchPart(task.title) || 'task';
  const suffix = getKanbanTaskBranchSuffix(task.id);
  const name = `${slug}-${suffix}`;
  return cleanPrefix ? `${cleanPrefix}/${name}` : name;
};
