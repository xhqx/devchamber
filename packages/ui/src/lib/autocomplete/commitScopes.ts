export type CommitSuggestion = {
  value: string;
  label: string;
  detail?: string;
};

const CONVENTIONAL_TYPES: Array<{ type: string; label: string }> = [
  { type: 'feat', label: 'Feature' },
  { type: 'fix', label: 'Fix' },
  { type: 'docs', label: 'Docs' },
  { type: 'refactor', label: 'Refactor' },
  { type: 'test', label: 'Tests' },
  { type: 'chore', label: 'Chore' },
];

const KNOWN_SCOPE_ALIASES: Record<string, string> = {
  packages: '',
  src: '',
  docs: 'docs',
  test: 'test',
  tests: 'test',
};

const normalizePath = (path: string): string => path.replace(/\\/g, '/').replace(/^\.\//, '');

export const inferCommitScopesFromFiles = (files: string[], limit = 8): string[] => {
  const scopes = new Set<string>();

  for (const rawPath of files) {
    const normalized = normalizePath(rawPath).trim();
    if (!normalized) continue;

    const parts = normalized.split('/').filter(Boolean);
    const first = parts[0] ?? '';
    const second = parts[1] ?? '';
    const candidate = first === 'packages' && second ? second : (KNOWN_SCOPE_ALIASES[first] ?? first);
    const cleaned = candidate
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/^-+|-+$/g, '');

    if (cleaned) {
      scopes.add(cleaned);
    }

    if (scopes.size >= limit) break;
  }

  return Array.from(scopes);
};

export const buildCommitSuggestions = ({
  files,
  currentValue,
  maxItems = 12,
}: {
  files: string[];
  currentValue: string;
  maxItems?: number;
}): CommitSuggestion[] => {
  const value = currentValue.trimStart().toLowerCase();
  const scopes = inferCommitScopesFromFiles(files);
  const suggestions: CommitSuggestion[] = [];

  for (const { type, label } of CONVENTIONAL_TYPES) {
    suggestions.push({ value: `${type}: `, label, detail: 'Conventional commit type' });
    for (const scope of scopes.slice(0, 4)) {
      suggestions.push({ value: `${type}(${scope}): `, label: `${label} (${scope})`, detail: 'Inferred from staged files' });
    }
  }

  const unique = new Map<string, CommitSuggestion>();
  for (const suggestion of suggestions) {
    if (!unique.has(suggestion.value)) {
      unique.set(suggestion.value, suggestion);
    }
  }

  return Array.from(unique.values())
    .filter((suggestion) => !value || suggestion.value.toLowerCase().startsWith(value) || suggestion.label.toLowerCase().includes(value))
    .slice(0, maxItems);
};
