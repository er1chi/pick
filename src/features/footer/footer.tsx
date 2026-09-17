import { colors } from "@/theme";
import { useTerminalDimensions } from "@opentui/solid";
import { For, Show } from "solid-js";

export interface FooterBinding {
  readonly key: string;
  readonly label: string;
}

export interface FooterProps {
  readonly bindings: readonly FooterBinding[];
}

function bindingWidth(binding: FooterBinding): number {
  return binding.key.length + 1 + binding.label.length;
}

/**
 * Number of bindings that fit on one line. When the full list does not fit,
 * one column is reserved for a trailing ellipsis so the row always ends
 * cleanly instead of wrapping or eliding in the middle.
 */
function visibleBindingCount(
  bindings: readonly FooterBinding[],
  maxWidth: number,
): number {
  const total = bindings.reduce(
    (width, binding, index) =>
      width + bindingWidth(binding) + (index === 0 ? 0 : 2),
    0,
  );
  if (total <= maxWidth) {
    return bindings.length;
  }
  const budget = Math.max(0, maxWidth - 1);
  let used = 0;
  let count = 0;
  for (const binding of bindings) {
    const next = used + (count === 0 ? 0 : 2) + bindingWidth(binding);
    if (next > budget) {
      break;
    }
    used = next;
    count += 1;
  }
  return count;
}

/**
 * Footer bindings render as one bounded text row so a narrow terminal drops
 * trailing hints rather than wrapping labels onto a second visual line.
 */
export function Footer(props: FooterProps) {
  const dimensions = useTerminalDimensions();
  const maxWidth = () => Math.max(0, dimensions().width - 2);
  const visible = () =>
    props.bindings.slice(0, visibleBindingCount(props.bindings, maxWidth()));

  return (
    <box
      flexDirection="row"
      width="100%"
      height={1}
      paddingLeft={1}
      paddingRight={1}
      backgroundColor={colors.selected}
      overflow="hidden"
    >
      <text fg={colors.muted} wrapMode="none">
        <For each={visible()}>
          {(binding, index) => (
            <>
              {index() === 0 ? "" : "  "}
              <strong>{binding.key}</strong> {binding.label}
            </>
          )}
        </For>
        <Show when={visible().length < props.bindings.length}>…</Show>
      </text>
    </box>
  );
}
