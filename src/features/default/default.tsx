import { useBindings } from "@opentui/keymap/solid";
import { toast } from "@tuiparts/toast/solid";
import { For, Show, createEffect, createSignal, onMount } from "solid-js";
import { SelectableRow } from "@/components/selectable-row";
import { useForgeContext } from "@/context/forge-context";
import {
  discoverRecentRepositories,
  type RecentRepository,
  type RepositoryDiscoveryError,
} from "@/services/repo-discovery";
import { colors } from "@/theme";
import { moveInList } from "@/utils/navigation";

import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";

const discoveryRootLabel = "~/Developer";

export function Default() {
  const forgeContext = useForgeContext();
  const [repositories, setRepositories] = createSignal<
    readonly RecentRepository[]
  >([]);
  const [discoveryError, setDiscoveryError] = createSignal<
    RepositoryDiscoveryError | undefined
  >();
  const [isLoading, setIsLoading] = createSignal(true);
  const [selectedPath, setSelectedPath] = createSignal<string | null>(null);
  const [recentRepositoriesBox, setRecentRepositoriesBox] = createSignal<
    BoxRenderable | undefined
  >();
  const [recentRepositoriesScrollBox, setRecentRepositoriesScrollBox] =
    createSignal<ScrollBoxRenderable | undefined>();

  createEffect(() => {
    const currentRepositories = repositories();
    const currentSelectedPath = selectedPath();
    const nextSelectedPath =
      currentRepositories.find(
        (repository) => repository.path === currentSelectedPath,
      )?.path ??
      currentRepositories[0]?.path ??
      null;

    if (nextSelectedPath !== currentSelectedPath) {
      setSelectedPath(nextSelectedPath);
    }
  });

  function moveSelection(offset: number): void {
    const currentRepositories = repositories();
    if (currentRepositories.length === 0) {
      return;
    }

    const currentSelectedPath = selectedPath();
    const currentRepository =
      currentRepositories.find(
        (repository) => repository.path === currentSelectedPath,
      ) ?? currentRepositories[0]!;
    const nextRepository = moveInList(
      currentRepositories,
      currentRepository,
      offset,
    );
    setSelectedPath(nextRepository.path);
    recentRepositoriesScrollBox()?.scrollChildIntoView(nextRepository.path);
  }

  async function activateSelectedRepository(): Promise<void> {
    const currentRepositories = repositories();
    const currentSelectedPath = selectedPath();
    const selectedRepository = currentRepositories.find(
      (repository) => repository.path === currentSelectedPath,
    );
    if (selectedRepository == null) {
      return;
    }

    // `selectRepository` never rejects: every failure mode is a tagged error
    // carried in the `Result`.
    const result = await forgeContext.selectRepository(selectedRepository.path);
    if (result.isErr()) {
      toast.error(`Could not initialize ${selectedRepository.name}.`);
    }
  }

  useBindings(() => ({
    target: recentRepositoriesBox,
    commands: [
      {
        name: "default.repositories.move-up",
        run: () => moveSelection(-1),
      },
      {
        name: "default.repositories.move-down",
        run: () => moveSelection(1),
      },
      {
        name: "default.repositories.activate",
        run: activateSelectedRepository,
      },
    ],
    bindings: [
      { key: "k", cmd: "default.repositories.move-up" },
      { key: "up", cmd: "default.repositories.move-up" },
      { key: "j", cmd: "default.repositories.move-down" },
      { key: "down", cmd: "default.repositories.move-down" },
      { key: "return", cmd: "default.repositories.activate" },
    ],
  }));

  onMount(() => {
    void loadRecentRepositories();
  });

  async function loadRecentRepositories(): Promise<void> {
    try {
      const result = await discoverRecentRepositories();
      result.match({
        ok: (discoveredRepositories) => {
          setRepositories(discoveredRepositories);
          setDiscoveryError(undefined);
        },
        err: (error) => {
          setRepositories([]);
          setDiscoveryError(error);
        },
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <box
      ref={setRecentRepositoriesBox}
      focusable
      focused
      flexDirection="column"
      gap={1}
      width="100%"
    >
      <text fg={colors.foreground}>
        <strong>Recent repositories</strong>
      </text>
      <Show
        when={!isLoading()}
        fallback={
          <text fg={colors.muted}>
            Looking for repositories in {discoveryRootLabel}…
          </text>
        }
      >
        <Show
          when={discoveryError() === undefined}
          fallback={
            <text fg={colors.muted}>
              Could not search for Git repositories in {discoveryRootLabel}.
            </text>
          }
        >
          <Show
            when={repositories().length > 0}
            fallback={
              <text fg={colors.muted}>
                No Git repositories found in {discoveryRootLabel}.
              </text>
            }
          >
            <scrollbox
              ref={setRecentRepositoriesScrollBox}
              width="100%"
              maxHeight={8}
              stickyScroll
              stickyStart="top"
            >
              <For each={repositories()}>
                {(repository) => (
                  <SelectableRow
                    id={repository.path}
                    label={repository.name}
                    detail={repository.displayPath}
                    selected={repository.path === selectedPath()}
                  />
                )}
              </For>
            </scrollbox>
          </Show>
        </Show>
      </Show>
    </box>
  );
}
