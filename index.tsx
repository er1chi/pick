import { createCliRenderer } from "@opentui/core";
import { KeymapProvider } from "@opentui/keymap/solid";
import { render } from "@opentui/solid";
import { DialogProvider } from "@tuiparts/dialog/solid";
import { App } from "@/app";
import {
  AppContextProvider,
  initializeAppContext,
} from "@/context/app-context";
import { createAppKeymap } from "@/shared/keymap";
import { PaneStore } from "@/context/active-pane-context";

const renderer = await createCliRenderer({
  clearOnShutdown: true,
  exitOnCtrlC: true,
  targetFps: 30,
});
const keymap = createAppKeymap(renderer);
const appContext = await initializeAppContext();

await render(
  () => (
    <AppContextProvider value={appContext}>
      <PaneStore.Provider>
        <KeymapProvider keymap={keymap}>
          <DialogProvider>
            <App />
          </DialogProvider>
        </KeymapProvider>
      </PaneStore.Provider>
    </AppContextProvider>
  ),
  renderer,
);
