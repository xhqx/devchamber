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
    truncated,
  };
};
