import type { FileDiff } from '../../sync/types';
import type { ChangeKind } from './schema';

export type DetectedCodeChange = {
  filePath: string;
  changeKind: ChangeKind;
  source: 'diff' | 'part';
  summary: string;
};

export type DetectCodeChangesInput = {
  diffs?: FileDiff[];
  parts?: unknown[];
};

const CODE_EXTENSIONS = new Set([
  'astro', 'c', 'cc', 'cpp', 'cs', 'css', 'go', 'h', 'hpp', 'html', 'java', 'js', 'jsx', 'kt', 'mjs', 'mm', 'php', 'py', 'rb', 'rs', 'scss', 'sh', 'svelte', 'swift', 'ts', 'tsx', 'vue', 'yaml', 'yml',
]);

const DOC_EXTENSIONS = new Set(['adoc', 'md', 'mdx', 'rst', 'txt']);
const CODE_CHANGE_TOOL_NAMES = new Set(['edit', 'patch', 'write', 'write_file', 'str_replace', 'str_replace_editor']);

const normalizePath = (path: string): string => (
  path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/^\/+/, '').trim()
);

const extensionOf = (path: string): string => {
  const name = path.split('/').pop() ?? path;
  const index = name.lastIndexOf('.');
  return index === -1 ? '' : name.slice(index + 1).toLowerCase();
};

export const isDocumentationPath = (path: string): boolean => {
  const normalized = normalizePath(path).toLowerCase();
  if (!normalized) return false;
  if (normalized.includes('/docs/') || normalized.startsWith('docs/')) return true;
  const basename = normalized.split('/').pop() ?? normalized;
  return basename.startsWith('readme.') || DOC_EXTENSIONS.has(extensionOf(normalized));
};

export const isCodePath = (path: string): boolean => {
  const normalized = normalizePath(path).toLowerCase();
  if (!normalized || isDocumentationPath(normalized)) return false;
  return CODE_EXTENSIONS.has(extensionOf(normalized));
};

const changeKindFromStatus = (status: unknown): ChangeKind => {
  const normalized = typeof status === 'string' ? status.toLowerCase() : '';
  if (normalized.includes('delete') || normalized === 'd') return 'delete';
  if (normalized.includes('rename') || normalized === 'r') return 'rename';
  if (normalized.includes('add') || normalized === 'a' || normalized === '??') return 'add';
  return 'modify';
};

const addChange = (changes: Map<string, DetectedCodeChange>, change: DetectedCodeChange) => {
  const normalized = normalizePath(change.filePath);
  if (!normalized) return;
  const key = `${normalized}:${change.changeKind}`;
  if (!changes.has(key)) {
    changes.set(key, { ...change, filePath: normalized });
  }
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' ? value as Record<string, unknown> : {}
);

const extractToolName = (part: Record<string, unknown>): string => {
  const tool = part.tool ?? part.name;
  if (typeof tool === 'string') return tool.toLowerCase();
  const call = asRecord(part.call);
  const callName = call.name;
  return typeof callName === 'string' ? callName.toLowerCase() : '';
};

const extractToolPath = (part: Record<string, unknown>): string | undefined => {
  const candidates: unknown[] = [
    part.path,
    part.filePath,
    part.filename,
    asRecord(part.input).path,
    asRecord(part.input).filePath,
    asRecord(part.args).path,
    asRecord(part.args).filePath,
    asRecord(asRecord(part.call).input).path,
  ];
  const found = candidates.find((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
  return found ? normalizePath(found) : undefined;
};

export const detectCodeChanges = ({ diffs = [], parts = [] }: DetectCodeChangesInput): DetectedCodeChange[] => {
  const changes = new Map<string, DetectedCodeChange>();

  for (const diff of diffs) {
    const filePath = typeof diff.file === 'string' ? normalizePath(diff.file) : '';
    if (!filePath) continue;
    const changeKind = isDocumentationPath(filePath) ? 'docs' : changeKindFromStatus(diff.status);
    if (changeKind !== 'docs' && !isCodePath(filePath)) continue;
    addChange(changes, {
      filePath,
      changeKind,
      source: 'diff',
      summary: `${changeKind} ${filePath}`,
    });
  }

  for (const rawPart of parts) {
    const part = asRecord(rawPart);
    const type = typeof part.type === 'string' ? part.type.toLowerCase() : '';
    if (type !== 'tool' && type !== 'patch') continue;
    const toolName = extractToolName(part);
    const filePath = extractToolPath(part);
    if (!filePath || (toolName && !CODE_CHANGE_TOOL_NAMES.has(toolName) && type !== 'patch')) continue;
    const changeKind = isDocumentationPath(filePath) ? 'docs' : 'modify';
    if (changeKind !== 'docs' && !isCodePath(filePath)) continue;
    addChange(changes, {
      filePath,
      changeKind,
      source: 'part',
      summary: `${toolName || type} changed ${filePath}`,
    });
  }

  return Array.from(changes.values()).sort((left, right) => left.filePath.localeCompare(right.filePath));
};

export const docsChangedForCodeChanges = (changes: DetectedCodeChange[]): boolean => (
  changes.some((change) => change.changeKind === 'docs')
);

export const codeChangesRequireDocsDecision = (changes: DetectedCodeChange[]): boolean => (
  changes.some((change) => change.changeKind !== 'docs')
);
