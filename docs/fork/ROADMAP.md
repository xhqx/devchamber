# DevChamber fork roadmap

DevChamber keeps OpenChamber close to upstream while adding an agentic IDE layer for safer, more explainable automation.

## Goals

1. Make generation features explicit: commit/PR generation can choose a model and use configured fallback chains.
2. Keep human control first: command auto-approval is opt-in, scoped, time-limited, visible, and auditable.
3. Treat docs as part of code changes: code-changing agent work must produce a structured explanation and a docs-update decision.
4. Add IDE-native planning surfaces: a project-local Kanban board, repository map, and autocomplete sources.
5. Keep the fork rebaseable by isolating fork features behind `openchamber.fork.*` settings and small modules.

## Implementation order

1. Baseline verification and fork docs.
2. Typed feature flags/settings.
3. Model fallback primitives for safe generation tasks.
4. Commit generation upgrade: model picker, diff budget, and variants.
5. Auto-approval policy with strict tests before UI automation.
6. Repo index core and autocomplete sources.
7. Change explanations and docs-required commit flow.
8. Kanban board and task/session sync.
9. User/developer docs and VSIX packaging.

## Compatibility policy

- Default behavior must match upstream unless a fork setting is enabled.
- Prefer additive files under `packages/ui/src/lib/*` and focused UI components.
- Avoid changing OpenCode protocol assumptions unless guarded by runtime capability checks.
- Keep project data in `.openchamber/*` so users can inspect, commit, or delete it.

## Security posture

- Auto-approval remains disabled by default.
- Deny rules override allow rules.
- Filesystem mutations require a workspace path unless the user explicitly changes policy.
- AI retry/fallback is only automatic for idempotent generation tasks, never tool execution.
