export type CommitGenerationVariantTone = 'direct' | 'conventional' | 'release-note';

export type CommitGenerationVariant = {
  id: CommitGenerationVariantTone;
  label: string;
  subject: string;
  detail: string;
};

export type CommitGenerationBudget = {
  maxFiles: number;
  omittedFiles: string[];
  includedFiles: string[];
};

const DEFAULT_MAX_FILES = 40;
const MIN_MAX_FILES = 1;
const MAX_MAX_FILES = 300;

const CONVENTIONAL_TYPE_PATTERN = /^(build|chore|ci|docs|feat|fix|perf|refactor|revert|style|test)(\([^)]+\))?:\s+/i;

export const normalizeCommitGenerationFileBudget = (value: unknown, fallback = DEFAULT_MAX_FILES): number => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(MIN_MAX_FILES, Math.min(MAX_MAX_FILES, Math.floor(numeric)));
};

export const applyCommitGenerationFileBudget = (
  files: string[],
  maxFiles: number = DEFAULT_MAX_FILES,
): CommitGenerationBudget => {
  const normalizedBudget = normalizeCommitGenerationFileBudget(maxFiles);
  const normalizedFiles = Array.from(new Set(files
    .map((file) => typeof file === 'string' ? file.trim() : '')
    .filter(Boolean)))
    .sort();

  return {
    maxFiles: normalizedBudget,
    includedFiles: normalizedFiles.slice(0, normalizedBudget),
    omittedFiles: normalizedFiles.slice(normalizedBudget),
  };
};

const sentenceCase = (value: string): string => {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
};

const stripConventionalPrefix = (subject: string): string => (
  subject.replace(CONVENTIONAL_TYPE_PATTERN, '').trim()
);

const inferConventionalType = (subject: string, highlights: string[]): string => {
  const match = subject.match(CONVENTIONAL_TYPE_PATTERN);
  if (match?.[1]) return match[1].toLowerCase();

  const haystack = `${subject}\n${highlights.join('\n')}`.toLowerCase();
  if (/\b(fix|bug|regression|crash|error|broken)\b/.test(haystack)) return 'fix';
  if (/\b(doc|docs|readme|guide)\b/.test(haystack)) return 'docs';
  if (/\b(test|spec|coverage)\b/.test(haystack)) return 'test';
  if (/\b(refactor|cleanup|simplif)\b/.test(haystack)) return 'refactor';
  return 'feat';
};

const dedupeVariants = (variants: CommitGenerationVariant[]): CommitGenerationVariant[] => {
  const seen = new Set<string>();
  return variants.filter((variant) => {
    const key = variant.subject.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildCommitGenerationVariants = ({
  subject,
  highlights = [],
}: {
  subject: string;
  highlights?: string[];
}): CommitGenerationVariant[] => {
  const normalizedSubject = subject.trim();
  if (!normalizedSubject) return [];

  const body = stripConventionalPrefix(normalizedSubject) || normalizedSubject;
  const type = inferConventionalType(normalizedSubject, highlights);
  const conventionalSubject = CONVENTIONAL_TYPE_PATTERN.test(normalizedSubject)
    ? normalizedSubject
    : `${type}: ${body}`;
  const releaseNoteSubject = `${sentenceCase(body).replace(/[.!?]+$/, '')}.`;

  return dedupeVariants([
    {
      id: 'direct',
      label: 'Direct',
      subject: normalizedSubject,
      detail: 'Use the generated subject as-is.',
    },
    {
      id: 'conventional',
      label: 'Conventional',
      subject: conventionalSubject,
      detail: 'Use a conventional commit prefix.',
    },
    {
      id: 'release-note',
      label: 'Release note',
      subject: releaseNoteSubject,
      detail: 'Use a human-readable release-note style.',
    },
  ]);
};
