import type { RepoIndex, RepoIndexedFile, RepoIndexedSymbol } from '@/lib/repoIndex/schema';

export type PromptAutocompleteKind = 'file' | 'symbol' | 'command' | 'task';

export type PromptAutocompleteCommand = {
  name: string;
  description?: string;
};

export type PromptAutocompleteTask = {
  id: string;
  title: string;
  status?: string;
};

export type PromptAutocompleteSuggestion = {
  id: string;
  kind: PromptAutocompleteKind;
  value: string;
  label: string;
  detail?: string;
  path?: string;
  score: number;
};

export type PromptAutocompleteTrigger = {
  kind: PromptAutocompleteKind;
  query: string;
  start: number;
  end: number;
};

export type BuildPromptAutocompleteSuggestionsInput = {
  trigger: PromptAutocompleteTrigger | null;
  repoIndex?: RepoIndex | null;
  commands?: PromptAutocompleteCommand[];
  tasks?: PromptAutocompleteTask[];
  maxItems?: number;
};

const TOKEN_RE = /(^|\s)([@#/]|task:)([^\s]*)$/;

const normalizeQuery = (value: string): string => value.trim().toLowerCase();

const scoreText = (query: string, ...candidates: Array<string | undefined>): number => {
  if (!query) return 1;
  let best = 0;
  for (const candidate of candidates) {
    const normalized = candidate?.toLowerCase() ?? '';
    if (!normalized) continue;
    if (normalized === query) best = Math.max(best, 100);
    else if (normalized.startsWith(query)) best = Math.max(best, 80 - Math.min(normalized.length - query.length, 30));
    else if (normalized.includes(query)) best = Math.max(best, 40 - Math.min(normalized.indexOf(query), 20));
  }
  return best;
};

const fileDetail = (file: RepoIndexedFile): string => {
  const parts = [file.language, file.isDocs ? 'docs' : undefined, file.packageName].filter(Boolean);
  return parts.join(' · ');
};

const toFileSuggestion = (file: RepoIndexedFile, query: string): PromptAutocompleteSuggestion | null => {
  const score = scoreText(query, file.path, file.name, file.directory);
  if (score <= 0) return null;
  return {
    id: `file:${file.path}`,
    kind: 'file',
    value: `@${file.path}`,
    label: file.name,
    detail: fileDetail(file) || file.directory,
    path: file.path,
    score,
  };
};

const toSymbolSuggestion = (symbol: RepoIndexedSymbol, query: string): PromptAutocompleteSuggestion | null => {
  const score = scoreText(query, symbol.name, symbol.path);
  if (score <= 0) return null;
  return {
    id: `symbol:${symbol.path}:${symbol.line}:${symbol.name}`,
    kind: 'symbol',
    value: `#${symbol.name}`,
    label: symbol.name,
    detail: `${symbol.kind} · ${symbol.path}:${symbol.line}`,
    path: symbol.path,
    score,
  };
};

const toCommandSuggestion = (command: PromptAutocompleteCommand, query: string): PromptAutocompleteSuggestion | null => {
  const name = command.name.replace(/^\//, '');
  const score = scoreText(query, name, command.description);
  if (score <= 0) return null;
  return {
    id: `command:${name}`,
    kind: 'command',
    value: `/${name}`,
    label: `/${name}`,
    detail: command.description,
    score,
  };
};

const toTaskSuggestion = (task: PromptAutocompleteTask, query: string): PromptAutocompleteSuggestion | null => {
  const score = scoreText(query, task.title, task.id, task.status);
  if (score <= 0) return null;
  return {
    id: `task:${task.id}`,
    kind: 'task',
    value: `task:${task.id}`,
    label: task.title,
    detail: task.status,
    score,
  };
};

export const detectPromptAutocompleteTrigger = (value: string, cursorPosition = value.length): PromptAutocompleteTrigger | null => {
  const beforeCursor = value.slice(0, Math.max(0, cursorPosition));
  const match = TOKEN_RE.exec(beforeCursor);
  if (!match || match.index == null) return null;

  const boundary = match[1] ?? '';
  const marker = match[2] ?? '';
  const query = match[3] ?? '';
  const start = match.index + boundary.length;
  const end = beforeCursor.length;

  if (marker === '@') return { kind: 'file', query, start, end };
  if (marker === '#') return { kind: 'symbol', query, start, end };
  if (marker === '/') return { kind: 'command', query, start, end };
  if (marker === 'task:') return { kind: 'task', query, start, end };
  return null;
};

export const buildPromptAutocompleteSuggestions = ({
  trigger,
  repoIndex,
  commands = [],
  tasks = [],
  maxItems = 12,
}: BuildPromptAutocompleteSuggestionsInput): PromptAutocompleteSuggestion[] => {
  if (!trigger) return [];
  const query = normalizeQuery(trigger.query);
  const source = trigger.kind === 'file'
    ? (repoIndex?.files ?? []).map((file) => toFileSuggestion(file, query))
    : trigger.kind === 'symbol'
      ? (repoIndex?.symbols ?? []).map((symbol) => toSymbolSuggestion(symbol, query))
      : trigger.kind === 'command'
        ? commands.map((command) => toCommandSuggestion(command, query))
        : tasks.map((task) => toTaskSuggestion(task, query));

  const unique = new Map<string, PromptAutocompleteSuggestion>();
  for (const suggestion of source) {
    if (!suggestion) continue;
    const existing = unique.get(suggestion.id);
    if (!existing || suggestion.score > existing.score) {
      unique.set(suggestion.id, suggestion);
    }
  }

  return Array.from(unique.values())
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label) || a.value.localeCompare(b.value))
    .slice(0, maxItems);
};

export const applyPromptAutocompleteSuggestion = ({
  value,
  trigger,
  suggestion,
}: {
  value: string;
  trigger: PromptAutocompleteTrigger;
  suggestion: Pick<PromptAutocompleteSuggestion, 'value'>;
}): string => {
  const suffix = value.slice(trigger.end);
  const separator = suffix.length === 0 || /^\s/.test(suffix) ? '' : ' ';
  return `${value.slice(0, trigger.start)}${suggestion.value}${separator}${suffix}`;
};
