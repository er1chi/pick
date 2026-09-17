import { basename } from "node:path";
import type { RepositoryAppContextState } from "@/context/app-context";
import { PaneStore } from "@/context/active-pane-context";
import type { LoadState } from "@/features/pr-view/load-state";
import {
  checkLine,
  collectionAvailability,
  commentBody,
  commentMetaLine,
  commitMessage,
  commitMetaLine,
  isRenderableCollection,
  isRenderableReviewerRequests,
  linkedIssueLine,
  operationErrorDescription,
  overviewMetaLine,
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
import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
  type ForgeSection,
  type PullRequestCheck,
  type PullRequestCommit,
  type PullRequestComment,
  type PullRequestDetails,
  type PullRequestLinkedIssue,
  type PullRequestOverview,
  type PullRequestPatch,
  type PullRequestProject,
  type PullRequestReview,
  type PullRequestReviewComment,
  type PullRequestReviewerRequests,
  type PullRequestSummary,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { formatPresentTimestamp } from "@/utils/format-timestamp";
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import { parsePatchFiles, type FileDiffMetadata } from "@pierre/diffs";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
} from "solid-js";
import type { Accessor } from "solid-js";
import { SplitFileDiff } from "@/packages/pierre/solid/diffs";

export interface PrViewProps {
  readonly state: RepositoryAppContextState;
  readonly titles: PrTitles;
  readonly content: PrViewContent;
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

function detailsValue(
  state: LoadState<PullRequestDetails>,
): PullRequestDetails | undefined {
  return state.value;
}

function detailsError(
  state: LoadState<PullRequestDetails>,
): string | undefined {
  return state.status === "error"
    ? operationErrorDescription(state.error)
    : undefined;
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
    <box flexDirection="column" gap={0}>
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
    </box>
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
    <box flexDirection="column" gap={0}>
      {renderCollectionSection("Submitted reviews", reviews, (review) =>
        renderStackedItem(reviewMetaLine(review), reviewBody(review)),
      )}
      {renderCollectionSection("Inline comments", reviewComments, (comment) =>
        renderStackedItem(reviewCommentMetaLine(comment), commentBody(comment)),
      )}
      {renderRequestedReviewers(requestedReviewers)}
    </box>
  );
}

function renderChecks(
  section: ForgeSection<readonly PullRequestCheck[]>,
): JSX.Element {
  return renderCollectionSection("Checks", section, (check) =>
    renderMutedLine(checkLine(check)),
  );
}

function renderDevelopment(
  projects: ForgeSection<readonly PullRequestProject[]>,
  linkedIssues: ForgeSection<readonly PullRequestLinkedIssue[]>,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderCollectionSection("Projects", projects, (project) =>
        renderMutedLine(projectLine(project)),
      )}
      {renderCollectionSection("Closing issues", linkedIssues, (issue) =>
        renderMutedLine(linkedIssueLine(issue)),
      )}
    </box>
  );
}

interface ResourceSectionProps<T> {
  readonly label: string;
  readonly state: LoadState<T>;
  readonly render: (value: T) => JSX.Element;
}

/**
 * Renders one independent PR section. Loading and query-level errors are shown
 * here; per-collection failure/unsupported states are handled by the section
 * renderers through their ForgeSection values.
 */
function ResourceSection<T>(props: ResourceSectionProps<T>): JSX.Element {
  const error = (): string | undefined =>
    props.state.status === "error"
      ? operationErrorDescription(props.state.error)
      : undefined;

  return (
    <box flexDirection="column" gap={0}>
      <Show when={props.state.status === "loading"}>
        <text fg={colors.muted}>Loading {props.label}…</text>
      </Show>
      <Show when={error()}>
        {(text: Accessor<string>) => (
          <box flexDirection="column">
            <text fg={colors.yellow}>Could not load {props.label}.</text>
            <text fg={colors.dim}>{text()}</text>
            <text fg={colors.muted}>Press r to retry.</text>
          </box>
        )}
      </Show>
      <Show keyed when={props.state.value}>
        {(value: T) => props.render(value)}
      </Show>
    </box>
  );
}

interface OverviewScreenProps {
  readonly content: PrViewContent;
  readonly summary: Accessor<PullRequestSummary | undefined>;
}

function OverviewScreen(props: OverviewScreenProps): JSX.Element {
  return (
    <box flexDirection="column" gap={1} width="100%">
      <ResourceSection
        label="pull request overview"
        state={props.content.overview()}
        render={(overview) => (
          <Show keyed when={props.summary()}>
            {(item: PullRequestSummary) => renderOverview(item, overview)}
          </Show>
        )}
      />
      <ResourceSection
        label="reviews"
        state={props.content.reviews()}
        render={(resource) =>
          resource.kind === "reviews" ? (
            renderReviews(
              resource.value.reviews,
              resource.value.reviewComments,
              resource.value.requestedReviewers,
            )
          ) : (
            <></>
          )
        }
      />
      <ResourceSection
        label="checks"
        state={props.content.checks()}
        render={(resource) =>
          resource.kind === "checks" ? (
            renderChecks(resource.value.checks)
          ) : (
            <></>
          )
        }
      />
      <ResourceSection
        label="development"
        state={props.content.development()}
        render={(resource) =>
          resource.kind === "development" ? (
            renderDevelopment(
              resource.value.projects,
              resource.value.linkedIssues,
            )
          ) : (
            <></>
          )
        }
      />
    </box>
  );
}

const lockFileNames = new Set([
  "bun.lock",
  "bun.lockb",
  "Cargo.lock",
  "composer.lock",
  "Gemfile.lock",
  "go.sum",
  "package-lock.json",
  "pnpm-lock.yaml",
  "poetry.lock",
  "uv.lock",
  "yarn.lock",
]);

function isLockFile(path: string): boolean {
  const separator = path.lastIndexOf("/");
  return lockFileNames.has(separator < 0 ? path : path.slice(separator + 1));
}

function fileDiffName(fileDiff: FileDiffMetadata): string {
  if (fileDiff.prevName === undefined) {
    return fileDiff.name;
  }
  return `${fileDiff.prevName} → ${fileDiff.name}`;
}

function parseFileDiffs(text: string | undefined): readonly FileDiffMetadata[] {
  if (text === undefined || text.trim() === "") {
    return [];
  }
  return parsePatchFiles(text).flatMap((entry) => entry.files);
}

function fileDiffsForPatch(
  section: ForgeSection<PullRequestPatch> | undefined,
  path: string | undefined,
): readonly FileDiffMetadata[] {
  if (path === undefined) {
    return [];
  }
  const text = section?.status === "available" ? section.value.text : undefined;
  const fileDiff = parseFileDiffs(text).find(
    (candidate) => candidate.name === path || candidate.prevName === path,
  );
  return fileDiff === undefined ? [] : [fileDiff];
}

function patchSectionNotice(
  section: ForgeSection<PullRequestPatch>,
): string | undefined {
  switch (section.status) {
    case "unsupported":
      return section.reason.diagnostic;
    case "failed":
      return `Could not load patch: ${operationErrorDescription(section.error)}`;
    default:
      return undefined;
  }
}

const lockedNotice =
  "Lock file contents are hidden by default. Press e to show them.";

interface SelectedDiffProps {
  readonly content: PrViewContent;
  readonly path: string;
  readonly revealLocked: boolean;
  readonly setDiffScroll: (element: ScrollBoxRenderable) => void;
}

function SelectedDiffBody(props: SelectedDiffProps): JSX.Element {
  const fromCommit = () => props.content.selectedCommit() !== undefined;
  const fileDiffs = createMemo(() =>
    fromCommit()
      ? fileDiffsForPatch(props.content.commitPatch().value, props.path)
      : fileDiffsForPatch(props.content.diff()?.patch, props.path),
  );

  const notice = (): string | undefined => {
    if (fromCommit()) {
      const state = props.content.commitPatch();
      if (state.status === "loading") {
        return "Loading commit diff…";
      }
      if (state.status === "error") {
        return `Could not load commit diff: ${operationErrorDescription(state.error)}`;
      }
      if (state.value === undefined) {
        return "Loading commit diff…";
      }
      const sectionNotice = patchSectionNotice(state.value);
      if (sectionNotice !== undefined) {
        return sectionNotice;
      }
    } else {
      const diff = props.content.diff();
      if (diff === undefined) {
        return "Loading pull request diff…";
      }
      const sectionNotice = patchSectionNotice(diff.patch);
      if (sectionNotice !== undefined) {
        return sectionNotice;
      }
    }
    if (fileDiffs().length === 0) {
      return "No patch is available for the selected file.";
    }
    return undefined;
  };

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minHeight={0}
      width="100%"
    >
      <text fg={colors.dim}>
        {fromCommit()
          ? `Commit diff · ${props.path}`
          : `Pull request diff · ${props.path}`}
      </text>
      <Show
        when={notice()}
        fallback={
          <scrollbox
            ref={props.setDiffScroll}
            flexGrow={1}
            minHeight={0}
            width="100%"
          >
            <For each={fileDiffs()}>
              {(fileDiff) => (
                <box flexDirection="column" width="100%">
                  <text fg={colors.foreground}>{fileDiffName(fileDiff)}</text>
                  <Show
                    when={props.revealLocked || !isLockFile(fileDiff.name)}
                    fallback={<text fg={colors.dim}>{lockedNotice}</text>}
                  >
                    <SplitFileDiff fileDiff={fileDiff} />
                  </Show>
                </box>
              )}
            </For>
          </scrollbox>
        }
      >
        {(text: Accessor<string>) => <text fg={colors.muted}>{text()}</text>}
      </Show>
    </box>
  );
}

function commitMessageLines(
  commit: PullRequestCommit | undefined,
): readonly string[] {
  const message = commit === undefined ? undefined : commitMessage(commit);
  if (message === undefined) {
    return [];
  }
  return message.split(/\r?\n/);
}

interface CommitContextProps {
  readonly sha: string;
  readonly commit: PullRequestCommit | undefined;
  readonly hasFile: boolean;
}

function CommitContext(props: CommitContextProps): JSX.Element {
  const author = () => presentText(props.commit?.author?.login);
  const committer = () => presentText(props.commit?.committer?.login);
  const authoredAt = () => formatPresentTimestamp(props.commit?.authoredAt);
  const committedAt = () => formatPresentTimestamp(props.commit?.committedAt);
  const url = () => presentText(props.commit?.url);

  return (
    <box
      flexDirection="column"
      width="100%"
      gap={0}
      flexGrow={0}
      flexShrink={0}
    >
      <text fg={colors.foreground}>
        <strong>Commit {props.sha}</strong>
      </text>
      <Show when={props.commit}>
        {(commit: Accessor<PullRequestCommit>) =>
          renderMutedLine(commitMetaLine(commit()))
        }
      </Show>
      <Show when={props.commit === undefined}>
        <text fg={colors.dim}>Loading commit metadata…</text>
      </Show>
      <For each={commitMessageLines(props.commit)}>
        {(line) => <text fg={colors.foreground}>{line}</text>}
      </For>
      <Show when={author()}>
        {(value: Accessor<string>) => (
          <text fg={colors.muted}>Author: {value()}</text>
        )}
      </Show>
      <Show when={committer()}>
        {(value: Accessor<string>) => (
          <text fg={colors.muted}>Committer: {value()}</text>
        )}
      </Show>
      <Show when={authoredAt()}>
        {(value: Accessor<string>) => (
          <text fg={colors.muted}>Authored: {value()}</text>
        )}
      </Show>
      <Show when={committedAt()}>
        {(value: Accessor<string>) => (
          <text fg={colors.muted}>Committed: {value()}</text>
        )}
      </Show>
      <Show when={url()}>
        {(value: Accessor<string>) => <text fg={colors.muted}>{value()}</text>}
      </Show>
      <Show when={props.hasFile}>
        <text fg={colors.dim}>The diff below is from this commit.</text>
      </Show>
    </box>
  );
}

function NoPullRequest(props: {
  readonly state: RepositoryAppContextState;
}): JSX.Element {
  const forgeError = () => forgeInitializationError(props.state);
  return (
    <box flexDirection="column" gap={1}>
      <Show when={props.state.kind === ApplicationContext.Local}>
        <text fg={colors.yellow}>
          <strong>Context: Local Git repository</strong>
        </text>
        <text fg={colors.muted}>
          Add a GitHub or Forgejo remote to initialize it.
        </text>
      </Show>
      <Show when={forgeError()}>
        {(error: Accessor<ForgeInitializationError>) => (
          <>
            <text fg={colors.yellow}>
              <strong>Context: CLI initialization error</strong>
            </text>
            <text fg={colors.muted}>
              {initializationErrorDescription(error())}
            </text>
          </>
        )}
      </Show>
      <Show
        when={
          props.state.kind !== ApplicationContext.Local &&
          forgeError() === undefined
        }
      >
        <text fg={colors.yellow}>
          <strong>Context: No pull request open</strong>
        </text>
        <text fg={colors.muted}>
          Select a pull request in the sidebar and press enter to open it.
        </text>
      </Show>
    </box>
  );
}

export function PrView(props: PrViewProps) {
  const [pane, setPane] = PaneStore.use();
  const [contentBox, setContentBox] = createSignal<BoxRenderable | undefined>();
  const [overviewScroll, setOverviewScroll] = createSignal<
    ScrollBoxRenderable | undefined
  >();
  const [diffScroll, setDiffScroll] = createSignal<
    ScrollBoxRenderable | undefined
  >();
  const [revealLocked, setRevealLocked] = createSignal(false);
  const focused = () => pane.active === "content";
  const currentState = () => props.state;
  const localName = () => basename(currentState().cwd) || currentState().cwd;
  const repositoryName = () =>
    props.titles.list().value?.repository.fullName ?? localName();
  const openedNumber = () => props.titles.openedNumber();
  const summary = () => {
    const number = openedNumber();
    if (number === null) {
      return undefined;
    }
    return props.titles
      .list()
      .value?.items.find((item) => item.number === number);
  };
  const currentDetails = () => detailsValue(props.content.details());
  const detailsLoading = () => props.content.details().status === "loading";
  const selectedFile = () => props.content.selectedFile();
  const selectedCommit = () => props.content.selectedCommit();
  const selectedCommitValue = createMemo(() => {
    const sha = selectedCommit();
    if (sha === undefined) {
      return undefined;
    }
    return props.content.commits().find((commit) => commit.sha === sha);
  });
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
    const number = openedNumber();
    const details = currentDetails();
    const detailsKey =
      details === undefined ? "pending" : `ready:${details.number}`;
    return `${number ?? "none"}:${detailsKey}:${titleLine() ?? ""}:${headerRepositoryName()}`;
  };

  const contextBanner = (): string => {
    const commit = selectedCommit();
    const path = selectedFile();
    if (commit !== undefined && path !== undefined) {
      return `Context: Commit ${commit} · File ${path}`;
    }
    if (commit !== undefined) {
      return `Context: Commit ${commit}`;
    }
    if (path !== undefined) {
      return `Context: Pull request · File ${path}`;
    }
    return "Context: Pull request";
  };

  const activeScroll = () =>
    selectedFile() === undefined ? overviewScroll() : diffScroll();

  const closeOpened = (): void => {
    props.content.clearSelection();
    props.titles.closeOpened();
    setPane({ active: "pull-requests" });
  };

  useBindings(() => ({
    target: contentBox,
    commands: [
      {
        name: "pr-view.scroll-down",
        run: () => {
          const element = activeScroll();
          if (element !== undefined) {
            element.scrollTop += 1;
          }
        },
      },
      {
        name: "pr-view.scroll-up",
        run: () => {
          const element = activeScroll();
          if (element !== undefined) {
            element.scrollTop -= 1;
          }
        },
      },
      {
        name: "pr-view.retry",
        run: () => props.content.retry(),
      },
      {
        name: "pr-view.toggle-locked-files",
        run: () => {
          setRevealLocked((current) => !current);
        },
      },
      {
        name: "pr-view.close",
        run: closeOpened,
      },
    ],
    bindings: [
      { key: "j", cmd: "pr-view.scroll-down" },
      { key: "k", cmd: "pr-view.scroll-up" },
      { key: "r", cmd: "pr-view.retry" },
      { key: "e", cmd: "pr-view.toggle-locked-files" },
      { key: "x", cmd: "pr-view.close" },
    ],
  }));

  createEffect(() => {
    if (!focused()) {
      return;
    }
    const scroll = activeScroll();
    if (scroll !== undefined) {
      scroll.focus();
      return;
    }
    contentBox()?.focus();
  });

  createEffect(
    on(
      () => `${selectedFile() ?? ""}|${selectedCommit() ?? ""}`,
      () => {
        const scroll = activeScroll();
        if (scroll !== undefined) {
          scroll.scrollTop = 0;
        }
      },
      { defer: true },
    ),
  );

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
      title="[3] Main"
    >
      <Show
        when={openedNumber() !== null}
        fallback={<NoPullRequest state={currentState()} />}
      >
        <box
          flexDirection="column"
          gap={0}
          width="100%"
          flexGrow={0}
          flexShrink={0}
        >
          <box flexDirection="row" width="100%" flexGrow={0} flexShrink={0}>
            <text fg={colors.blue}>
              <strong>{contextBanner()}</strong>
            </text>
            <box flexGrow={1} />
            <text fg={colors.red}>[x] Close PR</text>
          </box>
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
                <text fg={colors.yellow}>
                  Could not load pull request details.
                </text>
                <text fg={colors.dim}>{error()}</text>
              </box>
            )}
          </Show>
          <Show when={selectedCommit()}>
            {(sha: Accessor<string>) => (
              <CommitContext
                sha={sha()}
                commit={selectedCommitValue()}
                hasFile={selectedFile() !== undefined}
              />
            )}
          </Show>
          <Show
            when={
              selectedCommit() !== undefined && selectedFile() === undefined
            }
          >
            <text fg={colors.yellow}>
              Select a file in the sidebar to view this commit's changes.
            </text>
          </Show>
        </box>
        <Show
          when={selectedFile()}
          keyed
          fallback={
            <scrollbox
              ref={setOverviewScroll}
              flexGrow={1}
              flexShrink={1}
              minHeight={0}
              width="100%"
              stickyScroll
              stickyStart="top"
            >
              <OverviewScreen content={props.content} summary={summary} />
            </scrollbox>
          }
        >
          {(path: string) => (
            <SelectedDiffBody
              content={props.content}
              path={path}
              revealLocked={revealLocked()}
              setDiffScroll={setDiffScroll}
            />
          )}
        </Show>
        <box height={1} width="100%" flexGrow={0} flexShrink={0}>
          <text fg={colors.dim}>
            j/k scroll · e lock files · r reload · x close PR
          </text>
        </box>
      </Show>
    </box>
  );
}
