import { useBindings } from "@opentui/keymap/solid";
import { For, Show } from "solid-js";
import { useLocalRepository } from "@/context/local-repository-context";
import { useSpinnerFrame } from "@/shared/hooks/use-spinner-frame";
import { colors } from "@/theme";

import type { BoxRenderable } from "@opentui/core";
import type { Accessor, JSX } from "solid-js";
import type { PushLog } from "@/context/local-repository-context";

const height = 12;

function statusTitle(status: PushLog["status"], frame: string): string {
  switch (status) {
    case "running":
      return `Push ${frame}`;
    case "succeeded":
      return "Push · Done";
    case "failed":
      return "Push · Failed";
    case "idle":
      return "Push";
  }
}

interface PushLogPanelProps {
  readonly target: Accessor<BoxRenderable | undefined>;
}

export function PushLogPanel(props: PushLogPanelProps): JSX.Element {
  const localRepository = useLocalRepository();
  const log = localRepository.pushLog;
  const frame = useSpinnerFrame(() => log.status === "running");

  useBindings(() => ({
    target: props.target,
    bindings:
      log.status === "idle"
        ? []
        : [{ key: "escape", cmd: () => localRepository.dismissPushLog() }],
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
        title={statusTitle(log.status, frame())}
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
              <text fg={colors.muted} wrapMode="none" truncate>
                {line === "" ? " " : line}
              </text>
            )}
          </For>
        </scrollbox>
      </box>
    </Show>
  );
}
