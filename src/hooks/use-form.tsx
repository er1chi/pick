import type { BoxRenderable, InputRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import { createSignal, onMount, type Accessor } from "solid-js";
import { createStore, type SetStoreFunction, type Store } from "solid-js/store";

export interface UseFormOptions<T extends object> {
  init: T;
  container: Accessor<BoxRenderable | null | undefined>;
}

interface Controls {
  next: () => void;
  prev: () => void;
}

export interface UseFormReturn<T extends object> {
  form: [Store<T>, SetStoreFunction<T>];
  controls: Controls;
  helpers: {
    isFocused: (index: number) => boolean;
    registerInputRefAtIdx: (
      index: number,
    ) => (el: InputRenderable | undefined) => void;
  };
}

export function useForm<T extends object>(
  options: UseFormOptions<T>,
): UseFormReturn<T> {
  const [form, setForm] = createStore<T>(options.init);
  const [activeIdx, setActiveIdx] = createSignal(-1);
  const inputs: Array<InputRenderable | undefined> = [];

  const focusIndex = (index: number) => {
    const el = inputs[index];
    if (!el || el.isDestroyed) return;
    setActiveIdx(index);
    el.focus();
  };

  const registerInputRefAtIdx =
    (index: number) => (el: InputRenderable | undefined) => {
      inputs[index] = el;
    };

  const step = (delta: 1 | -1) => {
    const len = inputs.length;
    if (len === 0) return;

    let idx = activeIdx();
    for (let n = 0; n < len; n++) {
      idx = (idx + delta + len) % len;
      const el = inputs[idx];
      if (el && !el.isDestroyed) {
        focusIndex(idx);
        return;
      }
    }
  };

  const next = () => step(1);
  const prev = () => step(-1);

  useBindings(() => ({
    target: options.container,
    bindings: [
      { key: "tab", cmd: () => next() },
      { key: "shift+tab", cmd: () => prev() },
      { key: "down", cmd: () => next() },
      { key: "up", cmd: () => prev() },
    ],
  }));

  onMount(() => {
    if (!inputs || !inputs[0]) return;
    inputs[0].focus();
  });

  return {
    form: [form, setForm],
    controls: { next, prev },
    helpers: {
      isFocused: (index) => activeIdx() === index,
      registerInputRefAtIdx,
    },
  };
}
