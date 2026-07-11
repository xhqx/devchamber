import { runtimeFetch } from './runtime-fetch';

export const RESPONSE_STYLE_PRESETS = ['concise', 'detailed', 'mentor', 'pushback', 'noFiller', 'matchEnergy', 'warmPeer', 'visual'] as const;
export type ResponseStylePreset = typeof RESPONSE_STYLE_PRESETS[number];
export type ResponseStylePresetValue = ResponseStylePreset | 'custom';

export type ResponseStyleSettings = {
  enabled: boolean;
  preset: ResponseStylePresetValue | null;
  customInstructions: string;
  visualInstructions: string;
  instruction: string | null;
};

export const isResponseStylePreset = (value: unknown): value is ResponseStylePreset => (
  typeof value === 'string' && RESPONSE_STYLE_PRESETS.includes(value as ResponseStylePreset)
);

export const isResponseStylePresetValue = (value: unknown): value is ResponseStylePresetValue => (
  value === 'custom' || isResponseStylePreset(value)
);

export const getResponseStylePresetInstructions = (preset: ResponseStylePreset): string => {
  switch (preset) {
    case 'concise':
      return "Keep replies short. Answer first, no preamble or recap of the question. Write like you're texting a colleague who already has the context — plain sentences, not headings or bullets. Reach for a list only when the content is genuinely a list; never use one to look organised.";
    case 'detailed':
      return "Take the space you need to actually explain things. Walk through what's going on, why it matters, and where the real tradeoffs are. Prefer flowing prose over bullet points and headings — structure the answer with paragraphs and let the reasoning carry it. Lists are fine when something really is enumerable, but don't fragment a normal explanation into bullets.";
    case 'mentor':
      return "Talk like a patient senior engineer pairing with someone less experienced. Explain the underlying idea before the answer, think out loud about how you'd approach it, and drop in a small concrete example when it actually helps. Keep it conversational — no lecture format, no checklists, no numbered steps unless the task literally is a sequence.";
    case 'pushback':
      return "Don't agree automatically. If something I say sounds off — a wrong assumption, a flawed approach, a request that won't actually do what I think it will — push back first. Explain what you disagree with and why, and only proceed once I've responded. Disagreement is welcome; sycophancy is not. Don't soften it with 'you might want to consider' — just say it.";
    case 'noFiller':
      return "Cut the filler. No 'Great question', no 'Certainly', no 'I'll help you with that', no restating what I just asked. No closing summary of what you did when the diff or output already shows it. No trailing 'let me know if you need anything else'. Open with the actual content and stop when you're done.";
    case 'matchEnergy':
      return "Mirror the size and register of my message. A one-line question gets a one-line answer. A casual aside gets a casual reply, not a structured breakdown. If I write three words, don't respond with three paragraphs. Match the tone too — informal stays informal, technical stays technical. Don't inflate small asks into full essays.";
    case 'warmPeer':
      return "Talk like a colleague, not an assistant. First person is fine and encouraged — 'I'd do this', 'I don't love that approach', 'that was sloppy of me'. Have actual opinions and share them. Push back when you disagree. Admit when you screwed up without grovelling. Skip the corporate helpfulness and performative politeness — just be a person.";
    case 'visual':
      return "Use high-effort visual canvas mode. You are not limited to prose or diagrams: choose the clearest representation available, including Mermaid diagrams, `canvas` fenced blocks, tables, cards, timelines, matrices, checklists, ASCII/freeform layouts, wireframes, moodboards, image concepts/prompts, maps, and mixed formats. Use fenced `canvas` blocks for spatial freeform boards, lo-fi UI mockups, sticky-note clusters, journey maps, concept maps, or anything that benefits from a whiteboard/canvas feel; write compact labels inside `[cards]`, arrows, grouped rows, and short captions. Use Mermaid for formal flows/dependencies/state machines when it is the best fit, not by default. Spend extra reasoning effort choosing the representation that makes the answer fastest to understand, and compress prose to short glue captions. If the renderer or medium cannot support visuals, fall back to concise text-only bullets with the same structure. Avoid long paragraphs; make the chat easy to scan for someone who may not read every word.";
  }
};

export const buildResponseStyleInstruction = ({
  enabled,
  preset,
  customInstructions,
  visualInstructions,
}: {
  enabled?: boolean;
  preset?: unknown;
  customInstructions?: unknown;
  visualInstructions?: unknown;
}): string | null => {
  if (!enabled) return null;
  if (preset === 'custom') {
    const custom = typeof customInstructions === 'string' ? customInstructions.trim() : '';
    return custom || null;
  }
  if (preset === 'visual') {
    const visual = typeof visualInstructions === 'string' ? visualInstructions.trim() : '';
    return visual || getResponseStylePresetInstructions('visual');
  }
  if (!isResponseStylePreset(preset)) return null;
  return getResponseStylePresetInstructions(preset);
};

export const buildResponseStyleSettings = (settings: {
  responseStyleEnabled?: unknown;
  responseStylePreset?: unknown;
  responseStyleCustomInstructions?: unknown;
  responseStyleVisualInstructions?: unknown;
} | null): ResponseStyleSettings | null => {
  if (!settings) return null;
  const enabled = settings.responseStyleEnabled === true;
  const preset = isResponseStylePresetValue(settings.responseStylePreset) ? settings.responseStylePreset : null;
  const customInstructions = typeof settings.responseStyleCustomInstructions === 'string'
    ? settings.responseStyleCustomInstructions
    : '';
  const visualInstructions = typeof settings.responseStyleVisualInstructions === 'string'
    ? settings.responseStyleVisualInstructions
    : '';
  return {
    enabled,
    preset,
    customInstructions,
    visualInstructions,
    instruction: buildResponseStyleInstruction({
      enabled,
      preset,
      customInstructions,
      visualInstructions,
    }),
  };
};

export const fetchResponseStyleSettings = async (): Promise<ResponseStyleSettings | null> => {
  const response = await runtimeFetch('/api/config/settings', {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) return null;
  const settings = await response.json().catch(() => null) as {
    responseStyleEnabled?: unknown;
    responseStylePreset?: unknown;
    responseStyleCustomInstructions?: unknown;
    responseStyleVisualInstructions?: unknown;
  } | null;
  return buildResponseStyleSettings(settings);
};

export const fetchResponseStyleInstruction = async (): Promise<string | null> => {
  const settings = await fetchResponseStyleSettings();
  return settings?.instruction ?? null;
};
