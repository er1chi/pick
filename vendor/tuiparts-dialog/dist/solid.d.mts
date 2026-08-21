import { S as DialogStyle, a as DialogTheme, b as DialogShowOptions, d as BaseChoiceOptions, f as BaseConfirmOptions, g as DialogContainerOptions, m as BasePromptOptions, p as BaseDialogActions, s as themes, u as BaseAlertOptions, v as DialogId, x as DialogSize } from "./themes-D90GOzst.mjs";
import { a as PromptContext, i as DialogState, n as ChoiceContext, r as ConfirmContext, t as AlertContext } from "./index-Dh1c9PCe.mjs";
import { KeyEvent } from "@opentui/core";
import { Accessor, JSX, ParentProps } from "solid-js";
//#region src/solid.d.ts
/** Function returning JSX. Required because Solid JSX is eagerly evaluated. */
type ContentAccessor = () => JSX.Element;
interface ShowOptions extends Omit<DialogShowOptions, "content"> {
  /** Must be a function returning JSX: `() => <text>Hi</text>` */
  content: ContentAccessor;
}
/** Content factory for prompt dialogs. */
type PromptContent<T> = (ctx: PromptContext<T>) => ContentAccessor;
/** Content factory for confirm dialogs. */
type ConfirmContent = (ctx: ConfirmContext) => ContentAccessor;
/** Content factory for alert dialogs. */
type AlertContent = (ctx: AlertContext) => ContentAccessor;
/** Content factory for choice dialogs. */
type ChoiceContent<K> = (ctx: ChoiceContext<K>) => ContentAccessor;
/**
 * Options for a generic prompt dialog.
 * @template T The type of value the prompt resolves to.
 */
interface PromptOptions<T> extends BasePromptOptions<T, PromptContent<T>> {}
/**
 * Options for a confirm dialog.
 */
interface ConfirmOptions extends BaseConfirmOptions<ConfirmContent> {}
/**
 * Options for an alert dialog.
 */
interface AlertOptions extends BaseAlertOptions<AlertContent> {}
/**
 * Options for a choice dialog.
 * @template K The type of keys for the available choices.
 */
interface ChoiceOptions<K> extends BaseChoiceOptions<ChoiceContent<K>, K> {}
/**
 * Dialog actions for showing, closing, and managing dialogs.
 * Extends BaseDialogActions with async prompt methods.
 */
interface DialogActions extends BaseDialogActions<ShowOptions> {
  /** Show a generic prompt dialog and wait for a response. */
  prompt: <T>(options: PromptOptions<T>) => Promise<T | undefined>;
  /** Show a confirmation dialog and wait for the user to confirm or cancel. */
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  /** Show an alert dialog and wait for the user to dismiss it. */
  alert: (options: AlertOptions) => Promise<void>;
  /** Show a choice dialog and wait for the user to select an option. */
  choice: <K>(options: ChoiceOptions<K>) => Promise<K | undefined>;
}
/**
 * Access dialog actions within a DialogProvider.
 *
 * For reactive state, use `useDialogState()` instead.
 *
 * @example
 * ```tsx
 * const dialog = useDialog();
 *
 * // Show a dialog (content must be a function returning JSX)
 * dialog.show({ content: () => <text>Hello</text> });
 *
 * // Close the top dialog
 * dialog.close();
 *
 * // Close a specific dialog
 * dialog.close(dialogId);
 *
 * // Close all dialogs
 * dialog.closeAll();
 * ```
 */
declare function useDialog(): DialogActions;
/**
 * Subscribe to reactive dialog state with a selector.
 *
 * Returns an accessor that tracks in effects/memos. The selector
 * is called inside a memo, so only the selected value is tracked.
 *
 * @example
 * ```tsx
 * // Subscribe to specific state - returns an accessor
 * const isOpen = useDialogState(s => s.isOpen);
 * const count = useDialogState(s => s.count);
 * const topDialog = useDialogState(s => s.topDialog);
 * const dialogs = useDialogState(s => s.dialogs);
 *
 * // Use in effects - tracks automatically
 * createEffect(() => {
 *   if (isOpen()) {
 *     console.log(`${count()} dialog(s) open`);
 *   }
 * });
 *
 * // Use in JSX - tracks automatically
 * <Show when={isOpen()}>
 *   <text>{count()} dialogs open</text>
 * </Show>
 * ```
 */
declare function useDialogState<T>(selector: (state: DialogState) => T): Accessor<T>;
/**
 * A keyboard hook for dialog content that only fires when the dialog is topmost.
 *
 * This prevents keyboard events from affecting stacked dialogs that are not focused.
 * Use this instead of `useKeyboard` inside dialog content components.
 *
 * @param handler - Keyboard event handler (only called when dialog is topmost)
 * @param dialogId - The dialog's ID from context (e.g., `ctx.dialogId`)
 *
 * @example
 * ```tsx
 * function DeleteConfirmDialog(props: ConfirmContext) {
 *   useDialogKeyboard((key) => {
 *     if (key.name === "return") props.resolve(true);
 *     if (key.name === "escape") props.resolve(false);
 *   }, props.dialogId);
 *
 *   return () => <text>Press Enter to confirm</text>;
 * }
 * ```
 */
declare function useDialogKeyboard(handler: (key: KeyEvent) => void | Promise<void>, dialogId: DialogId): void;
interface DialogProviderProps extends DialogContainerOptions {}
/**
 * Provides dialog functionality to children via useDialog() and useDialogState() hooks.
 *
 * @example
 * ```tsx
 * <DialogProvider size="medium">
 *   <App />
 * </DialogProvider>
 * ```
 */
declare function DialogProvider(props: ParentProps<DialogProviderProps>): import("@opentui/core").BaseRenderable;
//#endregion
export { type AlertContext, AlertOptions, type ChoiceContext, ChoiceOptions, type ConfirmContext, ConfirmOptions, ContentAccessor, DialogActions, type DialogContainerOptions, type DialogId, DialogProvider, DialogProviderProps, type DialogSize, type DialogState, type DialogStyle, type DialogTheme, type PromptContext, PromptOptions, ShowOptions, themes, useDialog, useDialogKeyboard, useDialogState };