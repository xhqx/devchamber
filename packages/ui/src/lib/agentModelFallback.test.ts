import { describe, expect, test } from 'bun:test';
import { DEFAULT_FORK_FEATURE_SETTINGS, type ForkFeatureSettings } from './forkFeatures';
import { resolveAgentChatFallbackChain } from './agentModelFallback';

const settingsWithAgents = (agents: ForkFeatureSettings['modelFallback']['agents']): ForkFeatureSettings => ({
  ...DEFAULT_FORK_FEATURE_SETTINGS,
  modelFallback: {
    ...DEFAULT_FORK_FEATURE_SETTINGS.modelFallback,
    enabled: true,
    agents,
  },
});

describe('resolveAgentChatFallbackChain', () => {
  test('returns a chat fallback chain for the selected agent with auth retry enabled', () => {
    const chains = resolveAgentChatFallbackChain(settingsWithAgents({
      zen: [
        { providerID: 'openrouter', modelID: 'fallback-1' },
        { providerID: 'anthropic', modelID: 'fallback-2' },
        { providerID: 'openai', modelID: 'fallback-3' },
      ],
    }), ' zen ');

    expect(chains).toHaveLength(1);
    expect(chains[0]?.purpose).toBe('chat');
    expect(chains[0]?.maxAttempts).toBe(4);
    expect(chains[0]?.retryOn).toContain('auth_error');
    expect(chains[0]?.models.map((model) => `${model.providerID}/${model.modelID}`)).toEqual([
      'openrouter/fallback-1',
      'anthropic/fallback-2',
      'openai/fallback-3',
    ]);
  });

  test('does not create chat fallback when disabled or agent has no configured backups', () => {
    const settings = settingsWithAgents({ zen: [{ providerID: 'openrouter', modelID: 'fallback-1' }] });

    expect(resolveAgentChatFallbackChain({
      ...settings,
      modelFallback: { ...settings.modelFallback, enabled: false },
    }, 'zen')).toEqual([]);
    expect(resolveAgentChatFallbackChain(settings, 'build')).toEqual([]);
    expect(resolveAgentChatFallbackChain(settings, undefined)).toEqual([]);
  });
});
