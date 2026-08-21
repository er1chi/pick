import { C as DialogToClose, S as DialogStyle, T as isDialogToClose, _ as DialogContentFactory, a as DialogTheme, b as DialogShowOptions, d as BaseChoiceOptions, f as BaseConfirmOptions, g as DialogContainerOptions, h as Dialog, l as AsyncDialogOptions, m as BasePromptOptions, p as BaseDialogActions, s as themes, u as BaseAlertOptions, v as DialogId, w as InternalDialog, x as DialogSize, y as DialogOptions } from "./themes-D90GOzst.mjs";
import { a as PromptContext, i as DialogState, n as ChoiceContext, r as ConfirmContext, t as AlertContext } from "./index-Dh1c9PCe.mjs";
import { BoxRenderable, RenderContext, Renderable } from "@opentui/core";
//#region src/manager.d.ts
type DialogSubscriber = (data: Dialog | DialogToClose) => void;
/** Content factory for prompt dialogs. */
type PromptContent<T> = (renderCtx: RenderContext, promptCtx: PromptContext<T>) => Renderable;
/** Content factory for confirm dialogs. */
type ConfirmContent = (renderCtx: RenderContext, confirmCtx: ConfirmContext) => Renderable;
/** Content factory for alert dialogs. */
type AlertContent = (renderCtx: RenderContext, alertCtx: AlertContext) => Renderable;
/** Content factory for choice dialogs. */
type ChoiceContent<K> = (renderCtx: RenderContext, choiceCtx: ChoiceContext<K>) => Renderable;
/**
 * Options for a generic prompt dialog using core renderables.
 * @template T The type of value the prompt resolves to.
 */
interface PromptOptions<T> extends BasePromptOptions<T, PromptContent<T>> {}
/**
 * Options for a confirm dialog using core renderables.
 */
interface ConfirmOptions extends BaseConfirmOptions<ConfirmContent> {}
/**
 * Options for an alert dialog using core renderables.
 */
interface AlertOptions extends BaseAlertOptions<AlertContent> {}
/**
 * Options for a choice dialog using core renderables.
 * @template K The type of keys for the available choices.
 */
interface ChoiceOptions<K> extends BaseChoiceOptions<ChoiceContent<K>, K> {}
/**
 * Extended DialogShowOptions for async dialog factory functions.
 * @template T The type of value returned on dismiss.
 */
interface AsyncShowOptions<T> extends DialogShowOptions {
  /** Fallback value when dialog is dismissed via ESC or backdrop click. */
  fallback?: T;
}
/**
 * Manages dialog state and lifecycle for a DialogContainerRenderable.
 *
 * @example
 * ```ts
 * const manager = new DialogManager(renderer);
 * const container = new DialogContainerRenderable(renderer, { manager });
 *
 * manager.show({
 *   content: (ctx) => new TextRenderable(ctx, { content: "Hello" }),
 * });
 * ```
 */
declare class DialogManager {
  private dialogs;
  private subscribers;
  private idCounter;
  private savedFocus;
  private ctx;
  private focusRestoreTimeout?;
  private destroyed;
  constructor(ctx: RenderContext);
  private saveFocus;
  private cancelPendingFocusRestore;
  private restoreFocus;
  /** Subscribe to dialog state changes. Returns an unsubscribe function. */
  subscribe(subscriber: DialogSubscriber): () => void;
  private publish;
  private addDialog;
  /**
   * Show a new dialog.
   *
   * @example
   * ```ts
   * manager.show({
   *   content: (ctx) => new TextRenderable(ctx, { content: "Hello" }),
   *   size: "medium",
   * });
   * ```
   */
  show(options: DialogShowOptions): DialogId;
  /** Close a dialog by ID, or the top-most dialog if no ID provided. */
  close(id?: DialogId): DialogId | undefined;
  /** Close all open dialogs. */
  closeAll(): void;
  /** Close all dialogs and show a new one. */
  replace(options: DialogShowOptions): DialogId;
  /**
   * Get all active dialogs (oldest first).
   *
   * Returns a stable reference that only changes when dialogs are
   * added/removed/updated.
   */
  getDialogs(): readonly Dialog[];
  /** Get the top-most active dialog. */
  getTopDialog(): Dialog | undefined;
  /** Check if any dialogs are open. */
  isOpen(): boolean;
  /**
   * Builds DialogShowOptions from either a factory function or a CoreOptions object.
   */
  private buildShowOptions;
  /**
   * Internal helper that handles common async dialog logic:
   * - Promise creation
   * - Safe double-resolve protection
   * - Dialog show/close lifecycle
   * - Fallback value handling for ESC/backdrop dismissal
   */
  private showAsyncDialog;
  /**
   * Show a generic prompt dialog and wait for a response.
   *
   * @template T The type of value the prompt resolves to.
   *
   * Accepts either PromptOptions (for imperative usage) or a factory function
   * that receives the prompt context and returns AsyncShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * const result = await manager.prompt<string>({
   *   content: (renderCtx, { resolve, dismiss }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "row" });
   *     const cancelBtn = new TextRenderable(renderCtx, { content: "Cancel" });
   *     cancelBtn.on("mouseUp", dismiss);
   *     const okBtn = new TextRenderable(renderCtx, { content: "OK" });
   *     okBtn.on("mouseUp", () => resolve("some-value"));
   *     box.add(cancelBtn);
   *     box.add(okBtn);
   *     return box;
   *   },
   * });
   * ```
   */
  prompt<T>(options: PromptOptions<T>): Promise<T | undefined>;
  prompt<T>(showFactory: (ctx: PromptContext<T>) => AsyncShowOptions<T | undefined>): Promise<T | undefined>;
  /**
   * Show a confirmation dialog and wait for the user to confirm or cancel.
   *
   * @returns `true` if confirmed, `false` if cancelled or dismissed.
   *
   * Accepts either ConfirmOptions (for imperative usage) or a factory function
   * that receives the confirm context and returns AsyncShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * const confirmed = await manager.confirm({
   *   content: (renderCtx, { resolve }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "column" });
   *     const title = new TextRenderable(renderCtx, { content: "Delete file?" });
   *     box.add(title);
   *
   *     const buttons = new BoxRenderable(renderCtx, { flexDirection: "row" });
   *     const cancelBtn = new TextRenderable(renderCtx, { content: "Cancel" });
   *     cancelBtn.on("mouseUp", () => resolve(false));
   *     const confirmBtn = new TextRenderable(renderCtx, { content: "Confirm" });
   *     confirmBtn.on("mouseUp", () => resolve(true));
   *     buttons.add(cancelBtn);
   *     buttons.add(confirmBtn);
   *     box.add(buttons);
   *
   *     return box;
   *   }
   * });
   * ```
   */
  confirm(options: ConfirmOptions): Promise<boolean>;
  confirm(showFactory: (ctx: ConfirmContext) => AsyncShowOptions<boolean>): Promise<boolean>;
  /**
   * Show an alert dialog and wait for the user to dismiss it.
   *
   * Accepts either AlertOptions (for imperative usage) or a factory function
   * that receives the alert context and returns DialogShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * await manager.alert({
   *   content: (renderCtx, { dismiss }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "column" });
   *     const text = new TextRenderable(renderCtx, { content: "Operation complete!" });
   *     box.add(text);
   *
   *     const okBtn = new TextRenderable(renderCtx, { content: "OK" });
   *     okBtn.on("mouseUp", dismiss);
   *     box.add(okBtn);
   *
   *     return box;
   *   }
   * });
   * ```
   */
  alert(options: AlertOptions): Promise<void>;
  alert(showFactory: (ctx: AlertContext) => DialogShowOptions): Promise<void>;
  /**
   * Show a choice dialog and wait for the user to select an option.
   *
   * @template K The type of keys for the available choices.
   * @returns The selected key, or `undefined` if cancelled or dismissed.
   *
   * Accepts either ChoiceOptions (for imperative usage) or a factory function
   * that receives the choice context and returns AsyncShowOptions (for framework adapters).
   *
   * @example
   * ```ts
   * // Core/imperative usage
   * const action = await manager.choice<"save" | "discard">({
   *   content: (renderCtx, { resolve, dismiss }) => {
   *     const box = new BoxRenderable(renderCtx, { flexDirection: "column" });
   *     const title = new TextRenderable(renderCtx, { content: "Unsaved changes" });
   *     box.add(title);
   *
   *     const saveBtn = new TextRenderable(renderCtx, { content: "Save" });
   *     saveBtn.on("mouseUp", () => resolve("save"));
   *     const discardBtn = new TextRenderable(renderCtx, { content: "Discard" });
   *     discardBtn.on("mouseUp", () => resolve("discard"));
   *     const cancelBtn = new TextRenderable(renderCtx, { content: "Cancel" });
   *     cancelBtn.on("mouseUp", dismiss);
   *
   *     box.add(saveBtn);
   *     box.add(discardBtn);
   *     box.add(cancelBtn);
   *
   *     return box;
   *   }
   * });
   * ```
   */
  choice<K>(options: ChoiceOptions<K>): Promise<K | undefined>;
  choice<K>(showFactory: (ctx: ChoiceContext<K>) => AsyncShowOptions<K | undefined>): Promise<K | undefined>;
  /** Destroy the manager and clean up resources. */
  destroy(): void;
  get isDestroyed(): boolean;
}
//#endregion
//#region src/renderables/dialog.d.ts
interface DialogRenderableOptions {
  dialog: InternalDialog;
  containerOptions: DialogContainerOptions;
}
declare class DialogRenderable extends BoxRenderable {
  private _dialog;
  private _computedStyle;
  private _containerOptions;
  constructor(ctx: RenderContext, options: DialogRenderableOptions);
  private createContent;
  updateDimensions(width: number, _height?: number): void;
  get dialog(): InternalDialog;
}
//#endregion
//#region src/renderables/dialog-container.d.ts
interface DialogContainerRenderableOptions extends DialogContainerOptions {
  manager: DialogManager;
}
/**
 * Container that renders dialogs from a DialogManager.
 *
 * @example
 * ```ts
 * const manager = new DialogManager(renderer);
 * const container = new DialogContainerRenderable(ctx, { manager });
 * ctx.root.add(container);
 *
 * manager.show({ content: (ctx) => new TextRenderable(ctx, { content: "Hi" }) });
 * ```
 */
declare class DialogContainerRenderable extends BoxRenderable {
  private _manager;
  private _options;
  private _backdrop;
  private _dialogRenderables;
  private _unsubscribe;
  private _destroyed;
  constructor(ctx: RenderContext, options: DialogContainerRenderableOptions);
  private subscribe;
  /**
   * Handle keyboard events. Returns true if handled (e.g., ESC closed a dialog).
   */
  private handleKeyboard;
  private getTopDialogRenderable;
  getDialogRenderable(id: DialogId): DialogRenderable | undefined;
  getDialogRenderables(): Map<DialogId, DialogRenderable>;
  private addOrUpdateDialog;
  private removeDialog;
  updateDimensions(width: number, height?: number): void;
  set size(value: DialogSize);
  set dialogOptions(value: DialogOptions);
  set sizePresets(value: Partial<Record<DialogSize, number>>);
  set closeOnEscape(value: boolean);
  set closeOnClickOutside(value: boolean);
  set backdropColor(value: string);
  set backdropOpacity(value: number | string);
  private updateBackdropVisibility;
  private updateBackdropStyle;
  private handleBackdropClick;
  set unstyled(value: boolean);
  destroy(): void;
}
//#endregion
export { type AlertContext, type AlertOptions, type AsyncDialogOptions, type BaseAlertOptions, type BaseChoiceOptions, type BaseConfirmOptions, type BaseDialogActions, type BasePromptOptions, type ChoiceContext, type ChoiceOptions, type ConfirmContext, type ConfirmOptions, type Dialog, type DialogContainerOptions, DialogContainerRenderable, type DialogContentFactory, type DialogId, DialogManager, type DialogShowOptions, type DialogSize, type DialogState, type DialogStyle, type DialogTheme, type DialogToClose, type PromptContext, type PromptOptions, isDialogToClose, themes };