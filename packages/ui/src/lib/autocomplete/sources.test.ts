import { describe, expect, test } from 'bun:test';

import type { RepoIndex } from '@/lib/repoIndex/schema';
import {
  applyPromptAutocompleteSuggestion,
  buildPromptAutocompleteSuggestions,
  detectPromptAutocompleteTrigger,
} from './sources';

const repoIndex: RepoIndex = {
  generatedAt: '2026-07-06T00:00:00.000Z',
  ignoredCount: 0,
  directories: [],
  docsFiles: ['docs/fork/ARCHITECTURE.md'],
  packageBoundaries: [],
  dependencyGraph: [],
  files: [
    {
      path: 'packages/ui/src/components/chat/ChatInput.tsx',
      name: 'ChatInput.tsx',
      directory: 'packages/ui/src/components/chat',
      extension: 'tsx',
      language: 'typescript',
      size: 1200,
      mtimeMs: 1,
      isDocs: false,
      packageName: '@openchamber/ui',
    },
    {
      path: 'docs/fork/ARCHITECTURE.md',
      name: 'ARCHITECTURE.md',
      directory: 'docs/fork',
      extension: 'md',
      language: 'markdown',
      size: 400,
      mtimeMs: 1,
      isDocs: true,
    },
  ],
  symbols: [
    { name: 'ChatInput', kind: 'component', path: 'packages/ui/src/components/chat/ChatInput.tsx', line: 990 },
    { name: 'buildCommitSuggestions', kind: 'function', path: 'packages/ui/src/lib/autocomplete/commitScopes.ts', line: 53 },
  ],
};

describe('prompt autocomplete sources', () => {
  test('detects prompt autocomplete triggers at token boundaries', () => {
    expect(detectPromptAutocompleteTrigger('Review @Chat', 12)).toEqual({
      kind: 'file',
      query: 'Chat',
      start: 7,
      end: 12,
    });
    expect(detectPromptAutocompleteTrigger('Explain #ChatInput')).toEqual({
      kind: 'symbol',
      query: 'ChatInput',
      start: 8,
      end: 18,
    });
    expect(detectPromptAutocompleteTrigger('Run /debug')).toEqual({
      kind: 'command',
      query: 'debug',
      start: 4,
      end: 10,
    });
    expect(detectPromptAutocompleteTrigger('Work task:board')).toEqual({
      kind: 'task',
      query: 'board',
      start: 5,
      end: 15,
    });
    expect(detectPromptAutocompleteTrigger('email@test')).toBe(null);
  });

  test('builds file and symbol suggestions from repo index', () => {
    const fileSuggestions = buildPromptAutocompleteSuggestions({
      trigger: { kind: 'file', query: 'chat', start: 0, end: 5 },
      repoIndex,
    });
    expect(fileSuggestions.map((suggestion) => suggestion.value)).toEqual(['@packages/ui/src/components/chat/ChatInput.tsx']);

    const symbolSuggestions = buildPromptAutocompleteSuggestions({
      trigger: { kind: 'symbol', query: 'commit', start: 0, end: 7 },
      repoIndex,
    });
    expect(symbolSuggestions.map((suggestion) => suggestion.value)).toEqual(['#buildCommitSuggestions']);
    expect(symbolSuggestions[0]?.detail?.includes('commitScopes.ts:53')).toBe(true);
  });

  test('builds command and task suggestions from provided sources', () => {
    const commandSuggestions = buildPromptAutocompleteSuggestions({
      trigger: { kind: 'command', query: 'de', start: 0, end: 3 },
      commands: [
        { name: 'debug', description: 'Debug a problem' },
        { name: '/explore', description: 'Research context' },
      ],
    });
    expect(commandSuggestions.map((suggestion) => suggestion.value)).toEqual(['/debug']);

    const taskSuggestions = buildPromptAutocompleteSuggestions({
      trigger: { kind: 'task', query: 'kan', start: 0, end: 8 },
      tasks: [
        { id: 'board-1', title: 'Add Kanban board', status: 'ready' },
        { id: 'docs-1', title: 'Persist docs notes', status: 'done' },
      ],
    });
    expect(taskSuggestions.map((suggestion) => suggestion.value)).toEqual(['task:board-1']);
  });

  test('applies a suggestion by replacing only the active token', () => {
    const value = 'Please inspect @Cha before commit';
    const trigger = detectPromptAutocompleteTrigger(value, 'Please inspect @Cha'.length);
    if (!trigger) throw new Error('expected trigger');

    expect(applyPromptAutocompleteSuggestion({
      value,
      trigger,
      suggestion: { value: '@packages/ui/src/components/chat/ChatInput.tsx' },
    })).toBe('Please inspect @packages/ui/src/components/chat/ChatInput.tsx before commit');
  });
});
