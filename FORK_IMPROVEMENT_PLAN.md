# OpenChamber Fork Improvements Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Fork OpenChamber and turn the VS Code/desktop/web UI into a stronger agentic IDE layer with commit message generation, configurable auto-approval, inner docs/commentary for code changes, autocomplete, model fallback, task-board management, and repository map/indexing.

**Architecture:** Keep OpenChamber close to upstream and implement features as small vertical slices in the monorepo. Shared behavior belongs in `packages/ui/src/lib`, `packages/ui/src/stores`, and `packages/ui/src/sync`; runtime-specific bridges belong in `packages/vscode/src`/`packages/vscode/webview/api` and web/electron HTTP handlers where needed. Prefer feature flags/settings so the fork can rebase onto upstream.

**Tech Stack:** TypeScript, React 19, Zustand, CodeMirror, OpenCode SDK `@opencode-ai/sdk`, VS Code Extension API, Bun 1.3.14+, Node 22+, OpenChamber monorepo.

---

## Current context verified

Fork created and pulled locally.

- Fork: `https://github.com/xhqx/devchamber`
- Local root: `/Users/alxgvts/assistants/devchamber`
- Upstream: `https://github.com/openchamber/openchamber.git`
- Inspected upstream clone earlier at `7d412ff` on `main`.

Relevant existing files:

- Monorepo scripts: `package.json`
  - `bun install`
  - `bun run vscode:dev`
  - `bun run vscode:type-check`
  - `bun run vscode:build`
  - `bun run type-check`
  - `bun run lint`
- VS Code package: `packages/vscode/package.json`
  - Extension entry: `packages/vscode/src/extension.ts`
  - Webview bridge/runtime APIs: `packages/vscode/src/bridge.ts`, `packages/vscode/webview/api/*`
- Git UI:
  - `packages/ui/src/components/views/GitView.tsx`
  - `packages/ui/src/components/views/git/CommitSection.tsx`
  - `packages/ui/src/components/views/git/CommitInput.tsx`
  - `packages/ui/src/lib/gitApi.ts`
  - `packages/vscode/src/gitService.ts`
- Permission model:
  - `packages/ui/src/types/permission.ts`
  - `packages/ui/src/sync/session-actions.ts`
  - `packages/ui/src/hooks/useTraySync.ts`
  - `packages/vscode/webview/api/permissions.ts`
- Model/session selection:
  - `packages/ui/src/sync/selection-store.ts`
  - `packages/ui/src/stores/useConfigStore.ts`
  - `packages/ui/src/lib/gitApi.ts` generation session context
- Existing task-like UI:
  - `packages/ui/src/components/session/ProjectNotesTodoPanel.tsx`
  - `packages/ui/src/components/session/TodoSendDialog.tsx`
  - `packages/ui/src/components/session/SaveProjectPlanDialog.tsx`
  - `packages/ui/src/components/views/PlanView.tsx`
- Existing roadmap already mentions “Kanban board for multi-agent management”; we can implement this in the fork while preparing upstreamable PRs.

---

## Product principles for the fork

1. **Human control first:** auto-approval must be opt-in, scoped, time-limited, visible, and revocable.
2. **Docs as part of code changes:** when an agent changes code, it must also produce a structured “why” note and docs-update decision.
3. **IDE-native, not chat-only:** surface docs notes, task statuses, repo map, and autocomplete inside panels near code, like GitHub review comments but local and live.
4. **Rebaseable fork:** avoid large rewrites; add isolated modules, settings, and tests.
5. **Graceful fallback:** every AI-powered feature should degrade to manual mode if provider/model/API fails.

---

## Milestone 0 — Fork and development baseline

### Task 0.1: Fork and clone

**Objective:** Create our fork and keep upstream remotes clean.

**Steps:**

1. Fork `openchamber/openchamber` to `xhqx/openchamber`. ✅ Done
2. Clone the fork:
   ```bash
   git clone https://github.com/xhqx/devchamber.git /Users/alxgvts/assistants/devchamber
   cd /Users/alxgvts/assistants/devchamber
   git remote add upstream https://github.com/openchamber/openchamber.git
   git fetch upstream
   git checkout -b fork/agentic-ide-roadmap
   ```
3. Verify:
   ```bash
   git remote -v
   git status
   ```

**Commit:** no commit unless remote metadata/docs are changed.

### Task 0.2: Install and verify baseline

**Objective:** Ensure upstream builds before changes.

**Steps:**

1. Install:
   ```bash
   bun install
   ```
2. Run gates:
   ```bash
   bun run vscode:type-check
   bun run vscode:build
   bun run type-check
   bun run lint
   ```
3. Launch extension dev host:
   ```bash
   bun run vscode:dev
   ```
4. Record baseline failures, if any, in `docs/fork/baseline.md`.

**Files:**
- Create: `docs/fork/baseline.md`

---

## Milestone 1 — Fork roadmap and feature flags

### Task 1.1: Add fork roadmap docs

**Objective:** Document why the fork exists and how features are scoped.

**Files:**
- Create: `docs/fork/ROADMAP.md`
- Create: `docs/fork/ARCHITECTURE.md`
- Modify: `README.md` or `packages/vscode/README.md` with a short fork section if this is a public fork.

**Content outline:**

- Fork goals
- Upstream compatibility policy
- Feature flags/settings
- Security policy for auto-approval
- Docs-update contract
- Kanban/repo-index data model

### Task 1.2: Add typed fork settings

**Objective:** Centralize settings for new fork features.

**Files:**
- Modify: `packages/vscode/package.json`
- Modify: `packages/ui/src/stores/useConfigStore.ts`
- Create: `packages/ui/src/lib/forkFeatures.ts`
- Add i18n strings under existing locale files if present.

**Settings to add:**

```json
{
  "openchamber.fork.autoApprove.enabled": false,
  "openchamber.fork.autoApprove.timeoutSeconds": 30,
  "openchamber.fork.autoApprove.allowedTools": [],
  "openchamber.fork.docs.requiredOnCodeChange": true,
  "openchamber.fork.modelFallback.enabled": true,
  "openchamber.fork.modelFallback.chain": [],
  "openchamber.fork.repoIndex.enabled": true,
  "openchamber.fork.kanban.enabled": true,
  "openchamber.fork.autocomplete.enabled": true
}
```

**Validation:**
- Defaults must be safe: auto-approve disabled, docs required enabled.
- `timeoutSeconds` min/max: 5–600.

---

## Milestone 2 — Commit message generation upgrade

Current state: OpenChamber already has commit generation in `packages/ui/src/lib/gitApi.ts::generateCommitMessage`, triggered from `GitView.tsx::handleGenerateCommitMessage`. It prompts the active OpenCode session and expects JSON `{ subject, highlights }`.

### Task 2.1: Make commit generation provider/model explicit

**Objective:** Let user pick a model or fallback chain for commit/PR generation instead of only using active session context.

**Files:**
- Modify: `packages/ui/src/lib/gitApi.ts`
- Modify: `packages/ui/src/components/views/git/CommitSection.tsx`
- Modify: `packages/ui/src/components/views/GitView.tsx`
- Create: `packages/ui/src/components/views/git/GenerationModelPicker.tsx`
- Test: add/extend `packages/ui/src/lib/gitApi.test.ts` if test setup exists; otherwise add focused Bun tests near the module.

**Implementation notes:**

- Replace currently ignored `options?: { zenModel?: string; providerId?: string; modelId?: string }` in `generateCommitMessage` with real behavior.
- Resolve model selection in order:
  1. Explicit per-action model picker.
  2. Feature fallback chain first entry.
  3. Active session context.
  4. Current global provider/model.
- Keep existing active-session visible/hidden prompt behavior.

### Task 2.2: Add diff budget and better prompt context

**Objective:** Improve commit message quality by including staged diff summaries, not just file names.

**Files:**
- Modify: `packages/ui/src/lib/gitApi.ts`
- Modify: `packages/ui/src/lib/magicPrompts.ts` or prompt files used by `renderMagicPrompt`.

**Implementation notes:**

- For selected staged files, call existing git diff APIs with context limits.
- Send:
  - file list
  - per-file status
  - bounded patch excerpts
  - docs-change requirement status
- Cap prompt size (e.g. 40k chars) and include truncation note.

### Task 2.3: Add one-click variants

**Objective:** Generate conventional, detailed, and terse commit subjects.

**Files:**
- Modify: `CommitSection.tsx`
- Modify: `gitApi.ts`

**UI:**
- Dropdown beside “Generate”:
  - Conventional
  - Terse
  - Detailed subject + body

**Acceptance:**
- Existing “Generate” still works.
- User can insert subject only or subject + body.

---

## Milestone 3 — Model fallback chain

### Task 3.1: Add fallback configuration store

**Objective:** Persist per-purpose fallback chains.

**Files:**
- Create: `packages/ui/src/lib/modelFallback.ts`
- Modify: `packages/ui/src/sync/selection-store.ts`
- Modify: `packages/ui/src/components/views/SettingsView.tsx`

**Data model:**

```ts
export type ModelRef = {
  providerID: string;
  modelID: string;
  variant?: string;
};

export type ModelFallbackPurpose = 'chat' | 'commit' | 'pr' | 'autocomplete' | 'docs';

export type ModelFallbackChain = {
  purpose: ModelFallbackPurpose;
  models: ModelRef[];
  maxAttempts: number;
  retryOn: Array<'timeout' | 'rate_limit' | 'server_error' | 'invalid_json'>;
};
```

### Task 3.2: Wrap OpenCode prompt calls with fallback

**Objective:** Retry failed AI generation on configured fallback models.

**Files:**
- Modify: `packages/ui/src/lib/gitApi.ts`
- Create: `packages/ui/src/lib/runWithModelFallback.ts`
- Test: `packages/ui/src/lib/runWithModelFallback.test.ts`

**Rules:**

- Never retry non-idempotent tool execution automatically.
- Safe to retry structured generation: commit messages, PR description, docs notes, autocomplete.
- Show final selected model in UI.
- Emit telemetry/log events only locally.

### Task 3.3: Surface fallback state in UI

**Objective:** Make fallback transparent.

**Files:**
- Create: `packages/ui/src/components/ui/ModelFallbackBadge.tsx`
- Use in `GitView.tsx`, autocomplete popover, docs panel.

**Acceptance:**
- User sees `primary failed → fallback model used` message.
- Error details are expandable, not noisy.

---

## Milestone 4 — Auto-approve commands with user timeout

Current state: permissions exist as `PermissionRequest` with responses `'once' | 'always' | 'reject'`; tray sync already shows pending approvals.

### Task 4.1: Add auto-approval policy model

**Objective:** Represent safe, scoped auto-approval rules.

**Files:**
- Create: `packages/ui/src/lib/autoApprovePolicy.ts`
- Modify: `packages/ui/src/types/permission.ts`
- Modify: `packages/ui/src/stores/useConfigStore.ts`

**Policy shape:**

```ts
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
```

**Safety defaults:**
- `enabled: false`
- deny patterns for destructive commands: `rm -rf /`, `sudo`, credential/keychain reads, `curl | sh`, disk format, secret exfiltration patterns.
- require workspace path for filesystem mutations.

### Task 4.2: Add permission auto-responder

**Objective:** Auto-approve eligible permission requests after visible countdown.

**Files:**
- Modify: `packages/ui/src/sync/session-actions.ts`
- Modify: `packages/ui/src/hooks/useTraySync.ts`
- Create: `packages/ui/src/hooks/useAutoApprovePermissions.ts`
- Create: `packages/ui/src/components/permissions/AutoApproveCountdown.tsx`

**Behavior:**

- When a permission request arrives:
  - evaluate against policy
  - if eligible, show countdown with “Approve now”, “Reject”, “Disable auto-approve”
  - after timeout, send `'once'` unless the policy says `'always'` is allowed for that exact tool/pattern
- Keep audit log in local storage/session store.

### Task 4.3: Settings UI

**Objective:** Let user configure timeout and patterns without editing JSON.

**Files:**
- Modify: `packages/ui/src/components/views/SettingsView.tsx`
- Create: `packages/ui/src/components/settings/AutoApproveSettings.tsx`

**Acceptance:**
- User can set timeout.
- User can add/remove allow patterns.
- UI warns clearly that this can execute commands.

### Task 4.4: Tests for safety

**Objective:** Prevent accidental broad auto-approval.

**Files:**
- Test: `packages/ui/src/lib/autoApprovePolicy.test.ts`

**Test cases:**

- disabled policy never approves
- command not matching allow list never approves
- deny list overrides allow list
- timeout clamps 5–600 seconds
- destructive command examples are rejected
- non-workspace path mutation rejected when `requireWorkspacePath` is true

---

## Milestone 5 — Inner docs / change explanations in IDE

Requirement: when plugin/agent changes code, it must also update project docs with explanations why the change appeared; user imagines GitHub comments view inside IDE.

### Task 5.1: Define change explanation schema

**Objective:** Store structured explanations per changed file/hunk/session.

**Files:**
- Create: `packages/ui/src/lib/changeExplanations/schema.ts`
- Create: `packages/ui/src/lib/changeExplanations/store.ts`

**Schema:**

```ts
export type ChangeExplanation = {
  id: string;
  sessionId: string;
  directory: string;
  filePath: string;
  range?: { startLine: number; endLine: number };
  changeKind: 'add' | 'modify' | 'delete' | 'rename' | 'docs';
  summary: string;
  why: string;
  risks: string[];
  docsUpdated: boolean;
  docsPaths: string[];
  createdAt: string;
  model?: { providerID: string; modelID: string; variant?: string };
};
```

### Task 5.2: Detect code-changing tool results

**Objective:** Hook into session/message stream and detect patch/edit/file-write parts.

**Files:**
- Inspect/modify: `packages/ui/src/sync/event-pipeline.ts`
- Inspect/modify: `packages/ui/src/sync/event-reducer.ts`
- Inspect/modify: `packages/ui/src/components/chat/message/*`
- Create: `packages/ui/src/lib/changeExplanations/detectCodeChanges.ts`

**Detection signals:**
- patch parts
- edit-style results
- file write tool calls
- git diff after session turn

### Task 5.3: Generate docs note after code change

**Objective:** After detected code changes, ask the model for a structured explanation and docs update decision.

**Files:**
- Create: `packages/ui/src/lib/changeExplanations/generateExplanation.ts`
- Modify: `packages/ui/src/lib/runWithModelFallback.ts`
- Create prompt: `git/change-docs.generate.instructions` or equivalent in existing magic prompt system.

**Prompt output JSON:**

```json
{
  "summary": "one line",
  "why": "why this change exists",
  "risks": ["risk 1"],
  "docs": {
    "required": true,
    "paths": ["docs/..."],
    "suggestedPatch": "..."
  }
}
```

### Task 5.4: Docs update enforcement

**Objective:** If code changed but docs are missing, surface a blocking checklist before commit.

**Files:**
- Modify: `packages/ui/src/components/views/GitView.tsx`
- Modify: `packages/ui/src/components/views/git/CommitSection.tsx`
- Create: `packages/ui/src/components/changeExplanations/DocsRequiredBanner.tsx`

**Rules:**
- If docs required and no docs path changed, warn/block depending on setting.
- Allow manual “Not needed” with reason.
- Include docs status in generated commit message context.

### Task 5.5: IDE comments view

**Objective:** Show explanations like GitHub review comments next to files/diffs.

**Files:**
- Create: `packages/ui/src/components/changeExplanations/ChangeCommentsPanel.tsx`
- Modify: `packages/ui/src/components/views/DiffView.tsx`
- Modify: `packages/ui/src/components/views/PierreDiffViewer.tsx`
- Modify: `packages/ui/src/components/views/FilesView.tsx`

**UI:**
- Side panel: “Change explanations”
- Per-file comments grouped by file path
- Status chips: `docs updated`, `docs missing`, `accepted`, `needs revision`
- Actions: accept, edit explanation, create docs patch, mark not needed

### Task 5.6: Persist docs notes in project

**Objective:** Keep project-readable audit trail, not only local UI state.

**Files:**
- Create/update project file: `.openchamber/change-notes/<session-id>.md`
- Optional index: `.openchamber/change-notes/index.json`
- Document in `docs/fork/ARCHITECTURE.md`

**Acceptance:**
- Agent code changes produce local IDE comments.
- User can export them into markdown docs.
- Commit generation sees docs status.

---

## Milestone 6 — Autocomplete

### Task 6.1: Decide autocomplete scopes

**Objective:** Split autocomplete into prompt autocomplete and code autocomplete.

**Recommended v1:**
1. Prompt composer autocomplete: slash commands, files, symbols, recent tasks.
2. Commit input autocomplete: conventional prefixes/scopes from repo.
3. Later: inline code completion in editor via VS Code provider.

### Task 6.2: Prompt composer autocomplete

**Files:**
- Identify composer component under `packages/ui/src/components/chat/*`.
- Create: `packages/ui/src/lib/autocomplete/sources.ts`
- Create: `packages/ui/src/components/autocomplete/AutocompleteMenu.tsx`
- Modify existing message input component.

**Sources:**
- `@file` from repo index
- `#symbol` from repo index
- `/command` from OpenChamber commands
- `task:` from Kanban board

### Task 6.3: Commit input autocomplete

**Files:**
- Modify: `packages/ui/src/components/views/git/CommitInput.tsx`
- Create: `packages/ui/src/lib/autocomplete/commitScopes.ts`

**Suggestions:**
- `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`
- scopes inferred from changed top-level packages: `vscode`, `ui`, `web`, `electron`, etc.

### Task 6.4: VS Code inline completion provider

**Objective:** Optional later step for code autocomplete using repo index + fallback chain.

**Files:**
- Modify: `packages/vscode/src/extension.ts`
- Create: `packages/vscode/src/inlineCompletionProvider.ts`
- Bridge to UI/model config if needed.

**Safety:**
- Disabled by default.
- Debounced.
- Never auto-applies; suggestions only.

---

## Milestone 7 — Kanban task board

Requirement: view task statuses and manage them.

### Task 7.1: Define task board data model

**Files:**
- Create: `packages/ui/src/lib/kanban/schema.ts`
- Create: `packages/ui/src/lib/kanban/store.ts`
- Create: `packages/ui/src/lib/kanban/persistence.ts`

**Columns:**
- Backlog
- Ready
- In progress
- Blocked
- Review
- Done

**Task fields:**

```ts
export type KanbanTask = {
  id: string;
  title: string;
  description?: string;
  status: 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'done';
  priority?: 'low' | 'medium' | 'high';
  sessionIds: string[];
  filePaths: string[];
  branch?: string;
  assignee?: 'human' | 'agent' | string;
  createdAt: string;
  updatedAt: string;
};
```

### Task 7.2: Project-local persistence

**Objective:** Make board portable with repo.

**Files:**
- Project data: `.openchamber/tasks/board.json`
- Create: `packages/ui/src/lib/kanban/projectBoardFile.ts`
- Add runtime FS bridge if UI cannot write directly.

**Conflict policy:**
- JSON file is the source of truth.
- Use stable IDs and updated timestamps.
- Later optional: one markdown file per task.

### Task 7.3: Board UI

**Files:**
- Create: `packages/ui/src/components/views/KanbanView.tsx`
- Create: `packages/ui/src/components/kanban/KanbanColumn.tsx`
- Create: `packages/ui/src/components/kanban/KanbanTaskCard.tsx`
- Modify app navigation/sidebar to add “Board”.

**Interactions:**
- drag task between columns
- edit title/description
- attach current session
- attach changed files
- create branch/worktree from task
- mark blocked with reason

### Task 7.4: Agent integration

**Objective:** Let agent sessions update task status automatically, with user visibility.

**Files:**
- Modify session event pipeline to detect task markers.
- Create: `packages/ui/src/lib/kanban/sessionTaskSync.ts`

**Rules:**
- Agent can propose status changes.
- User can enable auto-apply for status only; never for destructive actions.
- Status changes appear in audit log.

---

## Milestone 8 — Repository map / indexing

### Task 8.1: Add repo indexer core

**Objective:** Build fast local repository map for autocomplete, context selection, task links, and docs enforcement.

**Files:**
- Create: `packages/ui/src/lib/repoIndex/schema.ts`
- Create: `packages/ui/src/lib/repoIndex/indexer.ts`
- Create: `packages/ui/src/lib/repoIndex/ignore.ts`
- Test: `packages/ui/src/lib/repoIndex/indexer.test.ts`

**Index contents:**
- files: path, extension, language, size, mtime
- directories: tree summary
- symbols: exported functions/classes/components where cheap
- docs files: README, docs, md/mdx
- package boundaries: package.json, tsconfig, workspace packages
- dependency graph shallow map

### Task 8.2: Runtime file scanning bridge

**Objective:** Scan local filesystem safely from VS Code/web/electron.

**Files:**
- Modify: `packages/vscode/src/bridge-fs-runtime.ts`
- Modify: `packages/vscode/webview/api/files.ts`
- Add HTTP/electron equivalents if needed.

**Rules:**
- Respect `.gitignore` and common ignores: `node_modules`, `.git`, `dist`, `build`, `.next`.
- Cap file size.
- Incremental refresh using mtime.

### Task 8.3: Repo map UI

**Files:**
- Create: `packages/ui/src/components/views/RepoMapView.tsx`
- Create: `packages/ui/src/components/repoIndex/RepoTree.tsx`
- Create: `packages/ui/src/components/repoIndex/SymbolSearch.tsx`
- Modify navigation/sidebar.

**UI:**
- tree map
- search symbols/files
- “Add to context” action
- docs coverage status
- recently changed files

### Task 8.4: Use repo index everywhere

**Integrations:**
- autocomplete sources
- commit scope suggestions
- docs-required detection
- Kanban task file attachments
- prompt context picker

---

## Milestone 9 — Upstreamable packaging and docs

### Task 9.1: Update user docs

**Files:**
- Modify: `packages/vscode/README.md`
- Create: `docs/fork/auto-approve.md`
- Create: `docs/fork/model-fallback.md`
- Create: `docs/fork/change-explanations.md`
- Create: `docs/fork/kanban.md`
- Create: `docs/fork/repo-index.md`

**Docs must explain:**
- what the feature does
- why it exists
- security/trust boundaries
- settings
- troubleshooting

### Task 9.2: Add developer docs

**Files:**
- Modify: `CONTRIBUTING.md`
- Create: `docs/fork/development.md`

**Include:**
- test commands
- extension dev setup
- feature flag workflow
- how to keep fork rebased

### Task 9.3: Release packaging

**Commands:**

```bash
bun run vscode:type-check
bun run vscode:build
bun run --cwd packages/vscode package
```

**Acceptance:**
- VSIX installs locally.
- Extension starts OpenCode connection.
- New settings appear.
- Feature flags default safe.

---

## Validation matrix

Run before claiming done:

```bash
bun run vscode:type-check
bun run vscode:build
bun run type-check
bun run lint
```

Manual QA:

1. Open Extension Development Host with `bun run vscode:dev`.
2. Open a test repository.
3. Verify Git panel status loads.
4. Stage changes and generate commit message.
5. Simulate primary model failure and verify fallback.
6. Trigger a permission request; verify auto-approve countdown and reject controls.
7. Make agent code change; verify change explanation appears.
8. Verify docs-required banner before commit.
9. Create/edit/move Kanban task.
10. Build repo index and use autocomplete for `@file` / `#symbol`.
11. Package VSIX and install locally.

---

## Risks and tradeoffs

- **Auto-approve risk:** biggest security issue. Keep disabled by default, narrow by policy, show countdown, audit everything.
- **Upstream drift:** large UI changes may conflict. Keep features modular and behind `openchamber.fork.*` flags.
- **OpenCode API limits:** model fallback and autocomplete depend on reliable SDK behavior. Build fallback wrapper around safe/idempotent calls only.
- **Indexing performance:** avoid blocking UI; use incremental scans and size caps.
- **Docs enforcement annoyance:** make it useful, not bureaucratic; allow “not needed” with reason.
- **Task board scope creep:** start with simple project-local JSON, avoid external integrations until core works.

---

## Suggested implementation order

1. Fork + baseline verification.
2. Settings/feature flags.
3. Model fallback wrapper.
4. Commit generation upgrade.
5. Auto-approve with strict safety tests.
6. Repo index core.
7. Autocomplete using repo index.
8. Change explanations + docs-required flow.
9. Kanban board.
10. Docs, packaging, and release.

This order gives quick value early while keeping the most invasive IDE surfaces for later, after shared primitives exist.
