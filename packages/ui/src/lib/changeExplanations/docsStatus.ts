import { codeChangesRequireDocsDecision, detectCodeChanges, docsChangedForCodeChanges } from './detectCodeChanges';

export type DocsCommitStatusInput = {
  path: string;
  index?: string;
  working_dir?: string;
};

export type DocsCommitStatus = {
  hasCodeChanges: boolean;
  hasDocsChanges: boolean;
  docsRequired: boolean;
  isBlocked: boolean;
  codePaths: string[];
  docsPaths: string[];
};

const statusFilesToDiffs = (files: DocsCommitStatusInput[]) => (
  files.map((file) => ({
    file: file.path,
    status: file.index?.trim() || file.working_dir?.trim() || 'M',
  }))
);

const normalizeReason = (reason?: string | null): string => (
  typeof reason === 'string' ? reason.trim() : ''
);

export const buildDocsCommitStatus = ({
  files,
  docsRequiredOnCodeChange,
  notNeededReason,
}: {
  files: DocsCommitStatusInput[];
  docsRequiredOnCodeChange: boolean;
  notNeededReason?: string | null;
}): DocsCommitStatus => {
  const changes = detectCodeChanges({ diffs: statusFilesToDiffs(files) });
  const codeChanges = changes.filter((change) => change.changeKind !== 'docs');
  const docsChanges = changes.filter((change) => change.changeKind === 'docs');
  const hasCodeChanges = codeChangesRequireDocsDecision(changes);
  const hasDocsChanges = docsChangedForCodeChanges(changes);
  const docsRequired = docsRequiredOnCodeChange && hasCodeChanges && !hasDocsChanges;
  const reasonProvided = normalizeReason(notNeededReason).length > 0;

  return {
    hasCodeChanges,
    hasDocsChanges,
    docsRequired,
    isBlocked: docsRequired && !reasonProvided,
    codePaths: codeChanges.map((change) => change.filePath),
    docsPaths: docsChanges.map((change) => change.filePath),
  };
};
