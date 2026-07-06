import type { FilesAPI } from '@/lib/api/types';
import type { ChangeExplanation } from './schema';

export const CHANGE_NOTES_DIRECTORY = '.openchamber/change-notes';

export type ChangeNotesIndexEntry = {
  sessionId: string;
  path: string;
  explanationCount: number;
  files: string[];
  updatedAt: string;
};

export type ChangeNotesIndex = {
  version: 1;
  entries: ChangeNotesIndexEntry[];
};

export type PersistChangeNotesRequest = {
  files: Pick<FilesAPI, 'createDirectory' | 'readFile' | 'writeFile'>;
  projectRoot: string;
  sessionId: string;
  explanations: ChangeExplanation[];
  now?: string;
};

export type PersistChangeNotesResult = {
  notesPath: string;
  indexPath: string;
  explanationCount: number;
};

const normalizePath = (value: string): string => value.replace(/\\/g, '/').replace(/\/+$/, '');

export const sanitizeChangeNotesSessionId = (sessionId: string): string => {
  const sanitized = sessionId.trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'session';
};

const formatRange = (explanation: ChangeExplanation): string => {
  if (!explanation.range) return '';
  return explanation.range.startLine === explanation.range.endLine
    ? `:${explanation.range.startLine}`
    : `:${explanation.range.startLine}-${explanation.range.endLine}`;
};

const uniqueSorted = (values: string[]): string[] => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));

export const renderChangeNotesMarkdown = (params: {
  sessionId: string;
  explanations: ChangeExplanation[];
  updatedAt: string;
}): string => {
  const explanations = [...params.explanations].sort((a, b) => (
    a.filePath.localeCompare(b.filePath)
    || (a.range?.startLine ?? 0) - (b.range?.startLine ?? 0)
    || a.id.localeCompare(b.id)
  ));
  const files = uniqueSorted(explanations.map((entry) => entry.filePath));
  const lines: string[] = [
    `# Change notes for ${params.sessionId}`,
    '',
    `- Updated: ${params.updatedAt}`,
    `- Explanations: ${explanations.length}`,
    `- Files: ${files.length}`,
    '',
  ];

  if (files.length > 0) {
    lines.push('## Files', '');
    files.forEach((file) => lines.push(`- \`${file}\``));
    lines.push('');
  }

  lines.push('## Explanations', '');
  if (explanations.length === 0) {
    lines.push('_No generated change explanations._', '');
    return `${lines.join('\n').trimEnd()}\n`;
  }

  for (const explanation of explanations) {
    lines.push(`### ${explanation.filePath}${formatRange(explanation)}`, '');
    lines.push(`- Kind: ${explanation.changeKind}`);
    lines.push(`- Summary: ${explanation.summary}`);
    lines.push(`- Why: ${explanation.why}`);
    if (explanation.risks.length > 0) {
      lines.push('- Risks:');
      explanation.risks.forEach((risk) => lines.push(`  - ${risk}`));
    }
    if (explanation.docsPaths.length > 0) {
      lines.push('- Docs paths:');
      explanation.docsPaths.forEach((path) => lines.push(`  - \`${path}\``));
    }
    lines.push('');
  }

  return `${lines.join('\n').trimEnd()}\n`;
};

const parseChangeNotesIndex = (raw: string): ChangeNotesIndex => {
  if (!raw.trim()) return { version: 1, entries: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<ChangeNotesIndex>;
    return {
      version: 1,
      entries: Array.isArray(parsed.entries) ? parsed.entries.filter((entry): entry is ChangeNotesIndexEntry => (
        typeof entry?.sessionId === 'string'
        && typeof entry?.path === 'string'
        && typeof entry?.updatedAt === 'string'
        && typeof entry?.explanationCount === 'number'
        && Array.isArray(entry?.files)
      )) : [],
    };
  } catch {
    return { version: 1, entries: [] };
  }
};

export const upsertChangeNotesIndexEntry = (
  index: ChangeNotesIndex,
  entry: ChangeNotesIndexEntry,
): ChangeNotesIndex => ({
  version: 1,
  entries: [
    entry,
    ...index.entries.filter((existing) => existing.sessionId !== entry.sessionId),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
});

export const persistChangeNotesToProject = async ({
  files,
  projectRoot,
  sessionId,
  explanations,
  now = new Date().toISOString(),
}: PersistChangeNotesRequest): Promise<PersistChangeNotesResult> => {
  if (!files.writeFile) {
    throw new Error('Project file writes are not available in this runtime.');
  }
  const root = normalizePath(projectRoot);
  if (!root) {
    throw new Error('Project root is required to save change notes.');
  }
  const safeSessionId = sanitizeChangeNotesSessionId(sessionId);
  const notesDir = `${root}/${CHANGE_NOTES_DIRECTORY}`;
  const notesPath = `${notesDir}/${safeSessionId}.md`;
  const indexPath = `${notesDir}/index.json`;

  await files.createDirectory(notesDir);
  await files.writeFile(notesPath, renderChangeNotesMarkdown({ sessionId, explanations, updatedAt: now }));

  if (files.readFile) {
    const rawIndex = await files.readFile(indexPath).then((result) => result.content).catch(() => '');
    const index = upsertChangeNotesIndexEntry(parseChangeNotesIndex(rawIndex), {
      sessionId,
      path: `${CHANGE_NOTES_DIRECTORY}/${safeSessionId}.md`,
      explanationCount: explanations.length,
      files: uniqueSorted(explanations.map((entry) => entry.filePath)),
      updatedAt: now,
    });
    await files.writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  }

  return { notesPath, indexPath, explanationCount: explanations.length };
};
