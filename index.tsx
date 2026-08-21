import { createCliRenderer } from "@opentui/core";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { DialogProvider } from "@tuiparts/dialog/solid";
import { App } from "@/app";
import { createAppKeymap } from "@/shared/keymap";

const renderer = await createCliRenderer({
  clearOnShutdown: true,
  exitOnCtrlC: true,
  targetFps: 30,
});
const keymap = createAppKeymap(renderer);

await render(
  () => (
    <KeymapProvider keymap={keymap}>
      <DialogProvider>
        <App />
      </DialogProvider>
    </KeymapProvider>
  ),
  renderer,
);
