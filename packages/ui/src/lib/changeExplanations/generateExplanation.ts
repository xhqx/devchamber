import { renderMagicPrompt } from '../magicPrompts';
import type { ModelFallbackChain, ModelRef } from '../modelFallback';
import { runWithModelFallback, type ModelFallbackFailure } from '../runWithModelFallback';
import type { DetectedCodeChange } from './detectCodeChanges';
import { createChangeExplanation, type ChangeExplanation, type ChangeExplanationDocsDecision } from './schema';

export type GeneratedChangeExplanationPayload = {
  summary: string;
  why: string;
  risks: string[];
  docs: ChangeExplanationDocsDecision;
};

export type GenerateChangeExplanationInput = {
  sessionId: string;
  directory: string;
  changes: DetectedCodeChange[];
  diffContext?: string;
  primaryModel: ModelRef;
  chains?: ModelFallbackChain[];
  createdAt?: string;
  renderPrompt?: typeof renderMagicPrompt;
  runStructured: (input: {
    model: ModelRef;
    visiblePrompt: string;
    hiddenPrompt: string;
  }) => Promise<unknown>;
};

export type GenerateChangeExplanationResult = {
  explanations: ChangeExplanation[];
  payload: GeneratedChangeExplanationPayload;
  model: ModelRef;
  attempts: number;
  failures: ModelFallbackFailure[];
};

const normalizePath = (path: string): string => (
  path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/^\/+/, '').trim()
);

const normalizeStringArray = (value: unknown, maxItems: number): string[] => {
  if (!Array.isArray(value)) return [];
  return Array.from(new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))).slice(0, maxItems);
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
);

export const parseGeneratedChangeExplanationPayload = (value: unknown): GeneratedChangeExplanationPayload => {
  const record = asRecord(value);
  const summary = typeof record.summary === 'string' ? record.summary.trim() : '';
  const why = typeof record.why === 'string' ? record.why.trim() : '';
  const docsRecord = asRecord(record.docs);
  const docsPaths = normalizeStringArray(docsRecord.paths, 20).map(normalizePath).filter(Boolean).sort();

  if (!summary) {
    throw new Error('Structured change explanation missing summary');
  }
  if (!why) {
    throw new Error('Structured change explanation missing why');
  }

  return {
    summary,
    why,
    risks: normalizeStringArray(record.risks, 10),
    docs: {
      required: docsRecord.required === true,
      paths: docsPaths,
      suggestedPatch: typeof docsRecord.suggestedPatch === 'string' && docsRecord.suggestedPatch.trim().length > 0
        ? docsRecord.suggestedPatch.trim()
        : undefined,
      reason: typeof docsRecord.reason === 'string' && docsRecord.reason.trim().length > 0
        ? docsRecord.reason.trim()
        : undefined,
    },
  };
};

export const buildChangeExplanationPromptContext = (changes: DetectedCodeChange[], diffContext?: string): Record<string, string> => {
  const changeLines = changes.length > 0
    ? changes.map((change) => `- ${change.filePath} (${change.changeKind}, ${change.source}): ${change.summary}`).join('\n')
    : '- none detected';

  return {
    changed_files: changeLines,
    diff_context: diffContext?.trim() ? diffContext.trim() : 'No bounded diff context supplied.',
  };
};

export const generateChangeExplanation = async ({
  sessionId,
  directory,
  changes,
  diffContext,
  primaryModel,
  chains,
  createdAt,
  renderPrompt = renderMagicPrompt,
  runStructured,
}: GenerateChangeExplanationInput): Promise<GenerateChangeExplanationResult> => {
  const normalizedChanges = changes
    .map((change) => ({ ...change, filePath: normalizePath(change.filePath) }))
    .filter((change) => change.filePath.length > 0);

  if (normalizedChanges.length === 0) {
    throw new Error('Cannot generate change explanation without detected changes');
  }

  const promptContext = buildChangeExplanationPromptContext(normalizedChanges, diffContext);
  const [visiblePrompt, hiddenPrompt] = await Promise.all([
    renderPrompt('change.explanation.generate.visible'),
    renderPrompt('change.explanation.generate.instructions', promptContext),
  ]);

  const generation = await runWithModelFallback({
    purpose: 'docs',
    primaryModel,
    chains,
    run: async (model) => parseGeneratedChangeExplanationPayload(await runStructured({ model, visiblePrompt, hiddenPrompt })),
  });

  const explanations = normalizedChanges.map((change) => createChangeExplanation({
    sessionId,
    directory,
    filePath: change.filePath,
    changeKind: change.changeKind,
    summary: generation.result.summary,
    why: generation.result.why,
    risks: generation.result.risks,
    docs: generation.result.docs,
    createdAt,
    model: generation.model,
  }));

  return {
    explanations,
    payload: generation.result,
    model: generation.model,
    attempts: generation.attempts,
    failures: generation.failures,
  };
};
