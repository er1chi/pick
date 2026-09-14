import { basename } from "node:path";
import { type RepositoryAppContextState } from "@/context/app-context";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
  type ForgeKind,
} from "@/services/forge/types";
import { colors } from "@/theme";
import { Show } from "solid-js";

export type RepoViewProps = {
  readonly state: RepositoryAppContextState;
};

function serviceName(kind: ForgeKind): string {
  return kind === ApplicationContext.GitHub ? "GitHub" : "Forgejo";
}

function contextLabel(kind: RepositoryAppContextState["kind"]): string {
  return kind === ApplicationContext.Local ? "Local Git" : serviceName(kind);
}

function initializationErrorDescription(
  error: ForgeInitializationError | undefined,
): string {
  if (error === undefined) {
    return "The CLI could not be initialized.";
  }

  const service = serviceName(error.kind);
  if (error.code === ForgeInitializationErrorCode.ExecutableUnavailable) {
    return `${service} CLI is unavailable.`;
  }
  return `${service} CLI version check failed.`;
}

export function RepoView(props: RepoViewProps) {
  const currentState = () => props.state;
  const name = () => basename(currentState().cwd) || currentState().cwd;
  const contextName = () => contextLabel(currentState().kind);

  return (
    <box flexDirection="column" gap={1} width="100%">
      <text fg={colors.foreground}>
        <strong>{name()}</strong>
      </text>
      <text fg={colors.muted}>{currentState().cwd}</text>
      <text fg={colors.muted}>Context: {contextName()}</text>
      <Show
        when={currentState().kind === ApplicationContext.Local}
        fallback={
          <Show when={currentState().forgeError !== undefined}>
            <box flexDirection="column">
              <text fg={colors.yellow}>Status: CLI initialization error</text>
              <text fg={colors.muted}>
                {initializationErrorDescription(currentState().forgeError)}
              </text>
            </box>
          </Show>
        }
      >
        <box flexDirection="column">
          <text fg={colors.yellow}>Status: Local Git repository</text>
          <text fg={colors.muted}>
            Add a GitHub or Forgejo remote to initialize it.
          </text>
        </box>
      </Show>
    </box>
  );
}
