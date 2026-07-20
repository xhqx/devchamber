import type { ModelFallbackChain } from './modelFallback';
import { isModelFallbackPurpose, normalizeModelFallbackChain } from './modelFallback';

export type ForkFeatureSettings = {
  autoApprove: {
    enabled: boolean;
    timeoutSeconds: number;
    allowedTools: string[];
  };
  docs: {
    requiredOnCodeChange: boolean;
  };
  modelFallback: {
    enabled: boolean;
    chain: ModelFallbackChain[];
  };
  repoIndex: {
    enabled: boolean;
  };
  kanban: {
    enabled: boolean;
  };
  autocomplete: {
    enabled: boolean;
    agentName: string | null;
    multilineEnabled: boolean;
    throttleMs: number;
    maxSuggestionLength: number;
    maxSuggestionLines: number;
    minPrefixLength: number;
  };
  commitGeneration: {
    maxFiles: number;
    variantsEnabled: boolean;
  };
};

export const DEFAULT_FORK_FEATURE_SETTINGS: ForkFeatureSettings = {
  autoApprove: {
    enabled: false,
    timeoutSeconds: 30,
    allowedTools: [],
  },
  docs: {
    requiredOnCodeChange: true,
  },
  modelFallback: {
    enabled: true,
    chain: [],
  },
  repoIndex: {
    enabled: true,
  },
  kanban: {
    enabled: true,
  },
  autocomplete: {
    enabled: true,
    agentName: null,
    multilineEnabled: true,
    throttleMs: 120,
    maxSuggestionLength: 500,
    maxSuggestionLines: 6,
    minPrefixLength: 2,
  },
  commitGeneration: {
    maxFiles: 40,
    variantsEnabled: true,
  },
};

const clampTimeoutSeconds = (value: unknown): number => {
  const numeric = typeof value === 'number' && Number.isFinite(value)
    ? value
    : DEFAULT_FORK_FEATURE_SETTINGS.autoApprove.timeoutSeconds;
  return Math.max(5, Math.min(600, Math.floor(numeric)));
};

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value
    .map((entry) => typeof entry === 'string' ? entry.trim() : '')
    .filter(Boolean)));
};

const normalizeBoolean = (value: unknown, fallback: boolean): boolean => (
  typeof value === 'boolean' ? value : fallback
);

const normalizeOptionalString = (value: unknown): string | null => (
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
);

const normalizePositiveInteger = (value: unknown, fallback: number, min: number, max: number): number => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(min, Math.min(max, Math.floor(numeric)));
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

export const normalizeForkFeatureSettings = (value: unknown): ForkFeatureSettings => {
  const input = asRecord(value);
  const autoApprove = asRecord(input.autoApprove);
  const docs = asRecord(input.docs);
  const modelFallback = asRecord(input.modelFallback);
  const repoIndex = asRecord(input.repoIndex);
  const kanban = asRecord(input.kanban);
  const autocomplete = asRecord(input.autocomplete);
  const commitGeneration = asRecord(input.commitGeneration);
  const flat = input;

  const pick = (record: Record<string, unknown>, key: string, flatKey: string): unknown => (
    Object.prototype.hasOwnProperty.call(record, key) ? record[key] : flat[flatKey]
  );

  const rawChain: unknown[] = Array.isArray(pick(modelFallback, 'chain', 'fork.modelFallback.chain'))
    ? pick(modelFallback, 'chain', 'fork.modelFallback.chain') as unknown[]
    : [];

  return {
    autoApprove: {
      enabled: normalizeBoolean(pick(autoApprove, 'enabled', 'fork.autoApprove.enabled'), DEFAULT_FORK_FEATURE_SETTINGS.autoApprove.enabled),
      timeoutSeconds: clampTimeoutSeconds(pick(autoApprove, 'timeoutSeconds', 'fork.autoApprove.timeoutSeconds')),
      allowedTools: normalizeStringArray(pick(autoApprove, 'allowedTools', 'fork.autoApprove.allowedTools')),
    },
    docs: {
      requiredOnCodeChange: normalizeBoolean(pick(docs, 'requiredOnCodeChange', 'fork.docs.requiredOnCodeChange'), DEFAULT_FORK_FEATURE_SETTINGS.docs.requiredOnCodeChange),
    },
    modelFallback: {
      enabled: normalizeBoolean(pick(modelFallback, 'enabled', 'fork.modelFallback.enabled'), DEFAULT_FORK_FEATURE_SETTINGS.modelFallback.enabled),
      chain: rawChain
        .filter((entry: unknown): entry is Partial<ModelFallbackChain> & { purpose: ModelFallbackChain['purpose'] } => (
          Boolean(entry)
          && typeof entry === 'object'
          && isModelFallbackPurpose((entry as { purpose?: unknown }).purpose)
        ))
        .map((entry) => normalizeModelFallbackChain(entry, entry.purpose)),
    },
    repoIndex: {
      enabled: normalizeBoolean(pick(repoIndex, 'enabled', 'fork.repoIndex.enabled'), DEFAULT_FORK_FEATURE_SETTINGS.repoIndex.enabled),
    },
    kanban: {
      enabled: normalizeBoolean(pick(kanban, 'enabled', 'fork.kanban.enabled'), DEFAULT_FORK_FEATURE_SETTINGS.kanban.enabled),
    },
    autocomplete: {
      enabled: normalizeBoolean(pick(autocomplete, 'enabled', 'fork.autocomplete.enabled'), DEFAULT_FORK_FEATURE_SETTINGS.autocomplete.enabled),
      agentName: normalizeOptionalString(pick(autocomplete, 'agentName', 'fork.autocomplete.agentName')),
      multilineEnabled: normalizeBoolean(
        pick(autocomplete, 'multilineEnabled', 'fork.autocomplete.multilineEnabled'),
        DEFAULT_FORK_FEATURE_SETTINGS.autocomplete.multilineEnabled,
      ),
      throttleMs: normalizePositiveInteger(
        pick(autocomplete, 'throttleMs', 'fork.autocomplete.throttleMs'),
        DEFAULT_FORK_FEATURE_SETTINGS.autocomplete.throttleMs,
        0,
        2_000,
      ),
      maxSuggestionLength: normalizePositiveInteger(
        pick(autocomplete, 'maxSuggestionLength', 'fork.autocomplete.maxSuggestionLength'),
        DEFAULT_FORK_FEATURE_SETTINGS.autocomplete.maxSuggestionLength,
        20,
        2_000,
      ),
      maxSuggestionLines: normalizePositiveInteger(
        pick(autocomplete, 'maxSuggestionLines', 'fork.autocomplete.maxSuggestionLines'),
        DEFAULT_FORK_FEATURE_SETTINGS.autocomplete.maxSuggestionLines,
        1,
        20,
      ),
      minPrefixLength: normalizePositiveInteger(
        pick(autocomplete, 'minPrefixLength', 'fork.autocomplete.minPrefixLength'),
        DEFAULT_FORK_FEATURE_SETTINGS.autocomplete.minPrefixLength,
        1,
        12,
      ),
    },
    commitGeneration: {
      maxFiles: normalizePositiveInteger(
        pick(commitGeneration, 'maxFiles', 'fork.commitGeneration.maxFiles'),
        DEFAULT_FORK_FEATURE_SETTINGS.commitGeneration.maxFiles,
        1,
        300,
      ),
      variantsEnabled: normalizeBoolean(
        pick(commitGeneration, 'variantsEnabled', 'fork.commitGeneration.variantsEnabled'),
        DEFAULT_FORK_FEATURE_SETTINGS.commitGeneration.variantsEnabled,
      ),
    },
  };
};
