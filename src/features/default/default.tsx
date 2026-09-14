import {
  discoverRecentRepositories,
  type RecentRepository,
} from "@/services/repository-discovery";
import { colors } from "@/theme";
import { For, Show, createSignal, onMount } from "solid-js";

const discoveryRootLabel = "~/Developer";

function RepositoryRow(props: { readonly repository: RecentRepository }) {
  return (
    <box flexDirection="row" gap={1} width="100%">
      <text fg={colors.blue}>{">"}</text>
      <text fg={colors.foreground}>
        <strong>{props.repository.name}</strong>
      </text>
      <text fg={colors.dim}>{props.repository.displayPath}</text>
    </box>
  );
}

export function Default() {
  const [repositories, setRepositories] = createSignal<
    readonly RecentRepository[]
  >([]);
  const [isLoading, setIsLoading] = createSignal(true);

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
      flexDirection="column"
      gap={1}
      width="100%"
      maxWidth={80}
      alignSelf="stretch"
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
            flexDirection="column"
            width="100%"
            maxHeight={8}
            stickyScroll
            stickyStart="top"
          >
            <For each={repositories()}>
              {(repository) => <RepositoryRow repository={repository} />}
            </For>
          </scrollbox>
        </Show>
      </Show>
    </box>
  );
}
