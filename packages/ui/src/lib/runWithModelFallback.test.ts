import { describe, expect, test } from 'bun:test';
import { ModelFallbackExhaustedError, defaultClassifyModelError, resolveFallbackModels, runWithModelFallback } from './runWithModelFallback';
import type { ModelFallbackChain, ModelRef } from './modelFallback';

const primary: ModelRef = { providerID: 'p1', modelID: 'm1' };
const backup: ModelRef = { providerID: 'p2', modelID: 'm2' };
const chain: ModelFallbackChain = {
  purpose: 'commit',
  models: [backup],
  maxAttempts: 2,
  retryOn: ['timeout', 'server_error'],
};

describe('runWithModelFallback', () => {
  test('uses primary model when it succeeds', async () => {
    const result = await runWithModelFallback({
      purpose: 'commit',
      primaryModel: primary,
      chains: [chain],
      run: async (model) => model.modelID,
    });

    expect(result.result).toBe('m1');
    expect(result.model).toEqual(primary);
    expect(result.attempts).toBe(1);
    expect(result.failures).toHaveLength(0);
  });

  test('falls back on retryable errors', async () => {
    const calls: string[] = [];
    const result = await runWithModelFallback({
      purpose: 'commit',
      primaryModel: primary,
      chains: [chain],
      classifyError: () => 'timeout',
      run: async (model) => {
        calls.push(model.modelID);
        if (model.modelID === 'm1') {
          throw new Error('timeout');
        }
        return 'ok';
      },
    });

    expect(calls).toEqual(['m1', 'm2']);
    expect(result.result).toBe('ok');
    expect(result.model).toEqual(backup);
    expect(result.failures).toHaveLength(1);
  });

  test('does not retry fatal errors', async () => {
    let caught: unknown;
    try {
      await runWithModelFallback({
        purpose: 'commit',
        primaryModel: primary,
        chains: [chain],
        classifyError: () => 'fatal',
        run: async () => { throw new Error('bad request'); },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('bad request');
  });

  test('throws an exhausted error when every configured model fails', async () => {
    let caught: unknown;
    try {
      await runWithModelFallback({
        purpose: 'commit',
        primaryModel: primary,
        chains: [chain],
        classifyError: () => 'timeout',
        run: async () => { throw new Error('timeout'); },
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(ModelFallbackExhaustedError);
  });

  test('deduplicates primary from fallback chain', () => {
    expect(resolveFallbackModels({
      purpose: 'commit',
      primaryModel: primary,
      chains: [{ ...chain, models: [primary, backup], maxAttempts: 3 }],
    })).toEqual([primary, backup]);
  });

  test('classifies invalid API key errors as retryable auth errors', async () => {
    const authChain: ModelFallbackChain = {
      ...chain,
      retryOn: ['auth_error'],
    };
    const calls: string[] = [];

    const result = await runWithModelFallback({
      purpose: 'commit',
      primaryModel: primary,
      chains: [authChain],
      run: async (model) => {
        calls.push(model.modelID);
        if (model.modelID === 'm1') {
          throw new Error('Opencode failed to send message with error: Invalid API key.');
        }
        return 'fallback-ok';
      },
    });

    expect(defaultClassifyModelError(new Error('Invalid API key.'))).toBe('auth_error');
    expect(calls).toEqual(['m1', 'm2']);
    expect(result.result).toBe('fallback-ok');
    expect(result.model).toEqual(backup);
    expect(result.failures[0]?.reason).toBe('auth_error');
  });
});
