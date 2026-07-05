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
