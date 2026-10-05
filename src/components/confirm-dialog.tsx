import { useDialog, useDialogKeyboard } from "@tuiparts/dialog/solid";
import { colors } from "@/theme";

import type { ConfirmContext } from "@tuiparts/dialog/solid";
import type { JSX } from "solid-js";

function ConfirmBody(props: {
  readonly context: ConfirmContext;
  readonly message: string;
}): JSX.Element {
  useDialogKeyboard((key) => {
    if (key.name === "y" || key.name === "return") {
      props.context.resolve(true);
    } else if (key.name === "n") {
      props.context.resolve(false);
    }
  }, props.context.dialogId);

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.foreground}>{props.message}</text>
      <text fg={colors.muted}>
        <strong>y</strong> Confirm <strong>n</strong> Cancel
      </text>
    </box>
  );
}

export function useConfirm(): (message: string) => Promise<boolean> {
  const dialog = useDialog();
  return (message) =>
    dialog.confirm({
      content: (context) => () => (
        <ConfirmBody context={context} message={message} />
      ),
    });
}
