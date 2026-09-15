import { basename } from "node:path";
import {
  ApplicationContext,
  ForgeInitializationErrorCode,
  type ForgeInitializationError,
  type ForgeKind,
} from "@/services/forge/types";
import type { RepositoryAppContextState } from "@/context/app-context";
import { colors } from "@/theme";
import { Show } from "solid-js";
import type { Accessor } from "solid-js";

export interface PrViewProps {
  readonly state: RepositoryAppContextState;
  readonly contextLabel: string;
}

function serviceName(kind: ForgeKind): string {
  return kind === ApplicationContext.GitHub ? "GitHub" : "Forgejo";
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

export function PrView(props: PrViewProps) {
  const currentState = () => props.state;
  const name = () => basename(currentState().cwd) || currentState().cwd;

  return (
    <box
      flexDirection="column"
      flexGrow={1}
      flexShrink={1}
      minWidth={0}
      gap={1}
      paddingLeft={2}
      paddingRight={1}
    >
      <text fg={colors.foreground}>
        <strong>Pull Requests</strong>
      </text>
      <text fg={colors.foreground}>
        <strong>{name()}</strong>
      </text>
      <text fg={colors.muted}>{currentState().cwd}</text>
      <text fg={colors.muted}>Context: {props.contextLabel}</text>
      <text fg={colors.muted}>Pull requests will appear here.</text>
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
