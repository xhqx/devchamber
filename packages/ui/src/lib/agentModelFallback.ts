import type { ForkFeatureSettings } from './forkFeatures';
import { DEFAULT_MODEL_FALLBACK_RETRY_ON, type ModelFallbackChain } from './modelFallback';

const normalizeAgentName = (agent: string | null | undefined): string | null => {
  const trimmed = typeof agent === 'string' ? agent.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
};

export const resolveAgentFallbackChain = (
  settings: ForkFeatureSettings,
  agent: string | null | undefined,
  purpose: ModelFallbackChain['purpose'],
): ModelFallbackChain[] => {
  if (!settings.modelFallback.enabled) {
    return [];
  }

  const agentName = normalizeAgentName(agent);
  if (!agentName) {
    return [];
  }

  const models = settings.modelFallback.agents[agentName] ?? [];
  if (models.length === 0) {
    return [];
  }

  return [{
    purpose,
    models,
    maxAttempts: models.length + 1,
    retryOn: [...DEFAULT_MODEL_FALLBACK_RETRY_ON],
  }];
};

export const resolveAgentChatFallbackChain = (
  settings: ForkFeatureSettings,
  agent: string | null | undefined,
): ModelFallbackChain[] => resolveAgentFallbackChain(settings, agent, 'chat');
