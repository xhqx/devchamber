import { describe, expect, test } from 'bun:test';
import {
  buildGenerationModelOptions,
  decodeGenerationModelValue,
  encodeGenerationModelValue,
  type GenerationModelSelection,
} from '@/lib/generationModelSelection';

describe('GenerationModelPicker helpers', () => {
  test('round trips provider/model values safely', () => {
    const selection: GenerationModelSelection = { providerId: 'openrouter', modelId: 'anthropic/claude sonnet' };
    expect(decodeGenerationModelValue(encodeGenerationModelValue(selection))).toEqual(selection);
  });

  test('returns null for auto or malformed values', () => {
    expect(decodeGenerationModelValue('__auto__')).toBeNull();
    expect(decodeGenerationModelValue('')).toBeNull();
    expect(decodeGenerationModelValue('provider-only')).toBeNull();
  });

  test('builds labels from provider and model names', () => {
    const options = buildGenerationModelOptions([
      {
        id: 'zen',
        name: 'Zen',
        env: [],
        models: [
          { id: 'big-pickle', name: 'Big Pickle' },
          { id: 'small-pickle' },
        ],
      },
      {
        id: 'custom',
        env: [],
        models: [{ id: 'model-a' }],
      },
    ] as never);

    expect(options.map((option) => option.label)).toEqual([
      'Zen · Big Pickle',
      'Zen · small-pickle',
      'custom · model-a',
    ]);
  });
});
