# Pick

A terminal Git client: VS Code-style source control, plus PR review for
connected GitHub and Forgejo accounts. Built with OpenTUI and Solid.

## Setup

pnpm manages dependencies. Bun is required to run the TUI (OpenTUI Solid JSX
preload).

```bash
pnpm install
pnpm dev
```

`Ctrl+Q` shuts down the renderer cleanly.

## Checks

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm duplication
pnpm knip
```

Application code starts in `src/app.tsx`.
