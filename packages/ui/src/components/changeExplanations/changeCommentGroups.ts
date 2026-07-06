import type { ChangeExplanation } from '@/lib/changeExplanations/schema';

export type ChangeCommentStatus = 'docs-updated' | 'docs-missing' | 'accepted' | 'needs-revision';

export type ChangeCommentGroup = {
  filePath: string;
  explanations: ChangeExplanation[];
  statuses: ChangeCommentStatus[];
};

export const normalizeChangeCommentPath = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/^\/+/, '').trim();

export const getChangeCommentStatuses = (explanation: ChangeExplanation): ChangeCommentStatus[] => {
  const statuses: ChangeCommentStatus[] = [];
  if (explanation.docsUpdated) {
    statuses.push('docs-updated');
  } else {
    statuses.push('docs-missing');
  }

  if (explanation.risks.length > 0) {
    statuses.push('needs-revision');
  } else {
    statuses.push('accepted');
  }

  return statuses;
};

export const groupChangeCommentsByFile = (
  explanations: ChangeExplanation[],
  filePaths: string[] = [],
): ChangeCommentGroup[] => {
  const order = new Map(filePaths.map((path, index) => [normalizeChangeCommentPath(path), index]));
  const byFile = new Map<string, ChangeExplanation[]>();

  for (const explanation of explanations) {
    const filePath = normalizeChangeCommentPath(explanation.filePath);
    const group = byFile.get(filePath) ?? [];
    group.push(explanation);
    byFile.set(filePath, group);
  }

  return Array.from(byFile.entries())
    .map(([filePath, entries]) => ({
      filePath,
      explanations: [...entries].sort((left, right) => {
        if (left.range?.startLine !== right.range?.startLine) {
          return (left.range?.startLine ?? 0) - (right.range?.startLine ?? 0);
        }
        return left.createdAt.localeCompare(right.createdAt);
      }),
      statuses: Array.from(new Set(entries.flatMap(getChangeCommentStatuses))),
    }))
    .sort((left, right) => {
      const leftOrder = order.get(left.filePath) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = order.get(right.filePath) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.filePath.localeCompare(right.filePath);
    });
};
