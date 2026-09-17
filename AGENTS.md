# AGENTS.md

## Primary Goal

Prefer the smallest, clearest, correct solution.

- Solve the stated problem, not adjacent hypothetical problems.
- Preserve existing behavior unless the task explicitly changes it.
- Prefer deleting or simplifying code over adding layers.
- Make the smallest coherent change; do not scatter one behavior across unrelated files.
- Do not trade correctness for brevity. Handle relevant errors, cancellation, loading, and empty states explicitly.
- Follow existing project conventions before introducing new patterns or dependencies.

## Working Method

1. Inspect the current implementation, repository instructions, and working tree before editing.
2. Identify the behavior, state ownership, and the smallest seam that can contain the change.
3. Define observable acceptance criteria and any cross-module contracts.
4. Implement the narrowest coherent change.
5. Format and run targeted checks, then the relevant project-wide checks.
6. Review the final diff for accidental scope, duplication, stale code, and unrelated changes.

Do not reset, discard, overwrite, or commit unrelated dirty work. Never bypass a failing hook; fix its underlying cause.

## Module and Architecture Guidelines

### Single responsibility

- A module should own one cohesive capability and have one primary reason to change.
- Keep state transitions with the module that owns the state.
- Keep presentation, domain decisions, persistence, and external-process concerns separate when they change for different reasons.
- Split modules by responsibility and change pressure, not merely by line count.
- Avoid both large grab-bag modules and tiny pass-through files that add no leverage.

### Deep modules and clean seams

- Prefer deep modules: a small interface hiding substantial implementation detail.
- Treat the interface as everything callers must know, including invariants, ordering, errors, configuration, and performance expectations.
- Put seams where behavior actually varies. Do not create an adapter or abstraction for a single hypothetical implementation.
- Accept dependencies at seams rather than constructing them deep inside domain logic.
- Keep adapters for UI, filesystem, network, CLI, and framework details at the edges.
- Point dependencies inward: edge modules may depend on domain modules; domain modules should not depend on UI or infrastructure details.
- Test and call a module through the same interface. If callers must understand its internals, deepen or reshape the module.

### State and data flow

- Give each piece of state one source of truth.
- Derive values rather than synchronizing duplicate state.
- Model meaningful states explicitly instead of relying on unrelated sentinel values.
- Keep state changes explicit and local; avoid hidden mutation and ambient globals.
- Make async ownership clear. Cancel or ignore stale work, and prevent results from leaking across identities or contexts.
- Keep domain data independent of rendering details so alternative views can reuse it.

### Coupling and composition

- Prefer high cohesion and low coupling.
- Pass narrow values or interfaces instead of broad context objects when practical.
- Compose behavior from small focused functions, but extract helpers only when they remove real duplication or clarify policy.
- Avoid speculative generalization, unnecessary factories, wrapper-only abstractions, and configuration for behavior that does not vary.
- Reuse existing modules before adding parallel implementations.
- Keep public surfaces small; keep implementation helpers private.

### Correctness and maintainability

- Use precise types and preserve useful domain distinctions.
- Validate input at the edge and keep internal invariants strong.
- Return or propagate structured errors; do not silently swallow failures.
- Prefer deterministic logic and explicit side effects.
- Write comments for non-obvious constraints or decisions, not line-by-line narration.
- Names should describe domain meaning and responsibility rather than implementation mechanics.

## Verification

- Prefer existing tests and direct runtime checks.
- Do not add new test files, test-only helpers, or fixtures unless the user explicitly requests or approves them.
- Exercise observable behavior rather than asserting source shape.
- Run the narrowest useful checks while iterating, then the relevant full checks before completion.
- For this repository, normally run:
  - `pnpm typecheck`
  - `pnpm lint`
  - `pnpm duplication`
  - `bun test`
- Run `git diff --check` and inspect `git diff` before committing.
- If a hook fails, address the failure and retry normally. Never use `--no-verify`.

## Multiple Subagent Runs with Herdr

Use this workflow when the user requests parallel subagents. Load and follow the `herdr` skill first.

### Safety and setup

1. Verify the caller is inside Herdr:

   ```bash
   test "${HERDR_ENV:-}" = 1
   ```

   If this fails, stop; do not control another Herdr session from outside Herdr.

2. Inspect the installed CLI and current topology:

   ```bash
   herdr --help
   herdr tab list --workspace "$HERDR_WORKSPACE_ID"
   herdr pane list --workspace "$HERDR_WORKSPACE_ID"
   herdr agent list
   ```

3. Use only the panes requested by the user. If told to use the existing four panes in the `subagents` tab, do not split panes, create tabs, or create workspaces.
4. Inspect each target agent before sending work. If an old session is idle/done and stale, start a clean session in that same pane with `/new`.
5. Select the requested model in every pane. For OpenRouter DeepSeek V4.1 Flash, Pi's model identifier is:

   ```text
   /model openrouter/deepseek/deepseek-v4.1-flash
   ```

   This corresponds to the OpenRouter model commonly written as `deepseek/deepseek-v4.1:flash`.

6. Optionally use `/name <task>` and `herdr agent rename` so pane ownership is obvious.
7. Read each pane footer/output to verify the new session and model before dispatching work.

Slash commands may settle without entering a normal working state. Send them through the pane terminal when needed, then inspect the pane rather than assuming they succeeded.

### Dividing work

- Divide the task by coherent responsibility and file ownership, not arbitrary file counts.
- Give parallel agents non-overlapping write scopes whenever possible.
- Define shared contracts in prompts so independently edited modules connect cleanly.
- Include exact acceptance criteria, allowed files, checks to run, and explicit instructions to preserve dirty work.
- In a shared worktree, tell implementation agents not to reset, revert, or commit. Reserve committing for the integrating agent or main thread.
- A useful four-run structure is:
  1. state/domain contract,
  2. one major UI or adapter module,
  3. another independent UI or adapter module,
  4. integration, verification, and minimal fixes after the first three settle.
- Keep one pane available for integration when concurrent runs can produce temporary type errors.

### Dispatch and coordination

- Submit independent prompts in parallel with `herdr agent prompt`.
- After submission, confirm agents actually transition to `working`; a prompt command can report the prior settled status before work begins.
- Wait for completion with `herdr agent wait`, then read each full result with `herdr agent read --source recent-unwrapped`.
- If a wait times out or stalls, inspect the agent before retrying. Never blindly submit the same prompt twice.
- Do not answer approval or question dialogs without user authorization.
- Review the shared diff after every wave. Resolve integration failures only after understanding which run owns each change.
- Use follow-up prompts in the same panes for concrete blockers such as type errors, lint failures, or duplication findings.
- Finish with one integration pass that runs the full checks and, where practical, an observable runtime smoke test.

### Prompt shape

Each implementation prompt should state:

- the run's responsibility and desired behavior,
- exact files it may edit,
- contracts it may assume from other runs,
- acceptance criteria,
- that existing dirty work must be preserved,
- that it must not reset, revert, commit, or create tests in a shared worktree,
- formatting and verification commands,
- the expected final report: edits, assumptions, command results, and remaining risks.

Prefer a few well-scoped runs over many overlapping agents. Parallelism is useful only when ownership and integration remain clear.
