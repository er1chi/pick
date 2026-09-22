# Pick

A terminal Git client, PR review, and herdr plugin for
connected GitHub and Forgejo accounts. Built with OpenTUI and Solid.

Idea was to replace my VS Code git workflows via a TUI. Lots of good solutions already like Plannotator, Hunk, etc but only really covered 80% of my workflow so I built this

Currently a WIP

## Prerequisites

- authenticated gh cli
- authenticated [forgejo cli](https://codeberg.org/stalecontext/forgejo-cli-plus)
  - community fork recommended for --json outputs
  - waiting on [Issue 213: Structured Outputs](https://codeberg.org/forgejo-contrib/forgejo-cli/issues/213) in 'official' cli
- pnpm & bun

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
