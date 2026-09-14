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
import type { Accessor } from "solid-js";

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
  error: ForgeInitializationError,
): string {
  const service = serviceName(error.kind);
  if (error.code === ForgeInitializationErrorCode.ExecutableUnavailable) {
    return `${service} CLI is unavailable.`;
  }
  return `${service} CLI version check failed.`;
}

function forgeInitializationError(
  state: RepositoryAppContextState,
): ForgeInitializationError | undefined {
  return state.kind === ApplicationContext.Local ? undefined : state.forgeError;
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
      <Show when={currentState().kind === ApplicationContext.Local}>
        <box flexDirection="column">
          <text fg={colors.yellow}>Status: Local Git repository</text>
          <text fg={colors.muted}>
            Add a GitHub or Forgejo remote to initialize it.
          </text>
        </box>
      </Show>
      <Show when={forgeInitializationError(currentState())}>
        {(error: Accessor<ForgeInitializationError>) => (
          <box flexDirection="column">
            <text fg={colors.yellow}>Status: CLI initialization error</text>
            <text fg={colors.muted}>
              {initializationErrorDescription(error())}
            </text>
          </box>
        )}
      </Show>
    </box>
  );
}
