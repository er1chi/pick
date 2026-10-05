import { useBindings } from "@opentui/keymap/solid";
import { For, Show } from "solid-js";
import { useLocalRepository } from "@/context/local-repository-context";
import { useSpinnerFrame } from "@/shared/hooks/use-spinner-frame";
import { colors } from "@/theme";

import type { BoxRenderable } from "@opentui/core";
import type { Accessor, JSX } from "solid-js";
import type { PushLog } from "@/context/local-repository-context";

const height = 12;

function statusTitle(log: PushLog, frame: string): string {
  switch (log.status) {
    case "running":
      return `Push ${frame}`;
    case "succeeded":
      return "Push · Done";
    case "failed":
      return "Push · Failed";
  }
}

interface PushLogPanelProps {
  readonly target: Accessor<BoxRenderable | undefined>;
}

export function PushLogPanel(props: PushLogPanelProps): JSX.Element {
  const localRepository = useLocalRepository();
  const frame = useSpinnerFrame(localRepository.pushing);

  useBindings(() => ({
    target: props.target,
    bindings:
      localRepository.pushLog() === undefined
        ? []
        : [{ key: "escape", cmd: () => localRepository.dismissPushLog() }],
  }));

  return (
    <Show when={localRepository.pushLog()}>
      {(log: Accessor<PushLog>) => (
        <box
          flexDirection="column"
          height={height}
          flexShrink={0}
          width="100%"
          paddingLeft={1}
          paddingRight={1}
          border
          borderColor={log().status === "failed" ? colors.red : colors.border}
          title={statusTitle(log(), frame())}
          bottomTitle={log().status === "running" ? undefined : "Esc close"}
          bottomTitleAlignment="right"
        >
          <scrollbox
            width="100%"
            flexGrow={1}
            minHeight={0}
            stickyScroll
            stickyStart="bottom"
          >
            <For each={log().lines}>
              {(line) => (
                <text fg={colors.muted} wrapMode="none" truncate>
                  {line === "" ? " " : line}
                </text>
              )}
            </For>
          </scrollbox>
        </box>
      )}
    </Show>
  );
}
