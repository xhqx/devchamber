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

  test('visual mode instructs the assistant to choose canvas-rich visual formats', () => {
    const instruction = getResponseStylePresetInstructions('visual');

    expect(instruction).toContain('high-effort visual canvas mode');
    expect(instruction).toContain('`canvas` fenced blocks');
    expect(instruction).toContain('spatial freeform boards');
    expect(instruction).toContain('Mermaid for formal flows');
    expect(instruction).toContain('fall back to concise text-only bullets');
  });

  test('visual mode settings build a reusable instruction for the chat toggle', () => {
    const settings = buildResponseStyleSettings({
      responseStyleEnabled: true,
      responseStylePreset: 'visual',
    });

    expect(settings?.enabled).toBe(true);
    expect(settings?.preset).toBe('visual');
    expect(settings?.instruction).toContain('high-effort visual canvas mode');
  });
});
