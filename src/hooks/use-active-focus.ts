import type { Renderable } from "@opentui/core";
import { createEffect, type Accessor } from "solid-js";

export function useActiveFocus(
  active: Accessor<boolean>,
  target: Accessor<Renderable | undefined>,
) {
  createEffect(() => {
    if (active()) target()?.focus();
  });
}
