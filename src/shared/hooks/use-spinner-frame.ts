import cliSpinners from "cli-spinners";
import { createEffect, createSignal, onCleanup } from "solid-js";

import type { Accessor } from "solid-js";

export function useSpinnerFrame(active: Accessor<boolean>): Accessor<string> {
  const spinner = cliSpinners.dots;
  const [index, setIndex] = createSignal(0);

  createEffect(() => {
    if (!active()) {
      return;
    }
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % spinner.frames.length);
    }, spinner.interval);
    onCleanup(() => clearInterval(timer));
  });

  return () => spinner.frames[index()] ?? "";
}
