import type { ModelFallbackChain, ModelFallbackPurpose, ModelFallbackRetryReason, ModelRef } from './modelFallback';

export type ModelFallbackFailure = {
  model: ModelRef;
  reason: ModelFallbackRetryReason;
  error: unknown;
};

export type RunWithModelFallbackResult<T> = {
  result: T;
  model: ModelRef;
  attempts: number;
  failures: ModelFallbackFailure[];
};

export type RunWithModelFallbackOptions<T> = {
  purpose: ModelFallbackPurpose;
  primaryModel: ModelRef;
  chains?: ModelFallbackChain[];
  run: (model: ModelRef, attempt: number) => Promise<T>;
  classifyError?: (error: unknown) => ModelFallbackRetryReason | 'fatal';
};

export class ModelFallbackExhaustedError extends Error {
  readonly failures: ModelFallbackFailure[];

  constructor(failures: ModelFallbackFailure[]) {
    super(`Model fallback exhausted after ${failures.length} failed attempt${failures.length === 1 ? '' : 's'}`);
    this.name = 'ModelFallbackExhaustedError';
    this.failures = failures;
  }
}

export const defaultClassifyModelError = (error: unknown): ModelFallbackRetryReason | 'fatal' => {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (message.includes('timeout') || message.includes('timed out') || message.includes('abort')) {
    return 'timeout';
  }
  if (message.includes('rate') || message.includes('429')) {
    return 'rate_limit';
  }
  if (message.includes('invalid json') || message.includes('parse')) {
    return 'invalid_json';
  }
  if (
    message.includes('invalid api key')
    || message.includes('api key')
    || message.includes('unauthorized')
    || message.includes('authentication')
    || message.includes('401')
    || message.includes('403')
  ) {
    return 'auth_error';
  }
  if (message.includes('500') || message.includes('502') || message.includes('503') || message.includes('server')) {
    return 'server_error';
  }

  return 'fatal';
};

const modelKey = (model: ModelRef) => `${model.providerID}/${model.modelID}/${model.variant ?? ''}`;

export const resolveFallbackModels = ({
  purpose,
  primaryModel,
  chains,
}: Pick<RunWithModelFallbackOptions<unknown>, 'purpose' | 'primaryModel' | 'chains'>): ModelRef[] => {
  const chain = chains?.find((entry) => entry.purpose === purpose);
  const models = [primaryModel, ...(chain?.models ?? [])];
  const seen = new Set<string>();
  return models.filter((model) => {
    const key = modelKey(model);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  }).slice(0, chain?.maxAttempts ?? 1);
};

export const runWithModelFallback = async <T>({
  purpose,
  primaryModel,
  chains,
  run,
  classifyError = defaultClassifyModelError,
}: RunWithModelFallbackOptions<T>): Promise<RunWithModelFallbackResult<T>> => {
  const chain = chains?.find((entry) => entry.purpose === purpose);
  const retryOn = new Set(chain?.retryOn ?? []);
  const models = resolveFallbackModels({ purpose, primaryModel, chains });
  const failures: ModelFallbackFailure[] = [];

  for (const [index, model] of models.entries()) {
    try {
      const result = await run(model, index + 1);
      return {
        result,
        model,
        attempts: index + 1,
        failures,
      };
    } catch (error) {
      const reason = classifyError(error);
      if (reason === 'fatal' || (retryOn.size > 0 && !retryOn.has(reason))) {
        throw error;
      }

      failures.push({ model, reason, error });
    }
  }

  throw new ModelFallbackExhaustedError(failures);
};
