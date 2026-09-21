import { useBindings } from "@opentui/keymap/solid";
import { createSignal } from "solid-js";
import { wrapIndex } from "@/utils/navigation";

import type { BoxRenderable } from "@opentui/core";
import type { Accessor } from "solid-js";

export interface NavigateList {
  readonly index: Accessor<number>;
  setCount(count: number): void;
  setIndex(index: number): void;
}

export function useNavigateList(options: {
  readonly target: Accessor<BoxRenderable | undefined>;
}): NavigateList {
  const [count, setCountSignal] = createSignal(0);
  const [index, setIndexSignal] = createSignal(0);

  function setCount(next: number): void {
    setCountSignal(next);
    if (next <= 0) {
      setIndexSignal(0);
      return;
    }
    setIndexSignal((current) => (current >= next ? 0 : current));
  }

  function setIndex(next: number): void {
    setIndexSignal(next);
  }

  function move(offset: number): void {
    const length = count();
    if (length <= 0) {
      return;
    }
    setIndexSignal((current) => {
      if (current >= 0) {
        return wrapIndex(current + offset, length);
      }
      if (offset > 0) {
        return 0;
      }
      return length - 1;
    });
  }

  useBindings(() => ({
    target: options.target,
    bindings: [
      { key: "j", cmd: () => move(1) },
      { key: "down", cmd: () => move(1) },
      { key: "k", cmd: () => move(-1) },
      { key: "up", cmd: () => move(-1) },
    ],
  }));

  return { index, setCount, setIndex };
}
