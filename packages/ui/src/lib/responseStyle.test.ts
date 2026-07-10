import { describe, expect, test } from 'bun:test';

import {
  buildResponseStyleSettings,
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

    expect(instruction).toContain('high-effort diagram mode');
    expect(instruction).toContain('Mermaid diagrams');
    expect(instruction).toContain('fall back to concise text-only bullets');
  });

  test('visual mode settings build a reusable instruction for the chat toggle', () => {
    const settings = buildResponseStyleSettings({
      responseStyleEnabled: true,
      responseStylePreset: 'visual',
    });

    expect(settings?.enabled).toBe(true);
    expect(settings?.preset).toBe('visual');
    expect(settings?.instruction).toContain('high-effort diagram mode');
  });
});
