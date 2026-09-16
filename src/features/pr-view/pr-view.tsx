import { basename } from "node:path";
import type { RepositoryAppContextState } from "@/context/app-context";
import {
  availablePatchText,
  checkLine,
  collectionAvailability,
  commentBody,
  commentMetaLine,
  commitMessage,
  commitMetaLine,
  fileLine,
  isRenderableCollection,
  isRenderablePatch,
  isRenderableReviewerRequests,
  linkedIssueLine,
  operationErrorDescription,
  overviewMetaLine,
  patchAvailability,
  persistentMetadataLines,
  presentRepositoryName,
  presentText,
  projectLine,
  pullRequestTitleLine,
  reviewBody,
  reviewCommentMetaLine,
  reviewMetaLine,
  reviewerAvailability,
  reviewerNames,
} from "@/features/pr-view/pr-view-display";
import type { PrTitles } from "@/features/pr-view/use-pr-titles";
import type { PaneFocus } from "@/features/shared/pane-focus";
import {
  pullRequestTabs,
  type DetailsLoadState,
  type OverviewLoadState,
  type PrViewContent,
  type PullRequestTab,
} from "@/features/pr-view/use-pr-view-content";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
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
  type PullRequestSummary,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { moveInList } from "@/utils/navigation";
import type { BoxRenderable } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import { For, Show, createEffect, createSignal } from "solid-js";
import type { Accessor } from "solid-js";

export interface PrViewProps {
  readonly state: RepositoryAppContextState;
  readonly titles: PrTitles;
  readonly content: PrViewContent;
  readonly paneFocus: PaneFocus;
}

interface PersistentHeaderProps {
  readonly repositoryName: string;
  readonly titleLine: string | undefined;
  readonly details: PullRequestDetails | undefined;
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

function arrayItems<T>(section: ForgeSection<readonly T[]>): readonly T[] {
  return section.status === "available" ? section.value : [];
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

function detailsValue(state: DetailsLoadState): PullRequestDetails | undefined {
  return state.value;
}

function detailsError(state: DetailsLoadState): string | undefined {
  return state.status === "error"
    ? operationErrorDescription(state.error)
    : undefined;
}

function tabLabel(tab: PullRequestTab): string {
  switch (tab) {
    case "overview":
      return "Overview";
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

function renderMutedLine(line: string | undefined): JSX.Element {
  return (
    <Show when={line}>
      {(value: Accessor<string>) => <text fg={colors.muted}>{value()}</text>}
    </Show>
  );
}

function renderStackedItem(
  meta: string | undefined,
  body: string | undefined,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderMutedLine(meta)}
      <Show when={body}>
        {(value: Accessor<string>) => (
          <text fg={colors.foreground}>{value()}</text>
        )}
      </Show>
    </box>
  );
}

function renderCollectionSection<T>(
  label: string,
  section: ForgeSection<readonly T[]>,
  renderItem: (item: T) => JSX.Element,
): JSX.Element {
  return (
    <Show when={isRenderableCollection(section)}>
      <box flexDirection="column" gap={0}>
        {sectionHeading(label, collectionAvailability(section))}
        <For each={arrayItems(section)}>{renderItem}</For>
      </box>
    </Show>
  );
}

function renderComments(
  section: ForgeSection<readonly PullRequestComment[]>,
): JSX.Element {
  return renderCollectionSection("Conversation", section, (comment) =>
    renderStackedItem(commentMetaLine(comment), commentBody(comment)),
  );
}

function renderOverview(
  summary: PullRequestSummary,
  overview: PullRequestOverview,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {renderMutedLine(overviewMetaLine(summary))}
      <Show when={presentText(overview.body)}>
        {(body: Accessor<string>) => (
          <box flexDirection="column" gap={1}>
            <text fg={colors.foreground}>
              <strong>Description</strong>
            </text>
            <text fg={colors.muted}>{body()}</text>
          </box>
        )}
      </Show>
      {renderComments(overview.conversationComments)}
    </scrollbox>
  );
}

function headerRow(content: JSX.Element): JSX.Element {
  return (
    <box height={1} width="100%" flexGrow={0} flexShrink={0}>
      {content}
    </box>
  );
}

function PersistentHeader(props: PersistentHeaderProps): JSX.Element {
  const metadataLines = () =>
    props.details === undefined
      ? []
      : [...persistentMetadataLines(props.details)];
  const rowCount = () =>
    1 + (props.titleLine === undefined ? 0 : 1) + metadataLines().length;

  return (
    <box
      flexDirection="column"
      width="100%"
      height={rowCount()}
      flexGrow={0}
      flexShrink={0}
      overflow="hidden"
    >
      {headerRow(
        <text fg={colors.foreground}>
          <strong>{props.repositoryName}</strong>
        </text>,
      )}
      <Show when={props.titleLine}>
        {(title: Accessor<string>) =>
          headerRow(
            <text fg={colors.foreground}>
              <strong>{title()}</strong>
            </text>,
          )
        }
      </Show>
      <For each={metadataLines()}>
        {(line) => headerRow(<text fg={colors.muted}>{line}</text>)}
      </For>
    </box>
  );
}

function renderPatchSection(
  section: ForgeSection<PullRequestPatch>,
): JSX.Element {
  return (
    <Show when={isRenderablePatch(section)}>
      <box flexDirection="column" gap={0}>
        {sectionHeading("Raw patch", patchAvailability(section))}
        {renderMutedLine(availablePatchText(section))}
      </box>
    </Show>
  );
}

function renderFilesSection(
  section: ForgeSection<readonly PullRequestFile[]>,
): JSX.Element {
  return renderCollectionSection("Files", section, (file) =>
    renderMutedLine(fileLine(file)),
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
      {renderCollectionSection(
        "Commits",
        section,
        (commit: PullRequestCommit) =>
          renderStackedItem(commitMetaLine(commit), commitMessage(commit)),
      )}
    </scrollbox>
  );
}

function renderRequestedReviewers(
  section: ForgeSection<PullRequestReviewerRequests>,
): JSX.Element {
  return (
    <Show when={isRenderableReviewerRequests(section)}>
      <box flexDirection="column" gap={0}>
        {sectionHeading("Requested reviewers", reviewerAvailability(section))}
        {renderMutedLine(reviewerNames(section))}
      </box>
    </Show>
  );
}

function renderReviews(
  reviews: ForgeSection<readonly PullRequestReview[]>,
  reviewComments: ForgeSection<readonly PullRequestReviewComment[]>,
  requestedReviewers: ForgeSection<PullRequestReviewerRequests>,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {renderCollectionSection("Submitted reviews", reviews, (review) =>
        renderStackedItem(reviewMetaLine(review), reviewBody(review)),
      )}
      {renderCollectionSection("Inline comments", reviewComments, (comment) =>
        renderStackedItem(reviewCommentMetaLine(comment), commentBody(comment)),
      )}
      {renderRequestedReviewers(requestedReviewers)}
    </scrollbox>
  );
}

function renderChecks(
  section: ForgeSection<readonly PullRequestCheck[]>,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {renderCollectionSection("Checks", section, (check) =>
        renderMutedLine(checkLine(check)),
      )}
    </scrollbox>
  );
}

function renderDevelopment(
  projects: ForgeSection<readonly PullRequestProject[]>,
  linkedIssues: ForgeSection<readonly PullRequestLinkedIssue[]>,
): JSX.Element {
  return (
    <scrollbox flexGrow={1} width="100%" stickyScroll stickyStart="top">
      {renderCollectionSection("Projects", projects, (project) =>
        renderMutedLine(projectLine(project)),
      )}
      {renderCollectionSection("Closing issues", linkedIssues, (issue) =>
        renderMutedLine(linkedIssueLine(issue)),
      )}
    </scrollbox>
  );
}

function renderResource(resource: PullRequestResource): JSX.Element {
  switch (resource.kind) {
    case "details":
      return <></>;
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
  const [contentBox, setContentBox] = createSignal<BoxRenderable | undefined>();
  const focused = () => props.paneFocus.pane() === "content";
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
  const currentDetails = () => detailsValue(props.content.details());
  const detailsLoading = () => props.content.details().status === "loading";
  const headerRepositoryName = () =>
    presentRepositoryName(
      currentDetails()?.repository.fullName,
      repositoryName(),
    );
  const titleLine = () => {
    const item = summary();
    if (item === undefined) {
      return undefined;
    }
    return pullRequestTitleLine(item.title, item.number);
  };
  const headerKey = () => {
    const number = props.titles.highlightedNumber();
    const details = currentDetails();
    const detailsKey =
      details === undefined ? "pending" : `ready:${details.number}`;
    return `${number ?? "none"}:${detailsKey}:${titleLine() ?? ""}:${headerRepositoryName()}`;
  };

  useBindings(() => ({
    target: contentBox,
    commands: [
      ...pullRequestTabs.map((tab) => ({
        name: `pr-view.tab-${tab}`,
        run: () => props.content.selectTab(tab),
      })),
      {
        name: "pr-view.tab-previous",
        run: () =>
          props.content.selectTab(
            moveInList(pullRequestTabs, props.content.activeTab(), -1),
          ),
      },
      {
        name: "pr-view.tab-next",
        run: () =>
          props.content.selectTab(
            moveInList(pullRequestTabs, props.content.activeTab(), 1),
          ),
      },
      {
        name: "pr-view.retry",
        run: () => props.content.retry(),
      },
      {
        name: "pr-view.focus-sidebar",
        run: () => props.paneFocus.focus("sidebar"),
      },
    ],
    bindings: [
      ...pullRequestTabs.map((tab, index) => ({
        key: String(index + 1),
        cmd: `pr-view.tab-${tab}`,
      })),
      { key: "h", cmd: "pr-view.tab-previous" },
      { key: "l", cmd: "pr-view.tab-next" },
      { key: "r", cmd: "pr-view.retry" },
      { key: "0", cmd: "pr-view.focus-sidebar" },
    ],
  }));

  createEffect(() => {
    if (focused()) {
      contentBox()?.focus();
    }
  });

  return (
    <box
      ref={setContentBox}
      focusable
      focused={focused()}
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minWidth={0}
      height="100%"
      overflow="hidden"
      gap={1}
      paddingLeft={2}
      paddingRight={1}
      border
      borderColor={colors.border}
      focusedBorderColor={colors.blue}
      title="[1] Main"
    >
      <Show keyed when={headerKey()}>
        {() => (
          <PersistentHeader
            repositoryName={headerRepositoryName()}
            titleLine={titleLine()}
            details={currentDetails()}
          />
        )}
      </Show>
      <Show when={detailsLoading() && currentDetails() === undefined}>
        <text fg={colors.muted}>Loading details…</text>
      </Show>
      <Show when={detailsError(props.content.details())}>
        {(error: Accessor<string>) => (
          <box flexDirection="column">
            <text fg={colors.yellow}>Could not load pull request details.</text>
            <text fg={colors.dim}>{error()}</text>
          </box>
        )}
      </Show>
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
          0 list · h/l or 1–6 switch tabs · r reloads the visible tab.
        </text>
      </Show>
    </box>
  );
}
