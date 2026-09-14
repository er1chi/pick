import type { BoxRenderable, ScrollBoxRenderable } from "@opentui/core";
import {
  RepositorySelectionErrorCode,
  useAppContext,
  type RepositorySelectionError,
} from "@/context/app-context";
import {
  discoverRecentRepositories,
  type RecentRepository,
} from "@/services/repository-discovery";
import { moveInList } from "@/utils/navigation";
import { colors } from "@/theme";
import { useBindings } from "@opentui/keymap/solid";
import { toast } from "@tuiparts/toast/solid";
import { For, Show, createEffect, createSignal, onMount } from "solid-js";

const discoveryRootLabel = "~/Developer";

function RepositoryRow(props: {
  readonly repository: RecentRepository;
  readonly selected: boolean;
}) {
  return (
    <box
      id={props.repository.path}
      flexDirection="row"
      gap={1}
      width="100%"
      backgroundColor={props.selected ? colors.selected : undefined}
    >
      <text fg={props.selected ? colors.blue : colors.dim}>
        {props.selected ? ">" : " "}
      </text>
      <text fg={colors.foreground}>
        <strong>{props.repository.name}</strong>
      </text>
      <text fg={props.selected ? colors.foreground : colors.dim}>
        {props.repository.displayPath}
      </text>
    </box>
  );
}

export function Default() {
  const appContext = useAppContext();
  const [repositories, setRepositories] = createSignal<
    readonly RecentRepository[]
  >([]);
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

  function notifyRepositorySelectionError(
    error: RepositorySelectionError,
    repositoryName: string,
  ): void {
    switch (error.code) {
      case RepositorySelectionErrorCode.DirectoryChangeFailed:
        toast.error(`Could not open ${repositoryName}.`);
        return;
      case RepositorySelectionErrorCode.ContextInitializationFailed:
        toast.error(`Could not initialize ${repositoryName}.`);
        return;
      case RepositorySelectionErrorCode.TransitionInProgress:
        return;
    }
  }

  function activateSelectedRepository(): void {
    const currentRepositories = repositories();
    const currentSelectedPath = selectedPath();
    const selectedRepository = currentRepositories.find(
      (repository) => repository.path === currentSelectedPath,
    );
    if (selectedRepository == null) {
      return;
    }

    void appContext
      .selectRepository(selectedRepository.path)
      .then((result) => {
        if (result.isErr()) {
          notifyRepositorySelectionError(result.error, selectedRepository.name);
        }
      })
      .catch(() => {
        toast.error(`Could not open ${selectedRepository.name}.`);
      });
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
    void discoverRecentRepositories()
      .then((discoveredRepositories) => {
        setRepositories(discoveredRepositories);
      })
      .catch(() => {
        setRepositories([]);
      })
      .finally(() => {
        setIsLoading(false);
      });
  });

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
                <RepositoryRow
                  repository={repository}
                  selected={repository.path === selectedPath()}
                />
              )}
            </For>
          </scrollbox>
        </Show>
      </Show>
    </box>
  );
}
