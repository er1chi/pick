# Pick

A terminal Git client: VS Code-style source control, plus PR review for
connected GitHub and Forgejo accounts. Built with OpenTUI and Solid.

## Prerequisites

- authenticated gh cli
- authenticated [forgejo cli](https://codeberg.org/stalecontext/forgejo-cli-plus)
  - community fork recommended for --json outputs
  - waiting on [Issue 213: Structured Outputs](https://codeberg.org/forgejo-contrib/forgejo-cli/issues/213) in 'official' cli
- pnpm/bun

## Setup

```bash
pnpm install
pnpm dev
```

## Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm duplication
pnpm knip
```
