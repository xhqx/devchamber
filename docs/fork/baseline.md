# Fork baseline

Date: 2026-07-05
Branch: `fork/agentic-ide-roadmap`

## Environment

- Node: 22.22.3
- Bun: 1.3.14
- Package install: `bun install` completed. `patch-package` reported one existing warning: `Unrecognized patch file in patches directory @tanstack%2Fvirtual-core@3.17.3.patch`.

## Verified gates

| Command | Result | Notes |
| --- | --- | --- |
| `bun run vscode:type-check` | Pass | `tsc --noEmit -p tsconfig.json && tsc --noEmit -p tsconfig.webview.json` |
| `bun run vscode:build` | Pass | Build completed; Vite emitted existing warnings about KaTeX font URLs, mixed static/dynamic imports, and large chunks. |

## Pending baseline gates

These are kept for the final validation matrix after feature slices land:

- `bun run type-check`
- `bun run lint`
- `bun run vscode:dev` manual extension host smoke test
