# DevChamber fork architecture

## Feature flags

Fork features are controlled by `openchamber.fork.*` settings and the typed helpers in `packages/ui/src/lib/forkFeatures.ts`.

Safe defaults:

- Auto-approval: disabled.
- Docs requirement: enabled.
- Model fallback: enabled but inert until a chain is configured.
- Repo index, Kanban, autocomplete: enabled for UI discovery but must degrade if storage/runtime bridges are unavailable.

## Shared modules

- `packages/ui/src/lib/forkFeatures.ts` — typed settings, safe defaults, normalization.
- `packages/ui/src/lib/modelFallback.ts` — model fallback data model and validation.
- `packages/ui/src/lib/runWithModelFallback.ts` — retry wrapper for idempotent generation tasks.
- `packages/ui/src/lib/autoApprovePolicy.ts` — safe auto-approval policy model and evaluator.
- `packages/ui/src/lib/changeExplanations/*` — pure schema, store, code-change detection, docs-commit status, project-local change-note persistence, and structured explanation generation helpers for IDE explanations and docs-required decisions.
- `packages/ui/src/components/changeExplanations/*` — UI surfaces for generated change notes, including grouped file/diff comments, docs status chips, and follow-up actions used by diff review panels.
- `packages/ui/src/lib/autocomplete/*` and `packages/ui/src/components/autocomplete/*` — conventional commit suggestion helpers plus prompt-composer source ranking/menu primitives for `@file`, `#symbol`, `/command`, and `task:` autocomplete.
- `packages/ui/src/lib/repoIndex/*` — pure repository index schema, ignore rules, indexing helpers, tree filtering, symbol search, package/language summaries, and repository-map view models for runtime indexing, autocomplete sources, docs coverage, task links, and context selection.
- `packages/ui/src/components/views/RepoMapView.tsx` — project Repo Map surface that builds an index through the runtime files bridge, exposes tree/package/language filters, lists recent files/docs, and lets users search/jump to indexed symbols.
- `packages/ui/src/lib/kanban/*` — project-local board schema, deterministic store/view-model helpers, branch/file attachment helpers, and controller functions for loading/updating `.openchamber/tasks/board.json` through the runtime files bridge.
- `packages/ui/src/components/views/KanbanProjectView.tsx` and `packages/ui/src/components/kanban/*` — connected project board with create/edit/move actions, session/change-file/branch attachments, drag-and-drop column moves, optimistic persistence, and sync/error status UI.

## Project-local data

Future slices should write project-readable data under `.openchamber/`:

- `.openchamber/change-notes/<session-id>.md` for change explanations.
- `.openchamber/change-notes/index.json` for exported explanation metadata.
- `.openchamber/tasks/board.json` for the Kanban board.
- `.openchamber/repo-index/*.json` if a persisted index cache becomes useful.

## Docs-update contract

When an agent changes code, DevChamber should record:

- what changed,
- why it changed,
- risks and follow-up checks,
- whether docs were updated,
- which docs paths were touched or intentionally skipped.

Commit generation receives this status and can warn if docs are missing.

## Rebase policy

Keep fork-specific behavior in isolated modules and use narrow adapter calls from upstream UI/runtime files. If an upstream rebase conflicts, prefer re-applying a small adapter call over moving upstream code into fork modules.
