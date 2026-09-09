import { Button } from "@/components/button";
import { missingConfigurationMessage, pickConfigResult } from "@/config/config";
import { ForgeService } from "@/services/forge/forge";
import { ForgejoProvider } from "@/services/forge/forgejo/forgejo";
import { GithubProvider } from "@/services/forge/github/github";
import { colors } from "@/theme";
import { useBindings } from "@opentui/keymap/solid";
import { useRenderer } from "@opentui/solid";
import { Toaster, toast } from "@tuiparts/toast/solid";
import { onMount } from "solid-js";

const forge = pickConfigResult.isOk()
  ? new ForgeService({
      github: new GithubProvider({
        token: pickConfigResult.value.githubAuthToken,
      }),
      forgejo: new ForgejoProvider({
        baseUrl: pickConfigResult.value.kubbFetchBaseUrl,
        token: pickConfigResult.value.forgejoAuthToken,
      }),
    })
  : undefined;

export function App() {
  const renderer = useRenderer();

  onMount(() => {
    renderer.setTerminalTitle("Pick");
    if (pickConfigResult.isErr() || forge === undefined) {
      toast.warning(missingConfigurationMessage);
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
