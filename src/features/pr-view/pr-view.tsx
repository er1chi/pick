import { basename } from "node:path";
import type { RepositoryAppContextState } from "@/context/app-context";
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
  type PullRequestLinkedIssue,
  type PullRequestOverview,
  type PullRequestProject,
  type PullRequestResource,
  type PullRequestReview,
  type PullRequestReviewComment,
  type PullRequestReviewerRequests,
  type PullRequestSummary,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { moveInList } from "@/utils/navigation";
import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import type { JSX } from "@opentui/solid";
import { useBindings } from "@opentui/keymap/solid";
import {
  For,
  Show,
  createEffect,
  createMemo,
  createSignal,
  on,
} from "solid-js";
import type { Accessor } from "solid-js";
import { PaneStore } from "@/context/active-pane-context";
import { parsePatchFiles, type FileDiffMetadata } from "@pierre/diffs";
import {
  type DisplayRowKind,
  flattenHunks,
} from "@/packages/pierre/solid/diffs";

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
      return "Files changed";
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

function renderResource(resource: PullRequestResource): JSX.Element {
  switch (resource.kind) {
    case "details":
      return <></>;
    case "diff":
      // Files changed and Commits are loaded independently and rendered by
      // their dedicated panes; the shared resource never carries them here.
      return <></>;
    case "commits":
      return <></>;
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
    <box flexDirection="row" gap={2} width="100%" flexGrow={0} flexShrink={0}>
      <For each={pullRequestTabs}>
        {(tab) => (
          <text fg={content.activeTab() === tab ? colors.blue : colors.muted}>
            <strong>{tabLabel(tab)}</strong>
          </text>
        )}
      </For>
      <box flexGrow={1} />
      <text fg={colors.red}>[x] Close PR</text>
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
    </>
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

function patchText(
  section: ForgeSection<{ readonly text: string }> | undefined,
): string | undefined {
  return section?.status === "available" ? section.value.text : undefined;
}

function fileDiffsForPath(
  resource: PullRequestDiffResource | undefined,
  path: string | undefined,
): readonly FileDiffMetadata[] {
  if (resource === undefined || path === undefined) {
    return [];
  }
  const fileDiff = parseFileDiffs(patchText(resource.patch)).find(
    (candidate) => candidate.name === path || candidate.prevName === path,
  );
  return fileDiff === undefined ? [] : [fileDiff];
}

function diffRowColor(kind: DisplayRowKind): string {
  switch (kind) {
    case "addition":
      return colors.green;
    case "deletion":
      return colors.red;
    case "hunk-header":
      return colors.dim;
    default:
      return colors.foreground;
  }
}

function diffRowMarker(kind: DisplayRowKind): string {
  switch (kind) {
    case "addition":
      return "+";
    case "deletion":
      return "-";
    default:
      return " ";
  }
}

function DiffRows(props: { fileDiff: FileDiffMetadata }): JSX.Element {
  return (
    <For each={flattenHunks(props.fileDiff)}>
      {(row) => (
        <text fg={diffRowColor(row.kind)}>
          {`${diffRowMarker(row.kind)}${row.text}`}
        </text>
      )}
    </For>
  );
}

const lockedNotice =
  "Lock file contents are hidden by default. Press e to show them.";

function renderPatchFiles(
  fileDiffs: readonly FileDiffMetadata[],
  revealLocked: boolean,
): JSX.Element {
  return (
    <For each={fileDiffs}>
      {(fileDiff) => (
        <box flexDirection="column" width="100%">
          <text fg={colors.foreground}>{fileDiffName(fileDiff)}</text>
          <Show
            when={revealLocked || !isLockFile(fileDiff.name)}
            fallback={<text fg={colors.dim}>{lockedNotice}</text>}
          >
            <DiffRows fileDiff={fileDiff} />
          </Show>
        </box>
      )}
    </For>
  );
}

interface DetailPaneProps {
  readonly header: Accessor<string>;
  readonly notice: Accessor<string | undefined>;
  readonly revealLocked: Accessor<boolean>;
  readonly fileDiffs: Accessor<readonly FileDiffMetadata[]>;
  readonly setDetailScroll: (element: ScrollBoxRenderable) => void;
  readonly above: Accessor<JSX.Element | undefined>;
}

interface DetailPaneHostProps {
  readonly content: PrViewContent;
  readonly revealLocked: Accessor<boolean>;
  readonly setDetailScroll: (element: ScrollBoxRenderable) => void;
}

interface DetailView {
  readonly header: Accessor<string>;
  readonly notice: Accessor<string | undefined>;
  readonly fileDiffs: Accessor<readonly FileDiffMetadata[]>;
}

function DetailPane(props: DetailPaneProps): JSX.Element {
  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minHeight={0}
      width="100%"
    >
      <text fg={colors.dim}>{props.header()}</text>
      <Show
        when={props.notice()}
        fallback={
          <scrollbox
            ref={props.setDetailScroll}
            flexGrow={1}
            minHeight={0}
            width="100%"
          >
            {props.above()}
            {renderPatchFiles(props.fileDiffs(), props.revealLocked())}
          </scrollbox>
        }
      >
        {(text: Accessor<string>) => <text fg={colors.muted}>{text()}</text>}
      </Show>
    </box>
  );
}

function mainDetailPane(
  props: DetailPaneHostProps,
  view: DetailView,
  above: Accessor<JSX.Element | undefined>,
): JSX.Element {
  return (
    <DetailPane
      header={view.header}
      notice={view.notice}
      revealLocked={props.revealLocked}
      fileDiffs={view.fileDiffs}
      setDetailScroll={props.setDetailScroll}
      above={above}
    />
  );
}

function FilesChangedPane(props: DetailPaneHostProps): JSX.Element {
  const diff = () => props.content.diff();
  const diffState = () => props.content.diffState();
  const fileDiffs = createMemo(() =>
    fileDiffsForPath(diff(), props.content.selectedFile()),
  );

  const notice = (): string | undefined => {
    const state = diffState();
    if (state.status === "loading") {
      return "Loading files changed…";
    }
    if (state.status === "error") {
      return `Could not load files changed: ${operationErrorDescription(state.error)}`;
    }
    const patch = state.value?.patch;
    if (patch?.status === "failed") {
      return `Could not load files changed: ${operationErrorDescription(patch.error)}`;
    }
    if (patch?.status === "unsupported") {
      return patch.reason.diagnostic;
    }
    if (props.content.selectedFile() === undefined) {
      return "Select a file in the sidebar to view its changes.";
    }
    if (fileDiffs().length === 0) {
      return "No patch is available for the selected file.";
    }
    return undefined;
  };

  const header = (): string => {
    const path = props.content.selectedFile();
    return path === undefined ? "Files changed" : `Files changed · ${path}`;
  };

  return mainDetailPane(props, { header, notice, fileDiffs }, () => undefined);
}

function CommitsPane(props: DetailPaneHostProps): JSX.Element {
  const commits = (): readonly PullRequestCommit[] => props.content.commits();
  const commitsState = () => props.content.commitsState();

  const selectedCommit = createMemo(() => {
    const sha = props.content.selectedCommit();
    if (sha === undefined) {
      return undefined;
    }
    return commits().find((commit) => commit.sha === sha);
  });

  const fileDiffs = createMemo(() =>
    parseFileDiffs(patchText(props.content.commitPatch().value)),
  );

  const notice = (): string | undefined => {
    const state = commitsState();
    if (state.status === "loading") {
      return "Loading commits…";
    }
    if (state.status === "error") {
      return `Could not load commits: ${operationErrorDescription(state.error)}`;
    }
    const section = state.value;
    if (section?.status === "failed") {
      return `Could not load commits: ${operationErrorDescription(section.error)}`;
    }
    if (section?.status === "unsupported") {
      return section.reason.diagnostic;
    }
    if (selectedCommit() === undefined) {
      return "Select a commit in the sidebar to view it.";
    }
    const patch = props.content.commitPatch();
    if (patch.status === "loading") {
      return "Loading commit…";
    }
    if (patch.status === "error") {
      return `Could not load commit: ${operationErrorDescription(patch.error)}`;
    }
    if (patch.value === undefined) {
      return "Select a commit in the sidebar to view it.";
    }
    if (patch.value.status === "failed") {
      return `Could not load commit: ${operationErrorDescription(patch.value.error)}`;
    }
    if (patch.value.status === "unsupported") {
      return patch.value.reason.diagnostic;
    }
    return undefined;
  };

  const header = (): string => {
    const commit = selectedCommit();
    const meta = commit === undefined ? undefined : commitMetaLine(commit);
    return meta === undefined ? "Commits" : `Commits · ${meta}`;
  };

  const commitDetail = () => {
    const commit = selectedCommit();
    if (commit === undefined) {
      return undefined;
    }
    return (
      <box flexDirection="column" width="100%">
        <text fg={colors.foreground}>
          <strong>{commitMessage(commit)}</strong>
        </text>
        <text fg={colors.muted}>{commitMetaLine(commit)}</text>
        <text fg={colors.dim}>{commit.sha}</text>
      </box>
    );
  };

  return mainDetailPane(props, { header, notice, fileDiffs }, commitDetail);
}

function paneHint(tab: PullRequestTab): string {
  switch (tab) {
    case "diff":
      return "j/k scroll · h/l tabs · e lock files · x close PR";
    case "commits":
      return "j/k scroll · h/l tabs · x close PR";
    default:
      return "h/l switch tabs · r reloads · x close PR";
  }
}

function NoPullRequest(props: {
  readonly state: RepositoryAppContextState;
}): JSX.Element {
  const forgeError = () => forgeInitializationError(props.state);
  return (
    <box flexDirection="column" gap={1}>
      <Show when={props.state.kind === ApplicationContext.Local}>
        <text fg={colors.yellow}>Status: Local Git repository</text>
        <text fg={colors.muted}>
          Add a GitHub or Forgejo remote to initialize it.
        </text>
      </Show>
      <Show when={forgeError()}>
        {(error: Accessor<ForgeInitializationError>) => (
          <>
            <text fg={colors.yellow}>Status: CLI initialization error</text>
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
  const [bodyScroll, setBodyScroll] = createSignal<
    ScrollBoxRenderable | undefined
  >();
  const [detailScroll, setDetailScrollSignal] = createSignal<
    ScrollBoxRenderable | undefined
  >();
  const setDetailScroll = (element: ScrollBoxRenderable): void => {
    setDetailScrollSignal(element);
  };
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
    const number = openedNumber();
    const details = currentDetails();
    const detailsKey =
      details === undefined ? "pending" : `ready:${details.number}`;
    return `${number ?? "none"}:${detailsKey}:${titleLine() ?? ""}:${headerRepositoryName()}`;
  };

  const closeOpened = (): void => {
    props.titles.closeOpened();
    setPane({ active: "pull-requests" });
  };

  const detailPaneProps = {
    content: props.content,
    revealLocked,
    setDetailScroll,
  };

  useBindings(() => ({
    target: contentBox,
    commands: [
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
        name: "pr-view.scroll-down",
        run: () => {
          const element = detailScroll() ?? bodyScroll();
          if (element !== undefined) {
            element.scrollTop += 1;
          }
        },
      },
      {
        name: "pr-view.scroll-up",
        run: () => {
          const element = detailScroll() ?? bodyScroll();
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
      { key: "h", cmd: "pr-view.tab-previous" },
      { key: "l", cmd: "pr-view.tab-next" },
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
    const scroll = bodyScroll();
    if (scroll !== undefined) {
      scroll.focus();
      return;
    }
    contentBox()?.focus();
  });

  createEffect(
    on(
      () => props.content.activeTab(),
      () => {
        setDetailScrollSignal(undefined);
        const scroll = bodyScroll();
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
        {renderTabs(props.content)}
        <Show when={props.content.activeTab() === "diff"}>
          <FilesChangedPane {...detailPaneProps} />
        </Show>
        <Show when={props.content.activeTab() === "commits"}>
          <CommitsPane {...detailPaneProps} />
        </Show>
        <Show
          when={
            props.content.activeTab() !== "diff" &&
            props.content.activeTab() !== "commits"
          }
        >
          <scrollbox
            ref={setBodyScroll}
            flexGrow={1}
            flexShrink={1}
            minHeight={0}
            width="100%"
            stickyScroll
            stickyStart="top"
          >
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
                    {(item: PullRequestSummary) =>
                      renderOverview(item, overview)
                    }
                  </Show>
                )}
              </Show>
            </Show>
            <Show when={props.content.activeTab() !== "overview"}>
              {renderResourceTab(props.content)}
            </Show>
          </scrollbox>
        </Show>
        <box height={1} width="100%" flexGrow={0} flexShrink={0}>
          <text fg={colors.dim}>{paneHint(props.content.activeTab())}</text>
        </box>
      </Show>
    </box>
  );
}
