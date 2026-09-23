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
import { useNavigateList } from "@/shared/hooks/use-navigate-list";
import { useScrollIntoView } from "@/shared/hooks/use-scroll-into-view";
import { colors } from "@/theme";

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
  const [recentRepositoriesBox, setRecentRepositoriesBox] = createSignal<
    BoxRenderable | undefined
  >();
  const [recentRepositoriesScrollBox, setRecentRepositoriesScrollBox] =
    createSignal<ScrollBoxRenderable | undefined>();

  const navigation = useNavigateList({ target: recentRepositoriesBox });

  createEffect(() => navigation.setCount(repositories().length));

  useScrollIntoView(
    () => repositories()[navigation.index()]?.path,
    recentRepositoriesScrollBox,
  );

  async function activateSelectedRepository(): Promise<void> {
    const selectedRepository = repositories()[navigation.index()];
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
    bindings: [{ key: "return", cmd: activateSelectedRepository }],
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
                    selected={
                      repository.path ===
                      repositories()[navigation.index()]?.path
                    }
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
