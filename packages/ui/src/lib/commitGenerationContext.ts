import { codeChangesRequireDocsDecision, detectCodeChanges, docsChangedForCodeChanges } from './changeExplanations/detectCodeChanges';

export type CommitGenerationStatusEntry = {
  path: string;
  index?: string;
  working_dir?: string;
};

export type CommitGenerationDiffEntry = {
  path: string;
  diff?: string;
  error?: string;
};

export type CommitGenerationPromptContext = {
  selectedFiles: string;
  diffContext: string;
  docsContext: string;
  truncated: boolean;
};

type BuildCommitGenerationPromptContextOptions = {
  files: string[];
  statusFiles?: CommitGenerationStatusEntry[];
  diffs?: CommitGenerationDiffEntry[];
  maxChars?: number;
};

const DEFAULT_MAX_CHARS = 40_000;
const MIN_MAX_CHARS = 1_000;
const MAX_MAX_CHARS = 100_000;

const normalizeMaxChars = (value: unknown): number => {
  const numeric = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : DEFAULT_MAX_CHARS;
  return Math.max(MIN_MAX_CHARS, Math.min(MAX_MAX_CHARS, numeric));
};

const normalizeFiles = (files: string[]): string[] => (
  Array.from(new Set(files.map((file) => file.trim()).filter(Boolean))).sort()
);

const statusLabel = (entry?: CommitGenerationStatusEntry): string => {
  if (!entry) return 'selected';
  const index = entry.index?.trim() || '?';
  const working = entry.working_dir?.trim() || '?';
  return `index=${index} working=${working}`;
};

const statusEntriesToDiffs = (entries: CommitGenerationStatusEntry[]) => (
  entries.map((entry) => ({
    file: entry.path,
    status: entry.index?.trim() || entry.working_dir?.trim() || 'M',
  }))
);

export const buildCommitGenerationDocsContext = (statusFiles: CommitGenerationStatusEntry[]): string => {
  const changes = detectCodeChanges({ diffs: statusEntriesToDiffs(statusFiles) });
  const codeChanges = changes.filter((change) => change.changeKind !== 'docs');
  const docsChanges = changes.filter((change) => change.changeKind === 'docs');

  if (!codeChangesRequireDocsDecision(changes) && !docsChangedForCodeChanges(changes)) {
    return 'No code or documentation changes detected in selected status metadata.';
  }

  const lines = [
    codeChanges.length > 0
      ? 'Docs decision required: explain whether these code changes need documentation updates.'
      : 'Documentation-only change detected: describe the docs update accurately.',
  ];

  if (codeChanges.length > 0) {
    lines.push('Code changes:', ...codeChanges.map((change) => `- ${change.filePath} (${change.changeKind})`));
  }

  if (docsChanges.length > 0) {
    lines.push('Documentation changes:', ...docsChanges.map((change) => `- ${change.filePath}`));
  } else if (codeChanges.length > 0) {
    lines.push('Documentation changes: none detected in selected files.');
  }

  return lines.join('\n');
};

const clampWithNotice = (value: string, maxChars: number): { value: string; truncated: boolean } => {
  if (value.length <= maxChars) {
    return { value, truncated: false };
  }
  const notice = '\n\n[diff context truncated to stay within prompt budget]';
  return {
    value: `${value.slice(0, Math.max(0, maxChars - notice.length)).trimEnd()}${notice}`,
    truncated: true,
  };
};

export const buildCommitGenerationPromptContext = ({
  files,
  statusFiles = [],
  diffs = [],
  maxChars,
}: BuildCommitGenerationPromptContextOptions): CommitGenerationPromptContext => {
  const normalizedFiles = normalizeFiles(files);
  const maxDiffChars = normalizeMaxChars(maxChars);
  const statusByPath = new Map(statusFiles.map((entry) => [entry.path, entry]));
  const diffByPath = new Map(diffs.map((entry) => [entry.path, entry]));

  const selectedFiles = normalizedFiles
    .map((file) => `- ${file} (${statusLabel(statusByPath.get(file))})`)
    .join('\n');

  const docsContext = buildCommitGenerationDocsContext(
    statusFiles.filter((entry) => normalizedFiles.includes(entry.path)),
  );

  const rawDiffContext = normalizedFiles
    .map((file) => {
      const diffEntry = diffByPath.get(file);
      const header = `### ${file} (${statusLabel(statusByPath.get(file))})`;
      if (diffEntry?.error) {
        return `${header}\n[diff unavailable: ${diffEntry.error}]`;
      }
      const diff = diffEntry?.diff?.trim();
      if (!diff) {
        return `${header}\n[no staged diff available]`;
      }
      return `${header}\n\`\`\`diff\n${diff}\n\`\`\``;
    })
    .join('\n\n');

  const { value: diffContext, truncated } = clampWithNotice(rawDiffContext, maxDiffChars);

  return {
    selectedFiles,
    diffContext,
    docsContext,
    truncated,
  };
};
