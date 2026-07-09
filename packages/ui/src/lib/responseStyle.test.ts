import { describe, expect, test } from 'bun:test';

import {
  getResponseStylePresetInstructions,
  isResponseStylePreset,
  RESPONSE_STYLE_PRESETS,
} from './responseStyle';

describe('response style presets', () => {
  test('includes visual markdown mode as a selectable preset', () => {
    expect(RESPONSE_STYLE_PRESETS).toContain('visual');
    expect(isResponseStylePreset('visual')).toBe(true);
  });

  test('visual mode instructs the assistant to prefer scannable markdown diagrams', () => {
    const instruction = getResponseStylePresetInstructions('visual');

    expect(instruction).toContain('visual-first markdown');
    expect(instruction).toContain('Mermaid diagrams');
    expect(instruction).toContain('Avoid long paragraphs');
  });
});
