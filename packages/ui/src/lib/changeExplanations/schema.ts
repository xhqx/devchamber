export type ChangeKind = 'add' | 'modify' | 'delete' | 'rename' | 'docs';

export type ChangeExplanationModel = {
  providerID: string;
  modelID: string;
  variant?: string;
};

export type ChangeExplanationRange = {
  startLine: number;
  endLine: number;
};

export type ChangeExplanation = {
  id: string;
  sessionId: string;
  directory: string;
  filePath: string;
  range?: ChangeExplanationRange;
  changeKind: ChangeKind;
  summary: string;
  why: string;
  risks: string[];
  docsUpdated: boolean;
  docsPaths: string[];
  createdAt: string;
  model?: ChangeExplanationModel;
};

export type ChangeExplanationDocsDecision = {
  required: boolean;
  paths: string[];
  suggestedPatch?: string;
  reason?: string;
};

export type ChangeExplanationDraft = {
  sessionId: string;
  directory: string;
  filePath: string;
  range?: ChangeExplanationRange;
  changeKind: ChangeKind;
  summary: string;
  why: string;
  risks?: string[];
  docs?: ChangeExplanationDocsDecision;
  createdAt?: string;
  model?: ChangeExplanationModel;
};

export type ChangeExplanationIndex = {
  version: 1;
  explanations: ChangeExplanation[];
  updatedAt: string;
};

const normalizePath = (path: string): string => (
  path.replace(/\\/g, '/').replace(/^\.\//, '').replace(/\/+/g, '/').replace(/^\/+/, '').trim()
);

const stableHash = (value: string): string => {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
};

export const createChangeExplanationId = ({ sessionId, directory, filePath, range, changeKind }: Pick<ChangeExplanationDraft, 'sessionId' | 'directory' | 'filePath' | 'range' | 'changeKind'>): string => {
  const rangePart = range ? `${range.startLine}-${range.endLine}` : 'file';
  return `ce_${stableHash([sessionId, directory, normalizePath(filePath), rangePart, changeKind].join('|'))}`;
};

export const createChangeExplanation = (draft: ChangeExplanationDraft): ChangeExplanation => {
  const docsPaths = Array.from(new Set((draft.docs?.paths ?? []).map(normalizePath).filter(Boolean))).sort();
  const now = draft.createdAt ?? new Date().toISOString();
  return {
    id: createChangeExplanationId(draft),
    sessionId: draft.sessionId,
    directory: draft.directory,
    filePath: normalizePath(draft.filePath),
    range: draft.range,
    changeKind: draft.changeKind,
    summary: draft.summary.trim(),
    why: draft.why.trim(),
    risks: Array.from(new Set((draft.risks ?? []).map((risk) => risk.trim()).filter(Boolean))),
    docsUpdated: docsPaths.length > 0,
    docsPaths,
    createdAt: now,
    model: draft.model,
  };
};

export const createEmptyChangeExplanationIndex = (updatedAt = new Date().toISOString()): ChangeExplanationIndex => ({
  version: 1,
  explanations: [],
  updatedAt,
});
