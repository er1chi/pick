import { useBindings } from "@opentui/keymap/solid";
import { For, Show } from "solid-js";
import { useLocalRepository } from "@/context/local-repository-context";
import { useSpinnerFrame } from "@/shared/hooks/use-spinner-frame";
import { colors } from "@/theme";

import type { BoxRenderable } from "@opentui/core";
import type { Accessor, JSX } from "solid-js";
import type { RemoteLog } from "@/context/local-repository-context";

const height = 12;

const operationLabels = { push: "Push", pull: "Sync" } as const;

function statusTitle(log: RemoteLog, frame: string): string {
  const label = operationLabels[log.operation];
  switch (log.status) {
    case "running":
      return `${label} ${frame}`;
    case "succeeded":
      return `${label} · Done`;
    case "failed":
      return `${label} · Failed`;
    case "idle":
      return label;
  }
}

interface RemoteLogPanelProps {
  readonly target: Accessor<BoxRenderable | undefined>;
}

export function RemoteLogPanel(props: RemoteLogPanelProps): JSX.Element {
  const localRepository = useLocalRepository();
  const log = localRepository.remoteLog;
  const frame = useSpinnerFrame(() => log.status === "running");

  useBindings(() => ({
    target: props.target,
    bindings:
      log.status === "idle"
        ? []
        : [{ key: "escape", cmd: () => localRepository.dismissRemoteLog() }],
  }));

  return (
    <Show when={log.status !== "idle"}>
      <box
        flexDirection="column"
        height={height}
        flexShrink={0}
        width="100%"
        paddingLeft={1}
        paddingRight={1}
        border
        borderColor={log.status === "failed" ? colors.red : colors.border}
        title={statusTitle(log, frame())}
        bottomTitle={log.status === "running" ? undefined : "Esc close"}
        bottomTitleAlignment="right"
      >
        <scrollbox
          width="100%"
          flexGrow={1}
          minHeight={0}
          stickyScroll
          stickyStart="bottom"
        >
          <For each={log.lines}>
            {(line) => (
              <text fg={colors.muted} wrapMode="none">
                {line === "" ? " " : line}
              </text>
            )}
          </For>
        </scrollbox>
      </box>
    </Show>
  );
}
