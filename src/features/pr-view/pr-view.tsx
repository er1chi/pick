import { basename } from "node:path";
import {
  ForgeContextErrorCode,
  type ForgeContextError,
  type RepositoryAppContextState,
} from "@/context/app-context";
import type { PullRequestViewData } from "@/features/pr-view/use-pr-view-data";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  ForgeOperationErrorCode,
  type ForgeInitializationError,
  type ForgeSection,
  type PullRequestDetails,
  type PullRequestPatch,
  type PullRequestReviewerRequests,
  type PullRequestState,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";

export interface PrViewProps {
  readonly state: RepositoryAppContextState;
  readonly contextLabel: string;
  readonly view: PullRequestViewData;
}

function serviceName(
  kind: ApplicationContext.GitHub | ApplicationContext.Forgejo,
): string {
  return kind === ApplicationContext.GitHub ? "GitHub" : "Forgejo";
}

function initializationErrorDescription(
  error: ForgeInitializationError,
): string {
  const service = serviceName(error.kind);
  if (error.code === ForgeInitializationErrorCode.ExecutableUnavailable) {
    return `${service} CLI is unavailable.`;
  }
  return `${service} CLI version check failed.`;
}

function forgeInitializationError(
  state: RepositoryAppContextState,
): ForgeInitializationError | undefined {
  return state.kind === ApplicationContext.Local ? undefined : state.forgeError;
}

function stateLabel(state: PullRequestState): string {
  switch (state) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "merged":
      return "Merged";
    case "unknown":
      return "Unknown";
    default:
      return "Unknown";
  }
}

function nullable(value: string | number | null | undefined): string {
  return value === null || value === undefined || value === ""
    ? "—"
    : String(value);
}

function shortSha(value: string | null): string {
  return value === null ? "—" : value.slice(0, 12);
}

function mergeabilityLabel(value: boolean | null): string {
  if (value === null) {
    return "unknown";
  }
  return value ? "yes" : "no";
}

function sectionStatus<T>(
  section: ForgeSection<T>,
  describeAvailable: (value: T) => string,
): string {
  switch (section.status) {
    case "available":
      return `${describeAvailable(section.value)}${section.truncated ? " (partial)" : ""}`;
    case "unsupported":
      return `unsupported — ${section.reason.diagnostic}`;
    case "failed":
      return `failed — ${operationErrorDescription(section.error)}`;
    case "not-requested":
      return "not requested";
  }
}

function reviewDecisionStatus(section: ForgeSection<string | null>): string {
  return sectionStatus(section, (value) =>
    value === null || value.length === 0 ? "no decision" : value,
  );
}

function operationErrorDescription(error: ForgeContextError): string {
  if (error.code === ForgeContextErrorCode.NoActiveForge) {
    return "No active remote repository.";
  }
  switch (error.code) {
    case ForgeOperationErrorCode.InvalidRequest:
    case ForgeOperationErrorCode.CommandSpawnFailed:
    case ForgeOperationErrorCode.CommandFailed:
    case ForgeOperationErrorCode.InvalidJson:
    case ForgeOperationErrorCode.IncompatibleResponse:
    case ForgeOperationErrorCode.OutputLimitExceeded:
    case ForgeOperationErrorCode.Cancelled:
    case ForgeOperationErrorCode.TimedOut:
      return error.diagnostic;
  }
}

function collectionStatus<T>(section: ForgeSection<readonly T[]>): string {
  return sectionStatus(section, (value) => `${value.length} available`);
}

function reviewerStatus(
  section: ForgeSection<PullRequestReviewerRequests>,
): string {
  return sectionStatus(
    section,
    (value) => `${value.users.length} users, ${value.teams.length} teams`,
  );
}

function patchStatus(section: ForgeSection<PullRequestPatch>): string {
  return sectionStatus(section, (value) => `${value.byteLength} bytes`);
}

function detailsValue(
  view: PullRequestViewData,
): PullRequestDetails | undefined {
  const state = view.details();
  return state.status === "ready" ? state.value : undefined;
}

function listRepositoryName(view: PullRequestViewData): string | undefined {
  const state = view.list();
  return state.status === "ready" ? state.value.repository.fullName : undefined;
}

function detailError(view: PullRequestViewData): string | undefined {
  const state = view.details();
  return state.status === "error"
    ? operationErrorDescription(state.error)
    : undefined;
}

function collectionRows(details: PullRequestDetails) {
  return [
    ["Commits", collectionStatus(details.collections.commits)],
    [
      "Conversation comments",
      collectionStatus(details.collections.conversationComments),
    ],
    [
      "Inline review comments",
      collectionStatus(details.collections.reviewComments),
    ],
    ["Reviews", collectionStatus(details.collections.reviews)],
    [
      "Requested reviewers",
      reviewerStatus(details.collections.requestedReviewers),
    ],
    ["Files", collectionStatus(details.collections.files)],
    ["Checks/status", collectionStatus(details.collections.checks)],
    ["Projects", collectionStatus(details.collections.projects)],
    ["Closing issues", collectionStatus(details.collections.linkedIssues)],
    ["Raw patch", patchStatus(details.collections.patch)],
  ] as const;
}

function renderDetails(details: PullRequestDetails, view: PullRequestViewData) {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      <text fg={colors.foreground}>
        <strong>
          {details.repository.fullName}#{details.summary.number}
        </strong>
      </text>
      <text fg={colors.foreground}>
        <strong>{details.summary.title}</strong>
      </text>
      <text fg={colors.muted}>
        {stateLabel(details.summary.state)}
        {details.summary.isDraft === true ? " · Draft" : ""}
        {details.summary.author === null
          ? ""
          : ` · by ${details.summary.author.login}`}
      </text>
      <text fg={colors.muted}>{details.repository.url ?? ""}</text>
      <text fg={colors.muted}>
        {nullable(details.base.ref)} ({shortSha(details.base.sha)}) ←{" "}
        {nullable(details.head.ref)} ({shortSha(details.head.sha)})
      </text>
      <text fg={colors.muted}>
        +{nullable(details.counts.additions)} -
        {nullable(details.counts.deletions)} · files{" "}
        {nullable(details.counts.changedFiles)} · commits{" "}
        {nullable(details.counts.commits)}
      </text>
      <text fg={colors.muted}>
        Created {nullable(details.createdAt)} · Updated{" "}
        {nullable(details.updatedAt)} · Merged {nullable(details.mergedAt)}
      </text>
      <text fg={colors.muted}>
        Mergeable {mergeabilityLabel(details.mergeability.mergeable)} · state{" "}
        {nullable(details.mergeability.mergeState)} · decision{" "}
        {reviewDecisionStatus(details.mergeability.reviewDecision)}
      </text>
      <Show when={details.body !== null && details.body.trim().length > 0}>
        <box flexDirection="column" gap={1}>
          <text fg={colors.foreground}>
            <strong>Description</strong>
          </text>
          <text fg={colors.muted}>{details.body}</text>
        </box>
      </Show>
      <Show when={details.labels.length > 0}>
        <text fg={colors.muted}>
          Labels:{" "}
          <For each={details.labels}>
            {(label, index) => (
              <>
                {index() > 0 ? ", " : ""}
                {label.name}
              </>
            )}
          </For>
        </text>
      </Show>
      <Show when={details.assignees.length > 0}>
        <text fg={colors.muted}>
          Assignees:{" "}
          <For each={details.assignees}>
            {(user, index) => (
              <>
                {index() > 0 ? ", " : ""}
                {user.login}
              </>
            )}
          </For>
        </text>
      </Show>
      <Show when={details.milestone !== null}>
        <text fg={colors.muted}>Milestone: {details.milestone?.title}</text>
      </Show>
      <Show when={details.summary.url !== null}>
        <text fg={colors.dim}>{details.summary.url}</text>
      </Show>
      <box flexDirection="column" gap={0}>
        <text fg={colors.foreground}>
          <strong>Remote sections</strong>
        </text>
        <For each={collectionRows(details)}>
          {(row) => (
            <text
              fg={row[1].startsWith("available") ? colors.muted : colors.yellow}
            >
              {row[0]}: {row[1]}
            </text>
          )}
        </For>
      </box>
      <Show when={view.details().status === "ready"}>
        <text fg={colors.dim}>Press r to reload this pull request.</text>
      </Show>
    </scrollbox>
  );
}

export function PrView(props: PrViewProps) {
  const currentState = () => props.state;
  const localName = () => basename(currentState().cwd) || currentState().cwd;
  const repositoryName = () => listRepositoryName(props.view) ?? localName();
  const currentDetails = () => detailsValue(props.view);
  const listLoading = () => props.view.list().status === "loading";
  const detailsLoading = () => props.view.details().status === "loading";

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minWidth={0}
      gap={1}
      paddingLeft={2}
      paddingRight={1}
    >
      <text fg={colors.foreground}>
        <strong>Pull Requests</strong>
      </text>
      <text fg={colors.foreground}>
        <strong>{repositoryName()}</strong>
      </text>
      <text fg={colors.muted}>{currentState().cwd}</text>
      <text fg={colors.muted}>Context: {props.contextLabel}</text>
      <Show when={currentState().kind === ApplicationContext.Local}>
        <box flexDirection="column">
          <text fg={colors.yellow}>Status: Local Git repository</text>
          <text fg={colors.muted}>
            Add a GitHub or Forgejo remote to initialize it.
          </text>
        </box>
      </Show>
      <Show when={forgeInitializationError(currentState())}>
        {(error: Accessor<ForgeInitializationError>) => (
          <box flexDirection="column">
            <text fg={colors.yellow}>Status: CLI initialization error</text>
            <text fg={colors.muted}>
              {initializationErrorDescription(error())}
            </text>
          </box>
        )}
      </Show>
      <Show
        when={
          currentState().kind !== ApplicationContext.Local &&
          forgeInitializationError(currentState()) === undefined
        }
      >
        <Show when={listLoading()}>
          <text fg={colors.muted}>Loading pull requests…</text>
        </Show>
        <Show when={detailsLoading()}>
          <text fg={colors.muted}>Loading selected pull request…</text>
        </Show>
        <Show when={detailError(props.view)}>
          {(error: Accessor<string>) => (
            <box flexDirection="column">
              <text fg={colors.yellow}>
                Could not load pull request details.
              </text>
              <text fg={colors.dim}>{error()}</text>
              <text fg={colors.muted}>Press r to retry.</text>
            </box>
          )}
        </Show>
        <Show when={currentDetails()}>
          {(details: Accessor<PullRequestDetails>) =>
            renderDetails(details(), props.view)
          }
        </Show>
        <Show
          when={
            !listLoading() &&
            !detailsLoading() &&
            currentDetails() === undefined &&
            detailError(props.view) === undefined
          }
        >
          <text fg={colors.muted}>
            Select a pull request and press Enter to open it.
          </text>
        </Show>
      </Show>
    </box>
  );
}
