export type CodeAutocompleteRequest = {
  text: string;
  offset: number;
  linePrefix: string;
  lineSuffix: string;
  languageId?: string;
  agentName?: string;
  maxSuggestionLength?: number;
  multilineEnabled?: boolean;
  maxSuggestionLines?: number;
  minPrefixLength?: number;
};

export type CodeAutocompleteSuggestion = {
  insertText: string;
  kind: 'identifier' | 'member' | 'line' | 'multiline';
};

const DEFAULT_MAX_SUGGESTION_LENGTH = 120;
const DEFAULT_MAX_SUGGESTION_LINES = 6;
const MAX_SCAN_CHARS = 80_000;
const DEFAULT_MIN_IDENTIFIER_PREFIX_LENGTH = 2;
const IDENTIFIER_PATTERN = /[A-Za-z_$][\w$]*/g;
const MEMBER_PATTERN = /\.([A-Za-z_$][\w$]*)/g;
const UNSUPPORTED_LANGUAGE_IDS = new Set([
  'git-commit',
  'ignore',
  'log',
  'markdown',
  'plaintext',
  'restructuredtext',
  'scminput',
]);

const currentIdentifierPrefix = (linePrefix: string): string => {
  const match = linePrefix.match(/[A-Za-z_$][\w$]*$/);
  return match?.[0] ?? '';
};

const hasOnlyClosingTextAfterCursor = (lineSuffix: string): boolean => /^[\s)}\];,.]*$/.test(lineSuffix);

const trimSuggestion = (value: string, maxLength: number): string => value.slice(0, maxLength).replace(/[\s\r\n]+$/g, '');

const scoreCandidate = (candidate: string, prefix: string, lastIndex: number, offset: number): number => {
  const distance = Math.abs(offset - lastIndex);
  const recencyScore = Math.max(0, 50_000 - distance) / 50_000;
  const exactCaseBonus = candidate.startsWith(prefix) ? 2 : 0;
  const lengthPenalty = Math.min(candidate.length, 80) / 200;
  return exactCaseBonus + recencyScore - lengthPenalty;
};

const collectIdentifierSuggestion = (request: CodeAutocompleteRequest): CodeAutocompleteSuggestion | null => {
  const prefix = currentIdentifierPrefix(request.linePrefix);
  const minPrefixLength = request.minPrefixLength ?? DEFAULT_MIN_IDENTIFIER_PREFIX_LENGTH;
  if (prefix.length < minPrefixLength) return null;

  const scanStart = Math.max(0, request.offset - MAX_SCAN_CHARS);
  const scanEnd = Math.min(request.text.length, request.offset + MAX_SCAN_CHARS / 4);
  const scanText = request.text.slice(scanStart, scanEnd);
  const lowerPrefix = prefix.toLowerCase();
  const candidates = new Map<string, { lastIndex: number; count: number }>();

  for (const match of scanText.matchAll(IDENTIFIER_PATTERN)) {
    const candidate = match[0];
    if (candidate.length <= prefix.length) continue;
    if (candidate.toLowerCase() === lowerPrefix) continue;
    if (!candidate.toLowerCase().startsWith(lowerPrefix)) continue;
    const index = scanStart + (match.index ?? 0);
    // Ignore the current token under the cursor.
    if (index <= request.offset && request.offset <= index + candidate.length) continue;
    const existing = candidates.get(candidate);
    candidates.set(candidate, {
      count: (existing?.count ?? 0) + 1,
      lastIndex: Math.max(existing?.lastIndex ?? 0, index),
    });
  }

  let best: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const [candidate, meta] of candidates) {
    const score = scoreCandidate(candidate, prefix, meta.lastIndex, request.offset) + Math.log2(meta.count + 1) / 4;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best) return null;
  return { insertText: best.slice(prefix.length), kind: 'identifier' };
};

const collectMemberSuggestion = (request: CodeAutocompleteRequest): CodeAutocompleteSuggestion | null => {
  if (!/[?.]$/.test(request.linePrefix.trimEnd())) return null;

  const beforeCursor = request.text.slice(Math.max(0, request.offset - MAX_SCAN_CHARS), request.offset);
  const counts = new Map<string, number>();
  for (const match of beforeCursor.matchAll(MEMBER_PATTERN)) {
    const member = match[1];
    if (!member || member.length < 2) continue;
    counts.set(member, (counts.get(member) ?? 0) + 1);
  }

  const best = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length || a[0].localeCompare(b[0]))[0]?.[0];
  return best ? { insertText: best, kind: 'member' } : null;
};


const lineIndentLength = (value: string): number => value.match(/^\s*/)?.[0].length ?? 0;

const stripTrailingBlankLines = (lines: string[]): string[] => {
  const next = lines.slice();
  while (next.length > 0 && next[next.length - 1].trim().length === 0) next.pop();
  return next;
};

const collectMultilineSuggestion = (request: CodeAutocompleteRequest): CodeAutocompleteSuggestion | null => {
  if (request.multilineEnabled === false) return null;

  const currentPrefix = request.linePrefix.trimStart();
  const currentTrimmedEnd = request.linePrefix.trimEnd();
  if (currentPrefix.length < 3) return null;
  if (!/[{[(]$/.test(currentTrimmedEnd)) return null;
  const blockKeyword = currentPrefix.match(/^(if|for|while|switch|try|catch|else|function|class|describe|test|it)\b/)?.[1] ?? null;
  const currentIndent = request.linePrefix.slice(0, lineIndentLength(request.linePrefix));
  const maxLines = Math.max(1, Math.min(20, request.maxSuggestionLines ?? DEFAULT_MAX_SUGGESTION_LINES));
  if (maxLines <= 1) return null;

  const beforeCursor = request.text.slice(Math.max(0, request.offset - MAX_SCAN_CHARS), request.offset);
  const lines = beforeCursor.split(/\r?\n/);
  // The final line is the active cursor line. Search only completed prior lines.
  const priorLines = lines.slice(0, -1);

  for (let index = priorLines.length - 1; index >= 0; index -= 1) {
    const candidateLine = priorLines[index];
    const candidateTrimmed = candidateLine.trimStart();
    const candidateKeyword = candidateTrimmed.match(/^(if|for|while|switch|try|catch|else|function|class|describe|test|it)\b/)?.[1] ?? null;
    const startsWithCurrentPrefix = candidateTrimmed.startsWith(currentPrefix);
    const matchesBlockShape = Boolean(blockKeyword && candidateKeyword === blockKeyword && /[{[(]\s*$/.test(candidateTrimmed));
    if (!startsWithCurrentPrefix && !matchesBlockShape) continue;

    const candidateIndentLength = lineIndentLength(candidateLine);
    const candidateIndent = candidateLine.slice(0, candidateIndentLength);
    const firstLineSuffix = candidateTrimmed.slice(currentPrefix.length);
    const continuation: string[] = [];

    for (let nextIndex = index + 1; nextIndex < priorLines.length && continuation.length < maxLines - 1; nextIndex += 1) {
      const nextLine = priorLines[nextIndex];
      const nextTrimmed = nextLine.trim();
      if (nextTrimmed.length === 0) {
        continuation.push('');
        continue;
      }

      const nextIndentLength = lineIndentLength(nextLine);
      if (nextIndentLength < candidateIndentLength) break;

      const normalizedLine = nextLine.startsWith(candidateIndent)
        ? `${currentIndent}${nextLine.slice(candidateIndent.length)}`
        : `${currentIndent}${nextLine.trimStart()}`;
      continuation.push(normalizedLine);

      if (nextIndentLength === candidateIndentLength && /^[}\])]/.test(nextTrimmed)) break;
      if (nextIndentLength === candidateIndentLength && nextIndex > index + 1) break;
    }

    const body = stripTrailingBlankLines(continuation);
    if (firstLineSuffix.length === 0 && body.length === 0) continue;
    if (body.length === 0) continue;

    const insertText = [firstLineSuffix, ...body].join('\n');
    if (insertText.trim().length === 0) continue;
    return { insertText, kind: 'multiline' };
  }

  return null;
};

const collectRepeatedLineSuggestion = (request: CodeAutocompleteRequest): CodeAutocompleteSuggestion | null => {
  const currentPrefix = request.linePrefix.trimStart();
  if (currentPrefix.length < 4) return null;

  const beforeCursor = request.text.slice(Math.max(0, request.offset - MAX_SCAN_CHARS), request.offset);
  const lines = beforeCursor.split(/\r?\n/).slice(0, -1).reverse();
  for (const line of lines) {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith(currentPrefix) || trimmed.length <= currentPrefix.length) continue;
    const suffix = trimmed.slice(currentPrefix.length);
    if (/^[\w$()[\].,'"`:{},\s+-]+$/.test(suffix)) {
      return { insertText: suffix, kind: 'line' };
    }
  }

  return null;
};

export const buildCodeAutocompleteSuggestion = (request: CodeAutocompleteRequest): CodeAutocompleteSuggestion | null => {
  if (request.offset < 0 || request.offset > request.text.length) return null;
  if (request.languageId && UNSUPPORTED_LANGUAGE_IDS.has(request.languageId)) return null;
  if (!hasOnlyClosingTextAfterCursor(request.lineSuffix)) return null;

  const maxLength = request.maxSuggestionLength ?? DEFAULT_MAX_SUGGESTION_LENGTH;
  const suggestion = collectMultilineSuggestion(request)
    ?? collectIdentifierSuggestion(request)
    ?? collectMemberSuggestion(request)
    ?? collectRepeatedLineSuggestion(request);

  if (!suggestion) return null;
  const insertText = trimSuggestion(suggestion.insertText, maxLength);
  if (!insertText || insertText === request.lineSuffix) return null;
  return { ...suggestion, insertText };
};
