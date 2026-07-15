export type AutoApprovePolicy = {
  enabled: boolean;
  timeoutSeconds: number;
  allowedTools: string[];
  deniedTools: string[];
  allowedCommandPatterns: string[];
  deniedCommandPatterns: string[];
  maxCommandsPerSession: number;
  requireWorkspacePath: boolean;
};

export type AutoApproveRequest = {
  toolName: string;
  command?: string;
  cwd?: string;
  workspacePath?: string;
  sessionApprovedCount?: number;
};

export type AutoApproveDecision = {
  approved: boolean;
  reason: string;
  timeoutSeconds: number;
};

export const DEFAULT_DENIED_COMMAND_PATTERNS = [
  String.raw`\brm\s+-rf\s+/`,
  String.raw`\bsudo\b`,
  String.raw`security\s+find-(?:generic|internet)-password`,
  String.raw`\bcurl\b.*\|\s*(?:sh|bash|zsh)\b`,
  String.raw`\bwget\b.*\|\s*(?:sh|bash|zsh)\b`,
  String.raw`\bdiskutil\s+(?:erase|partition|apfs\s+delete)`,
  String.raw`\bmkfs(?:\.|\s)`,
  String.raw`(?:AWS_SECRET_ACCESS_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GITHUB_TOKEN)`,
  String.raw`\b(?:scp|rsync|curl)\b.*(?:id_rsa|\.ssh|credentials|secrets?)`,
];

export const DEFAULT_AUTO_APPROVE_POLICY: AutoApprovePolicy = {
  enabled: false,
  timeoutSeconds: 30,
  allowedTools: [],
  deniedTools: [],
  allowedCommandPatterns: [],
  deniedCommandPatterns: DEFAULT_DENIED_COMMAND_PATTERNS,
  maxCommandsPerSession: 20,
  requireWorkspacePath: true,
};

export const clampAutoApproveTimeout = (timeoutSeconds: number): number => (
  Math.max(5, Math.min(600, Math.floor(Number.isFinite(timeoutSeconds) ? timeoutSeconds : 30)))
);

export const normalizeAutoApprovePolicy = (policy: Partial<AutoApprovePolicy> = {}): AutoApprovePolicy => ({
  enabled: typeof policy.enabled === 'boolean' ? policy.enabled : DEFAULT_AUTO_APPROVE_POLICY.enabled,
  timeoutSeconds: clampAutoApproveTimeout(policy.timeoutSeconds ?? DEFAULT_AUTO_APPROVE_POLICY.timeoutSeconds),
  allowedTools: Array.isArray(policy.allowedTools) ? policy.allowedTools.filter(Boolean) : [],
  deniedTools: Array.isArray(policy.deniedTools) ? policy.deniedTools.filter(Boolean) : [],
  allowedCommandPatterns: Array.isArray(policy.allowedCommandPatterns) ? policy.allowedCommandPatterns.filter(Boolean) : [],
  deniedCommandPatterns: [
    ...DEFAULT_DENIED_COMMAND_PATTERNS,
    ...(Array.isArray(policy.deniedCommandPatterns) ? policy.deniedCommandPatterns.filter(Boolean) : []),
  ],
  maxCommandsPerSession: Math.max(1, Math.floor(policy.maxCommandsPerSession ?? DEFAULT_AUTO_APPROVE_POLICY.maxCommandsPerSession)),
  requireWorkspacePath: typeof policy.requireWorkspacePath === 'boolean'
    ? policy.requireWorkspacePath
    : DEFAULT_AUTO_APPROVE_POLICY.requireWorkspacePath,
});

const hasWildcard = (patterns: string[]): boolean => (
  patterns.some((pattern) => pattern.trim() === '*' || pattern.trim().toLowerCase() === 'all')
);

const matchesAnyPattern = (value: string, patterns: string[]): boolean => patterns.some((pattern) => {
  const trimmedPattern = pattern.trim();
  if (trimmedPattern === '*' || trimmedPattern.toLowerCase() === 'all') {
    return true;
  }
  try {
    return new RegExp(trimmedPattern, 'i').test(value);
  } catch {
    return value.toLowerCase().includes(trimmedPattern.toLowerCase());
  }
});

const pathIsInsideWorkspace = (cwd: string | undefined, workspacePath: string | undefined): boolean => {
  if (!cwd || !workspacePath) {
    return false;
  }

  const normalizedCwd = cwd.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedWorkspace = workspacePath.replace(/\\/g, '/').replace(/\/+$/, '');
  return normalizedCwd === normalizedWorkspace || normalizedCwd.startsWith(`${normalizedWorkspace}/`);
};

const looksLikeFilesystemMutation = (command: string): boolean => (
  /\b(rm|mv|cp|mkdir|touch|chmod|chown|tee|truncate|git\s+clean|git\s+reset|git\s+checkout|python|node|bun|npm|pnpm|yarn)\b/i.test(command)
);

export const evaluateAutoApprovePolicy = (
  inputPolicy: Partial<AutoApprovePolicy>,
  request: AutoApproveRequest,
): AutoApproveDecision => {
  const policy = normalizeAutoApprovePolicy(inputPolicy);

  if (!policy.enabled) {
    return { approved: false, reason: 'auto-approval is disabled', timeoutSeconds: policy.timeoutSeconds };
  }

  if (policy.deniedTools.includes(request.toolName)) {
    return { approved: false, reason: 'tool is denied', timeoutSeconds: policy.timeoutSeconds };
  }

  if (!hasWildcard(policy.allowedTools) && !policy.allowedTools.includes(request.toolName)) {
    return { approved: false, reason: 'tool is not allowed', timeoutSeconds: policy.timeoutSeconds };
  }

  if ((request.sessionApprovedCount ?? 0) >= policy.maxCommandsPerSession) {
    return { approved: false, reason: 'session auto-approval limit reached', timeoutSeconds: policy.timeoutSeconds };
  }

  const command = request.command?.trim() ?? '';
  if (command) {
    if (matchesAnyPattern(command, policy.deniedCommandPatterns)) {
      return { approved: false, reason: 'command matches a deny pattern', timeoutSeconds: policy.timeoutSeconds };
    }

    if (policy.allowedCommandPatterns.length === 0 || !matchesAnyPattern(command, policy.allowedCommandPatterns)) {
      return { approved: false, reason: 'command does not match an allow pattern', timeoutSeconds: policy.timeoutSeconds };
    }

    if (policy.requireWorkspacePath && looksLikeFilesystemMutation(command) && !pathIsInsideWorkspace(request.cwd, request.workspacePath)) {
      return { approved: false, reason: 'filesystem mutation is outside the workspace', timeoutSeconds: policy.timeoutSeconds };
    }
  }

  return { approved: true, reason: 'request matches auto-approval policy', timeoutSeconds: policy.timeoutSeconds };
};
