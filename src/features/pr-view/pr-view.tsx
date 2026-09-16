import { basename } from "node:path";
import type { RepositoryAppContextState } from "@/context/app-context";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import {
  pullRequestTabs,
  type OverviewLoadState,
  type PrViewContent,
  type PullRequestTab,
} from "@/features/pr-view/use-pr-view-content";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  ForgeOperationErrorCode,
  type ForgeInitializationError,
  type ForgeOperationError,
  type ForgeSection,
  type PullRequestCheck,
  type PullRequestCommit,
  type PullRequestComment,
  type PullRequestDetails,
  type PullRequestDiffResource,
  type PullRequestFile,
  type PullRequestLinkedIssue,
  type PullRequestOverview,
  type PullRequestPatch,
  type PullRequestProject,
  type PullRequestResource,
  type PullRequestReview,
  type PullRequestReviewComment,
  type PullRequestReviewerRequests,
  type PullRequestState,
  type PullRequestSummary,
} from "@/services/forge/types";
import { colors } from "@/theme";
import type { JSX } from "@opentui/solid";
import { For, Show } from "solid-js";
import type { Accessor } from "solid-js";

export interface PrViewProps {
  readonly state: RepositoryAppContextState;
  readonly contextLabel: string;
  readonly titles: PrTitles;
  readonly content: PrViewContent;
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

function operationErrorDescription(error: ForgeOperationError): string {
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

function arrayItems<T>(section: ForgeSection<readonly T[]>): readonly T[] {
  return section.status === "available" ? section.value : [];
}

function arrayStatus<T>(section: ForgeSection<readonly T[]>): string {
  return sectionStatus(section, (value) =>
    value.length === 0 ? "empty" : `${value.length} available`,
  );
}

function reviewerStatus(
  section: ForgeSection<PullRequestReviewerRequests>,
): string {
  return sectionStatus(section, (value) =>
    value.users.length === 0 && value.teams.length === 0
      ? "empty"
      : `${value.users.length} users, ${value.teams.length} teams`,
  );
}

function patchStatus(section: ForgeSection<PullRequestPatch>): string {
  return sectionStatus(section, (value) => `${value.byteLength} bytes`);
}

function overviewValue(
  state: OverviewLoadState,
): PullRequestOverview | undefined {
  return state.value;
}

function overviewError(state: OverviewLoadState): string | undefined {
  return state.status === "error"
    ? operationErrorDescription(state.error)
    : undefined;
}

function tabLabel(tab: PullRequestTab): string {
  switch (tab) {
    case "overview":
      return "Overview";
    case "details":
      return "Details";
    case "diff":
      return "Diff";
    case "commits":
      return "Commits";
    case "reviews":
      return "Reviews";
    case "checks":
      return "Checks";
    case "development":
      return "Development";
  }
}

function sectionHeading(label: string, status: string): JSX.Element {
  return (
    <text fg={colors.foreground}>
      <strong>
        {label}: {status}
      </strong>
    </text>
  );
}

function renderComments(
  section: ForgeSection<readonly PullRequestComment[]>,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {sectionHeading("Conversation", arrayStatus(section))}
      <Show when={section.status === "available" && section.value.length > 0}>
        <For each={arrayItems(section)}>
          {(comment) => (
            <box flexDirection="column" gap={0}>
              <text fg={colors.muted}>
                {comment.author?.login ?? "Unknown author"} ·{" "}
                {nullable(comment.createdAt)}
              </text>
              <text fg={colors.foreground}>
                {comment.body ?? "(empty comment)"}
              </text>
            </box>
          )}
        </For>
      </Show>
    </box>
  );
}

function renderOverview(
  summary: PullRequestSummary,
  overview: PullRequestOverview,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      <text fg={colors.muted}>
        {stateLabel(summary.state)}
        {summary.isDraft === true ? " · Draft" : ""}
        {summary.author === null ? "" : ` · by ${summary.author.login}`}
      </text>
      <Show when={overview.body !== null && overview.body.trim().length > 0}>
        <box flexDirection="column" gap={1}>
          <text fg={colors.foreground}>
            <strong>Description</strong>
          </text>
          <text fg={colors.muted}>{overview.body}</text>
        </box>
      </Show>
      {renderComments(overview.conversationComments)}
    </scrollbox>
  );
}

function renderDetails(details: PullRequestDetails): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      <text fg={colors.muted}>{details.repository.url ?? ""}</text>
      <text fg={colors.muted}>
        {nullable(details.base.ref)} ({shortSha(details.base.sha)}) ←{" "}
        {nullable(details.head.ref)} ({shortSha(details.head.sha)})
      </text>
      <text fg={colors.muted}>
        +{nullable(details.counts.additions)} -
        {nullable(details.counts.deletions)} · files{" "}
        {nullable(details.counts.changedFiles)} · comments{" "}
        {nullable(details.counts.conversationComments)} · review comments{" "}
        {nullable(details.counts.reviewComments)}
      </text>
      <text fg={colors.muted}>
        Created {nullable(details.createdAt)} · Updated{" "}
        {nullable(details.updatedAt)} · Merged {nullable(details.mergedAt)}
      </text>
      <text fg={colors.muted}>
        Mergeable {mergeabilityLabel(details.mergeability.mergeable)} · state{" "}
        {nullable(details.mergeability.mergeState)} · decision{" "}
        {sectionStatus(
          details.mergeability.reviewDecision,
          (value) => value ?? "no decision",
        )}
      </text>
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
    </scrollbox>
  );
}

function renderPatchSection(
  section: ForgeSection<PullRequestPatch>,
): JSX.Element {
  const patchText =
    section.status === "available" ? section.value.text : undefined;
  return (
    <box flexDirection="column" gap={0}>
      {sectionHeading("Raw patch", patchStatus(section))}
      <Show when={patchText !== undefined}>
        <text fg={colors.muted}>{patchText}</text>
      </Show>
    </box>
  );
}

function renderFilesSection(
  section: ForgeSection<readonly PullRequestFile[]>,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {sectionHeading("Files", arrayStatus(section))}
      <For each={arrayItems(section)}>
        {(file) => (
          <text fg={colors.muted}>
            {file.status} {file.path} (+{nullable(file.additions)} -
            {nullable(file.deletions)})
          </text>
        )}
      </For>
    </box>
  );
}

function renderDiff(resource: PullRequestDiffResource): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {renderFilesSection(resource.files)}
      {renderPatchSection(resource.patch)}
    </scrollbox>
  );
}

function renderCommits(
  section: ForgeSection<readonly PullRequestCommit[]>,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {sectionHeading("Commits", arrayStatus(section))}
      <For each={arrayItems(section)}>
        {(commit) => (
          <box flexDirection="column" gap={0}>
            <text fg={colors.muted}>
              {commit.sha.slice(0, 12)} ·{" "}
              {commit.author?.login ?? "Unknown author"} ·{" "}
              {nullable(commit.committedAt)}
            </text>
            <text fg={colors.foreground}>{commit.message}</text>
          </box>
        )}
      </For>
    </scrollbox>
  );
}

function reviewerNames(
  section: ForgeSection<PullRequestReviewerRequests>,
): string {
  if (section.status !== "available") {
    return "";
  }
  const names = [
    ...section.value.users.map((user) => user.login),
    ...section.value.teams.map((team) => team.name),
  ];
  return names.join(", ") || "None";
}

function renderReviews(
  reviews: ForgeSection<readonly PullRequestReview[]>,
  reviewComments: ForgeSection<readonly PullRequestReviewComment[]>,
  requestedReviewers: ForgeSection<PullRequestReviewerRequests>,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {sectionHeading("Submitted reviews", arrayStatus(reviews))}
      <For each={arrayItems(reviews)}>
        {(review) => (
          <box flexDirection="column" gap={0}>
            <text fg={colors.muted}>
              {review.state} · {review.author?.login ?? "Unknown author"} ·{" "}
              {nullable(review.submittedAt)}
            </text>
            <text fg={colors.foreground}>
              {review.body ?? "(empty review)"}
            </text>
          </box>
        )}
      </For>
      {sectionHeading("Inline comments", arrayStatus(reviewComments))}
      <For each={arrayItems(reviewComments)}>
        {(comment) => (
          <box flexDirection="column" gap={0}>
            <text fg={colors.muted}>
              {comment.author?.login ?? "Unknown author"} ·{" "}
              {comment.location?.path ?? "General"}
            </text>
            <text fg={colors.foreground}>
              {comment.body ?? "(empty comment)"}
            </text>
          </box>
        )}
      </For>
      {sectionHeading(
        "Requested reviewers",
        reviewerStatus(requestedReviewers),
      )}
      <Show when={reviewerNames(requestedReviewers).length > 0}>
        <text fg={colors.muted}>{reviewerNames(requestedReviewers)}</text>
      </Show>
    </scrollbox>
  );
}

function renderChecks(
  section: ForgeSection<readonly PullRequestCheck[]>,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {sectionHeading("Checks", arrayStatus(section))}
      <For each={arrayItems(section)}>
        {(check) => (
          <text fg={colors.muted}>
            {check.name}: {check.status} {check.conclusion ?? ""}{" "}
            {check.link ?? ""}
          </text>
        )}
      </For>
    </scrollbox>
  );
}

function renderDevelopment(
  projects: ForgeSection<readonly PullRequestProject[]>,
  linkedIssues: ForgeSection<readonly PullRequestLinkedIssue[]>,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {sectionHeading("Projects", arrayStatus(projects))}
      <For each={arrayItems(projects)}>
        {(project) => (
          <text fg={colors.muted}>
            {project.title}{" "}
            {project.number === null ? "" : `#${project.number}`}{" "}
            {project.state ?? ""}
          </text>
        )}
      </For>
      {sectionHeading("Closing issues", arrayStatus(linkedIssues))}
      <For each={arrayItems(linkedIssues)}>
        {(issue) => (
          <text fg={colors.muted}>
            {issue.repository?.fullName ?? ""}#{issue.number}{" "}
            {issue.title ?? "(untitled)"} {stateLabel(issue.state)}
          </text>
        )}
      </For>
    </scrollbox>
  );
}

function renderResource(resource: PullRequestResource): JSX.Element {
  switch (resource.kind) {
    case "details":
      return renderDetails(resource.value.details);
    case "diff":
      return renderDiff(resource.value);
    case "commits":
      return renderCommits(resource.value.commits);
    case "reviews":
      return renderReviews(
        resource.value.reviews,
        resource.value.reviewComments,
        resource.value.requestedReviewers,
      );
    case "checks":
      return renderChecks(resource.value.checks);
    case "development":
      return renderDevelopment(
        resource.value.projects,
        resource.value.linkedIssues,
      );
  }
}

function resourceError(content: PrViewContent): string | undefined {
  const state = content.resource();
  return state.status === "error"
    ? operationErrorDescription(state.error)
    : undefined;
}

function renderTabs(content: PrViewContent): JSX.Element {
  return (
    <box flexDirection="row" gap={2}>
      <For each={pullRequestTabs}>
        {(tab, index) => (
          <text fg={content.activeTab() === tab ? colors.blue : colors.muted}>
            <strong>
              {index() + 1}:{tabLabel(tab)}
            </strong>
          </text>
        )}
      </For>
    </box>
  );
}

function renderResourceTab(content: PrViewContent): JSX.Element {
  return (
    <>
      <Show when={content.resource().status === "loading"}>
        <text fg={colors.muted}>
          Loading {tabLabel(content.activeTab()).toLowerCase()}…
        </text>
      </Show>
      <Show when={resourceError(content)}>
        {(error: Accessor<string>) => (
          <box flexDirection="column">
            <text fg={colors.yellow}>
              Could not load {tabLabel(content.activeTab()).toLowerCase()}.
            </text>
            <text fg={colors.dim}>{error()}</text>
            <text fg={colors.muted}>Press r to retry.</text>
          </box>
        )}
      </Show>
      <Show keyed when={content.resource().value}>
        {(value: PullRequestResource) => renderResource(value)}
      </Show>
      <Show
        when={
          content.resource().value === undefined &&
          content.resource().status !== "loading" &&
          content.resource().status !== "error"
        }
      >
        <text fg={colors.muted}>
          Select a pull request to load{" "}
          {tabLabel(content.activeTab()).toLowerCase()}.
        </text>
      </Show>
    </>
  );
}

export function PrView(props: PrViewProps) {
  const currentState = () => props.state;
  const localName = () => basename(currentState().cwd) || currentState().cwd;
  const repositoryName = () =>
    props.titles.list().value?.repository.fullName ?? localName();
  const summary = () => {
    const number = props.titles.highlightedNumber();
    return (
      props.titles.list().value?.items.find((item) => item.number === number) ??
      undefined
    );
  };
  const currentOverview = () => overviewValue(props.content.overview());
  const overviewLoading = () => props.content.overview().status === "loading";

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
        {renderTabs(props.content)}
        <Show keyed when={summary()}>
          {(item: PullRequestSummary) => (
            <text fg={colors.foreground}>
              <strong>
                {item.title} #{item.number}
              </strong>
            </text>
          )}
        </Show>
        <Show when={overviewLoading()}>
          <text fg={colors.muted}>Loading overview…</text>
        </Show>
        <Show when={props.content.activeTab() === "overview"}>
          <Show when={overviewError(props.content.overview())}>
            {(error: Accessor<string>) => (
              <box flexDirection="column">
                <text fg={colors.yellow}>
                  Could not load pull request overview.
                </text>
                <text fg={colors.dim}>{error()}</text>
                <text fg={colors.muted}>Press r to retry.</text>
              </box>
            )}
          </Show>
          <Show keyed when={currentOverview()}>
            {(overview: PullRequestOverview) => (
              <Show keyed when={summary()}>
                {(item: PullRequestSummary) => renderOverview(item, overview)}
              </Show>
            )}
          </Show>
          <Show
            when={
              currentOverview() === undefined &&
              !overviewLoading() &&
              overviewError(props.content.overview()) === undefined
            }
          >
            <text fg={colors.muted}>
              Highlight a pull request to preview it.
            </text>
          </Show>
        </Show>
        <Show when={props.content.activeTab() !== "overview"}>
          {renderResourceTab(props.content)}
        </Show>
        <text fg={colors.dim}>
          1–7 switch tabs · r reloads the visible tab.
        </text>
      </Show>
    </box>
  );
}
