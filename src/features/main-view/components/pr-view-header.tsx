import { For, Show, type Accessor, type JSX } from "solid-js";
import {
  ApplicationContext,
  type RepositoryForgeContextState,
} from "@/context/forge-context";
import { usePullRequest } from "@/context/pull-request-context";
import { viewCommit, type PullRequestView } from "@/context/view-context";
import {
  CLOSE_AFFORDANCE_GAP,
  CLOSE_DIFF_LABEL,
  CLOSE_PR_LABEL,
  oneLine,
} from "@/features/main-view/components/pr-view-chrome";
import { persistentMetadataLines } from "@/features/main-view/utils/pr-view-display";
import {
  type ForgeInitializationError,
  ForgeKind,
  type PullRequestDetails,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { truncateEnd } from "@/utils/text";

interface PersistentHeaderProps {
  readonly repositoryName: string;
  readonly titleLine: string | undefined;
  readonly details: PullRequestDetails | undefined;
  readonly maxWidth: number;
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
      {oneLine(
        <text fg={colors.foreground} wrapMode="none" truncate>
          <strong>{truncateEnd(props.repositoryName, props.maxWidth)}</strong>
        </text>,
      )}
      <Show when={props.titleLine}>
        {(title: Accessor<string>) =>
          oneLine(
            <text fg={colors.foreground} wrapMode="none" truncate>
              <strong>{truncateEnd(title(), props.maxWidth)}</strong>
            </text>,
          )
        }
      </Show>
      <For each={metadataLines()}>
        {(line) =>
          oneLine(
            <text fg={colors.muted} wrapMode="none" truncate>
              {truncateEnd(line, props.maxWidth)}
            </text>,
          )
        }
      </For>
    </box>
  );
}

function contextBanner(view: PullRequestView): string {
  const commit = viewCommit(view);
  const path = view.kind === "diff" ? view.path : undefined;
  // The full SHA stays in the commit metadata below; the fixed context line
  // only needs a short, stable reference.
  const reference = commit === undefined ? undefined : commit.slice(0, 12);
  if (reference !== undefined && path !== undefined) {
    return `Context: Commit ${reference} · File ${path}`;
  }
  if (reference !== undefined) {
    return `Context: Commit ${reference}`;
  }
  if (path !== undefined) {
    return `Context: Pull request · File ${path}`;
  }
  return "Context: Pull request";
}

interface ContextRowProps {
  readonly banner: string;
  readonly affordances: readonly string[];
  readonly maxWidth: number;
}

function ContextRow(props: ContextRowProps): JSX.Element {
  const affordancesWidth = () =>
    props.affordances.reduce(
      (width, label, index) =>
        width + label.length + (index === 0 ? 0 : CLOSE_AFFORDANCE_GAP),
      0,
    );
  const bannerWidth = () =>
    Math.max(8, props.maxWidth - affordancesWidth() - 1);

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      flexGrow={0}
      flexShrink={0}
    >
      <box
        flexGrow={1}
        flexShrink={1}
        minWidth={0}
        height={1}
        overflow="hidden"
      >
        <text fg={colors.blue} wrapMode="none" truncate>
          <strong>{truncateEnd(props.banner, bannerWidth())}</strong>
        </text>
      </box>
      <box
        flexShrink={0}
        height={1}
        flexDirection="row"
        gap={CLOSE_AFFORDANCE_GAP}
      >
        <For each={props.affordances}>
          {(label) => (
            <text fg={colors.red} wrapMode="none">
              {label}
            </text>
          )}
        </For>
      </box>
    </box>
  );
}

export function LocalDiffHeader(props: {
  readonly path: string;
  readonly maxWidth: number;
}): JSX.Element {
  return (
    <ContextRow
      banner={`Context: Local changes · File ${props.path}`}
      affordances={[CLOSE_DIFF_LABEL]}
      maxWidth={props.maxWidth}
    />
  );
}

interface PrViewHeaderProps {
  readonly view: PullRequestView;
  readonly repositoryName: string;
  readonly titleLine: string | undefined;
  readonly headerKey: string;
  readonly maxWidth: number;
}

export function PrViewHeader(props: PrViewHeaderProps): JSX.Element {
  const pullRequest = usePullRequest();
  const diffContextSelected = () => props.view.kind !== "pr";
  const detailsSection = () => pullRequest.data()?.details;
  const details = () => {
    const section = detailsSection();
    return section?.status === "available" ? section.value : undefined;
  };
  const detailsError = () => {
    const section = detailsSection();
    return section?.status === "failed" ? section.error.message : undefined;
  };

  return (
    <box
      flexDirection="column"
      gap={0}
      width="100%"
      flexGrow={0}
      flexShrink={0}
    >
      <ContextRow
        banner={contextBanner(props.view)}
        affordances={
          diffContextSelected()
            ? [CLOSE_DIFF_LABEL, CLOSE_PR_LABEL]
            : [CLOSE_PR_LABEL]
        }
        maxWidth={props.maxWidth}
      />
      <Show keyed when={props.headerKey}>
        {() => (
          <PersistentHeader
            repositoryName={props.repositoryName}
            titleLine={props.titleLine}
            details={props.view.kind === "diff" ? undefined : details()}
            maxWidth={props.maxWidth}
          />
        )}
      </Show>
      <Show when={detailsError()}>
        {(error: Accessor<string>) => (
          <box flexDirection="column">
            {oneLine(
              <text fg={colors.yellow} wrapMode="none" truncate>
                Could not load pull request details.
              </text>,
            )}
            {oneLine(
              <text fg={colors.dim} wrapMode="none" truncate>
                {error()}
              </text>,
            )}
          </box>
        )}
      </Show>
    </box>
  );
}

function serviceName(kind: ForgeKind): string {
  return kind === ForgeKind.GitHub ? "GitHub" : "Forgejo";
}

function initializationErrorDescription(
  error: ForgeInitializationError,
): string {
  return error.match({
    ForgeExecutableUnavailableError: (e) =>
      `${serviceName(e.kind)} CLI is unavailable.`,
    ForgeVersionCheckFailedError: (e) =>
      `${serviceName(e.kind)} CLI version check failed.`,
  });
}

function forgeInitializationError(
  state: RepositoryForgeContextState,
): ForgeInitializationError | undefined {
  return state.kind === ApplicationContext.Local ? undefined : state.forgeError;
}

export function NoPullRequest(props: {
  readonly state: RepositoryForgeContextState;
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
          <strong>Context: Local changes</strong>
        </text>
        <text fg={colors.muted}>
          Select a pull request in the sidebar and press enter to review it.
        </text>
      </Show>
    </box>
  );
}
