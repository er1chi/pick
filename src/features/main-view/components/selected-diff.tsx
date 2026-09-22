import { For, Show, createMemo, type Accessor, type JSX } from "solid-js";
import { useViewContext, type ActiveView } from "@/context/view-context";
import { oneLine } from "@/features/main-view/components/pr-view-chrome";
import {
  SplitFileDiff,
  type SplitFileDiffScrollTarget,
} from "@/packages/pierre/solid/diffs";
import { colors } from "@/theme";
import { truncateEnd } from "@/utils/truncate";
import { patchFileIndex } from "../utils/patch-file-index";
import { CommitMetadata } from "./commit-metadata";

import type { FileDiffMetadata } from "@pierre/diffs";
import type {
  ForgeSection,
  PullRequestCommit,
  PullRequestPatch,
} from "@/services/forge/types";

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

function fileDiffsForPatch(
  section: ForgeSection<PullRequestPatch> | undefined,
  path: string | undefined,
): readonly FileDiffMetadata[] {
  if (path === undefined) {
    return [];
  }
  const fileDiff = patchFileIndex(section).byPath.get(path);
  return fileDiff === undefined ? [] : [fileDiff];
}

function patchSectionNotice(
  section: ForgeSection<PullRequestPatch>,
): string | undefined {
  switch (section.status) {
    case "unsupported":
      return section.reason;
    case "failed":
      return `Could not load patch: ${section.error.message}`;
    default:
      return undefined;
  }
}

const lockedNotice =
  "Lock file contents are hidden by default. Press e to show them.";

interface SelectedDiffProps {
  readonly view: Extract<ActiveView, { kind: "diff" }>;
  readonly commit: PullRequestCommit | undefined;
  readonly revealLocked: boolean;
  readonly maxWidth: number;
  readonly setDiffScroll: (
    target: SplitFileDiffScrollTarget | undefined,
  ) => void;
}

export function SelectedDiffBody(props: SelectedDiffProps): JSX.Element {
  const viewContext = useViewContext();
  const fromCommit = () => props.view.commit !== undefined;
  const fileDiffs = createMemo(() =>
    fileDiffsForPatch(viewContext.currentPatch(), props.view.path),
  );

  const notice = (): string | undefined => {
    const section = viewContext.currentPatch();
    if (section === undefined) {
      return undefined;
    }
    const sectionNotice = patchSectionNotice(section);
    if (sectionNotice !== undefined) {
      return sectionNotice;
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
      gap={1}
    >
      <Show when={props.view.commit} keyed>
        {(sha: string) => (
          <scrollbox
            flexGrow={0}
            flexBasis={0}
            flexShrink={1}
            minHeight={10}
            width="100%"
          >
            <CommitMetadata
              sha={sha}
              commit={props.commit}
              hasFile
              maxWidth={props.maxWidth}
            />
          </scrollbox>
        )}
      </Show>
      <box
        flexDirection="column"
        width="100%"
        flexGrow={1}
        flexBasis={0}
        flexShrink={1}
        minHeight={fromCommit() ? 9 : 0}
      >
        {oneLine(
          <text fg={colors.dim} wrapMode="none" truncate>
            {truncateEnd(
              fromCommit()
                ? `Commit diff · ${props.view.path}`
                : `Pull request diff · ${props.view.path}`,
              props.maxWidth,
            )}
          </text>,
        )}
        <Show
          when={notice()}
          fallback={
            <For each={fileDiffs()}>
              {(fileDiff) => (
                <box
                  flexDirection="column"
                  width="100%"
                  flexGrow={1}
                  flexShrink={1}
                  minHeight={0}
                >
                  {oneLine(
                    <text fg={colors.foreground} wrapMode="none" truncate>
                      {fileDiffName(fileDiff)}
                    </text>,
                  )}
                  <Show
                    when={props.revealLocked || !isLockFile(fileDiff.name)}
                    fallback={<text fg={colors.dim}>{lockedNotice}</text>}
                  >
                    <SplitFileDiff
                      fileDiff={fileDiff}
                      widthHint={props.maxWidth}
                      scrollTargetRef={props.setDiffScroll}
                    />
                  </Show>
                </box>
              )}
            </For>
          }
        >
          {(text: Accessor<string>) => <text fg={colors.muted}>{text()}</text>}
        </Show>
      </box>
    </box>
  );
}
