import { createCliRenderer } from "@opentui/core";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { DialogProvider } from "@tuiparts/dialog/solid";
import { App } from "@/app";
import { PaneStore } from "@/context/active-pane-context";
import {
  ForgeContextProvider,
  initializeForgeContext,
} from "@/context/forge-context";
import { ViewContextProvider } from "@/context/view-context";
import { createAppKeymap } from "@/shared/keymap";

const renderer = await createCliRenderer({
  clearOnShutdown: true,
  exitOnCtrlC: true,
  targetFps: 30,
});
const keymap = createAppKeymap(renderer);
const forgeContext = await initializeForgeContext();

await render(
  () => (
    <ForgeContextProvider value={forgeContext}>
      <ViewContextProvider>
        <PaneStore.Provider>
          <KeymapProvider keymap={keymap}>
            <DialogProvider>
              <App />
            </DialogProvider>
          </KeymapProvider>
        </PaneStore.Provider>
      </ViewContextProvider>
    </ForgeContextProvider>
  ),
  renderer,
);
