import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui";

import type { CliRenderer } from "@opentui/core";

export function createAppKeymap(renderer: CliRenderer) {
  const keymap = createDefaultOpenTuiKeymap(renderer);

  keymap.registerLayer({
    commands: [
      {
        name: "app.quit",
        run: () => renderer.destroy(),
      },
    ],
    bindings: [
      // Keep plain "q" available for text inputs.
      { key: "ctrl+q", cmd: "app.quit" },
    ],
  });

  return keymap;
}
