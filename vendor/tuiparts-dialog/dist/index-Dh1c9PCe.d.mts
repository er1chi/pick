import { h as Dialog, v as DialogId } from "./themes-D90GOzst.mjs";
//#region src/prompts/types.d.ts
/**
 * Dialog state available via useDialogState selector.
 * Shared interface used by both React and Solid adapters.
 */
interface DialogState {
  /** Whether any dialog is currently open. */
  isOpen: boolean;
  /** Array of all active dialogs (oldest first). */
  dialogs: readonly Dialog[];
  /** The top-most (most recent) dialog, or undefined if none. */
  topDialog: Dialog | undefined;
  /** Number of currently open dialogs. */
  count: number;
}
/**
 * Context for a generic prompt dialog.
 * Call `resolve(value)` to complete with a value, or `dismiss()` to cancel.
 * @template T The type of value the prompt resolves to.
 */
interface PromptContext<T> {
  /** Resolves the Promise with the given value and closes the dialog. */
  resolve: (value: T) => void;
  /** Dismisses the dialog without a value. Resolves Promise with `undefined`. */
  dismiss: () => void;
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId;
}
/**
 * Context for a confirm dialog.
 * Call `resolve(true)` to confirm or `resolve(false)` to cancel.
 */
interface ConfirmContext {
  /** Resolves the Promise with the given boolean and closes the dialog. */
  resolve: (confirmed: boolean) => void;
  /** Dismisses the dialog without confirmation. Resolves Promise with `false`. */
  dismiss: () => void;
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId;
}
/**
 * Context for an alert dialog.
 * Call `dismiss()` to acknowledge and close the dialog.
 */
interface AlertContext {
  /** Acknowledges and closes the alert dialog. */
  dismiss: () => void;
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId;
}
/**
 * Context for a choice dialog.
 * Call `resolve(key)` to select an option, or `dismiss()` to cancel.
 * @template K The type of keys for the available choices.
 */
interface ChoiceContext<K> {
  /** Resolves the Promise with the selected key and closes the dialog. */
  resolve: (key: K) => void;
  /** Dismisses the dialog without selection. Resolves Promise with `undefined`. */
  dismiss: () => void;
  /** The unique ID of this dialog. Use with `useDialogKeyboard` for scoped keyboard handling. */
  dialogId: DialogId;
}
//#endregion
export { PromptContext as a, DialogState as i, ChoiceContext as n, ConfirmContext as r, AlertContext as t };