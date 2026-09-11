import { Button } from "@/components/button";
import { useAppContext } from "@/context/app-context";
import { colors } from "@/theme";
import { useBindings } from "@opentui/keymap/solid";
import { useRenderer } from "@opentui/solid";
import { Toaster, toast } from "@tuiparts/toast/solid";
import { onMount } from "solid-js";

function notifyCliInitializationError(
  service: "GitHub" | "Forgejo",
  executable: "gh" | "fj",
  code: "executable-unavailable" | "version-check-failed",
) {
  const reason =
    code === "executable-unavailable"
      ? "is unavailable"
      : "version check failed";
  toast.warning(`${service} CLI (${executable}) ${reason}.`);
}

export function App() {
  const renderer = useRenderer();
  const appContext = useAppContext();

  onMount(() => {
    renderer.setTerminalTitle("Pick");

    if (appContext.kind === "github" && appContext.github.isErr()) {
      notifyCliInitializationError(
        "GitHub",
        "gh",
        appContext.github.error.code,
      );
    }

    if (appContext.kind === "forgejo" && appContext.forgejo.isErr()) {
      notifyCliInitializationError(
        "Forgejo",
        "fj",
        appContext.forgejo.error.code,
      );
    }
  });

  useBindings(() => ({
    commands: [
      {
        name: "pick.notify",
        run: () => toast.success("Pick is ready."),
      },
    ],
    bindings: [{ key: "return", cmd: "pick.notify" }],
  }));

  return (
    <box
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      width="100%"
      height="100%"
      gap={1}
    >
      <text fg={colors.blue}>
        <strong>Pick</strong>
      </text>
      <text fg={colors.muted}>Git, GitHub, and Forgejo — in the terminal.</text>
      <Button label="Press Enter" color={colors.green} />
      <text fg={colors.dim}>Ctrl+Q quits</text>
      <Toaster position="top-right" stackingMode="stack" visibleToasts={3} />
    </box>
  );
}
