export type ModelRef = {
  providerID: string;
  modelID: string;
  variant?: string;
};

export type ModelFallbackPurpose = 'chat' | 'commit' | 'pr' | 'autocomplete' | 'docs';

export type ModelFallbackRetryReason = 'timeout' | 'rate_limit' | 'server_error' | 'invalid_json';

export type ModelFallbackChain = {
  purpose: ModelFallbackPurpose;
  models: ModelRef[];
  maxAttempts: number;
  retryOn: ModelFallbackRetryReason[];
};

export const DEFAULT_MODEL_FALLBACK_RETRY_ON: ModelFallbackRetryReason[] = [
  'timeout',
  'rate_limit',
  'server_error',
  'invalid_json',
];

export const MODEL_FALLBACK_PURPOSES: ModelFallbackPurpose[] = [
  'chat',
  'commit',
  'pr',
  'autocomplete',
  'docs',
];

export const normalizeModelRef = (value: Partial<ModelRef> | null | undefined): ModelRef | null => {
  const providerID = typeof value?.providerID === 'string' ? value.providerID.trim() : '';
  const modelID = typeof value?.modelID === 'string' ? value.modelID.trim() : '';

  if (!providerID || !modelID) {
    return null;
  }

  const variant = typeof value?.variant === 'string' ? value.variant.trim() : '';

  return {
    providerID,
    modelID,
    ...(variant ? { variant } : {}),
  };
};

export const isModelFallbackPurpose = (value: unknown): value is ModelFallbackPurpose => (
  typeof value === 'string' && MODEL_FALLBACK_PURPOSES.includes(value as ModelFallbackPurpose)
);

export const normalizeRetryReasons = (values: unknown): ModelFallbackRetryReason[] => {
  if (!Array.isArray(values)) {
    return [...DEFAULT_MODEL_FALLBACK_RETRY_ON];
  }

  const allowed = new Set(DEFAULT_MODEL_FALLBACK_RETRY_ON);
  const normalized = values.filter((value): value is ModelFallbackRetryReason => (
    typeof value === 'string' && allowed.has(value as ModelFallbackRetryReason)
  ));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...DEFAULT_MODEL_FALLBACK_RETRY_ON];
};

export const normalizeModelFallbackChain = (
  value: Partial<ModelFallbackChain> | null | undefined,
  purpose: ModelFallbackPurpose,
): ModelFallbackChain => {
  const models = Array.isArray(value?.models)
    ? value.models.map(normalizeModelRef).filter((model): model is ModelRef => model !== null)
    : [];

  const configuredAttempts = typeof value?.maxAttempts === 'number' && Number.isFinite(value.maxAttempts)
    ? Math.floor(value.maxAttempts)
    : models.length;

  return {
    purpose,
    models,
    maxAttempts: Math.max(1, Math.min(5, configuredAttempts || 1)),
    retryOn: normalizeRetryReasons(value?.retryOn),
  };
};

export const getFirstFallbackModel = (
  chains: ModelFallbackChain[] | undefined,
  purpose: ModelFallbackPurpose,
): ModelRef | null => {
  const chain = chains?.find((entry) => entry.purpose === purpose);
  return chain?.models[0] ?? null;
};
