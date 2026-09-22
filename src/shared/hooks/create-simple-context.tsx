import { createContext, useContext } from "solid-js";
import { createStore, type SetStoreFunction } from "solid-js/store";

import type { JSX, ParentProps } from "solid-js";

type SimpleStore<T> = [get: T, set: SetStoreFunction<T>];

export function createSimpleContext<T extends object>({
  name,
  init,
}: {
  name: string;
  init: T;
}) {
  const ctx = createContext<SimpleStore<T>>(undefined, { name });

  return {
    Provider(props: ParentProps): JSX.Element {
      const store = createStore(init, { name });
      return <ctx.Provider value={store}>{props.children}</ctx.Provider>;
    },
    use(): SimpleStore<T> {
      const value = useContext(ctx);
      if (!value)
        throw new Error(
          `${name} Context must be used within a context provider`,
        );
      return value;
    },
  };
}
