import type { ChangeExplanation, ChangeExplanationIndex } from './schema';
import { createEmptyChangeExplanationIndex } from './schema';

export type ChangeExplanationStore = ChangeExplanationIndex;

const sortExplanations = (entries: ChangeExplanation[]): ChangeExplanation[] => (
  [...entries].sort((left, right) => {
    if (left.createdAt !== right.createdAt) return left.createdAt.localeCompare(right.createdAt);
    if (left.filePath !== right.filePath) return left.filePath.localeCompare(right.filePath);
    return left.id.localeCompare(right.id);
  })
);

export const upsertChangeExplanations = (
  store: ChangeExplanationStore,
  explanations: ChangeExplanation[],
  updatedAt = new Date().toISOString(),
): ChangeExplanationStore => {
  const byId = new Map(store.explanations.map((entry) => [entry.id, entry]));
  for (const explanation of explanations) {
    byId.set(explanation.id, explanation);
  }

  return {
    version: 1,
    explanations: sortExplanations(Array.from(byId.values())),
    updatedAt,
  };
};

export const removeChangeExplanation = (
  store: ChangeExplanationStore,
  id: string,
  updatedAt = new Date().toISOString(),
): ChangeExplanationStore => ({
  version: 1,
  explanations: store.explanations.filter((entry) => entry.id !== id),
  updatedAt,
});

export const selectChangeExplanationsForSession = (
  store: ChangeExplanationStore,
  sessionId: string,
): ChangeExplanation[] => store.explanations.filter((entry) => entry.sessionId === sessionId);

export const selectChangeExplanationsForFile = (
  store: ChangeExplanationStore,
  filePath: string,
): ChangeExplanation[] => store.explanations.filter((entry) => entry.filePath === filePath);

export const parseChangeExplanationStore = (value: unknown, updatedAt = new Date().toISOString()): ChangeExplanationStore => {
  if (!value || typeof value !== 'object') {
    return createEmptyChangeExplanationIndex(updatedAt);
  }
  const record = value as Partial<ChangeExplanationIndex>;
  if (record.version !== 1 || !Array.isArray(record.explanations)) {
    return createEmptyChangeExplanationIndex(updatedAt);
  }
  return {
    version: 1,
    explanations: sortExplanations(record.explanations.filter((entry): entry is ChangeExplanation => Boolean(entry?.id && entry.filePath && entry.sessionId))),
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : updatedAt,
  };
};
