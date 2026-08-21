import { BorderStyle, RenderContext, Renderable } from "@opentui/core";
//#region src/constants.d.ts
/** @internal Used by React/Solid bindings for JSX portals */
declare const JSX_CONTENT_KEY: unique symbol;
//#endregion
//#region src/types.d.ts
type DialogId = string | number;
type DialogSize = "small" | "medium" | "large" | "full";
interface DialogStyle {
  backgroundColor?: string;
  borderColor?: string;
  borderStyle?: BorderStyle;
  border?: boolean;
  width?: number | string;
  maxWidth?: number;
  minWidth?: number;
  maxHeight?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
}
/** Factory function that creates dialog content from a RenderContext. */
type DialogContentFactory = (ctx: RenderContext) => Renderable;
interface Dialog {
  id: DialogId;
  content: DialogContentFactory;
  size?: DialogSize;
  style?: DialogStyle;
  unstyled?: boolean;
  /** @default true */
  closeOnEscape?: boolean;
  /** @default false */
  closeOnClickOutside?: boolean;
  /** Per-dialog backdrop color override. */
  backdropColor?: string;
  /** Per-dialog backdrop opacity override. 0-1 (number) or "50%" (string). */
  backdropOpacity?: number | string;
  onClose?: () => void;
  onOpen?: () => void;
  onBackdropClick?: () => void;
}
/**
 * Internal dialog type with adapter-specific properties.
 * Used by React for deferred visibility.
 * @internal
 */
interface InternalDialog extends Dialog {
  /** @internal Used by React/Solid bindings to store JSX portal content. */
  [JSX_CONTENT_KEY]?: unknown;
  /**
   * When true, the dialog is initially hidden until visibility is updated.
   * Used by adapter(s) to prevent flicker when JSX content is
   * injected via portals after the dialog renderable is created.
   */
  deferred?: boolean;
}
interface DialogToClose {
  id: DialogId;
  close: true;
}
interface DialogShowOptions extends Omit<Dialog, "id"> {
  id?: DialogId;
}
interface DialogOptions {
  style?: DialogStyle;
}
interface DialogContainerOptions {
  /** @default "medium" */
  size?: DialogSize;
  dialogOptions?: DialogOptions;
  sizePresets?: Partial<Record<DialogSize, number>>;
  /** @default true */
  closeOnEscape?: boolean;
  /** @default false */
  closeOnClickOutside?: boolean;
  /** @default "#000000" */
  backdropColor?: string;
  /** 0-1 (number) or "50%" (string). @default 0.35 */
  backdropOpacity?: number | string;
  unstyled?: boolean;
}
/**
 * Base options for async dialog methods (prompt, confirm, alert, choice).
 * Excludes `content` (replaced by context-specific content) and `id` (auto-generated).
 * Note: `onClose` is supported - it will be called before the Promise resolves.
 */
interface AsyncDialogOptions extends Omit<DialogShowOptions, "content" | "id"> {}
/**
 * Generic base for prompt dialog options.
 * @template T The type of value the prompt resolves to.
 * @template TContent The content type (varies by adapter).
 */
interface BasePromptOptions<T, TContent> extends AsyncDialogOptions {
  /** Content factory that receives the prompt context. */
  content: TContent;
  /** Fallback value when dialog is dismissed via ESC or backdrop click. */
  fallback?: T;
}
/**
 * Generic base for confirm dialog options.
 * @template TContent The content type (varies by adapter).
 */
interface BaseConfirmOptions<TContent> extends AsyncDialogOptions {
  /** Content factory that receives the confirm context. */
  content: TContent;
  /** Fallback value when dialog is dismissed via ESC or backdrop click. @default false */
  fallback?: boolean;
}
/**
 * Generic base for alert dialog options.
 * @template TContent The content type (varies by adapter).
 */
interface BaseAlertOptions<TContent> extends AsyncDialogOptions {
  /** Content factory that receives the alert context. */
  content: TContent;
}
/**
 * Generic base for choice dialog options.
 * @template TContent The content type (varies by adapter).
 * @template K The type of keys for the available choices.
 */
interface BaseChoiceOptions<TContent, K = unknown> extends AsyncDialogOptions {
  /** Content factory that receives the choice context. */
  content: TContent;
  /** Fallback value when dialog is dismissed via ESC or backdrop click. @default undefined */
  fallback?: K;
}
/**
 * Base interface for dialog actions returned by useDialog() hooks.
 * Contains the non-generic methods shared by all framework adapters.
 * Framework adapters extend this and add the generic prompt/confirm/alert/choice methods.
 * @template TShowOptions Options for show/replace methods.
 */
interface BaseDialogActions<TShowOptions> {
  /** Show a new dialog and return its ID. */
  show: (options: TShowOptions) => DialogId;
  /** Close a specific dialog by ID, or the top-most dialog if no ID provided. */
  close: (id?: DialogId) => DialogId | undefined;
  /** Close all open dialogs. */
  closeAll: () => void;
  /** Close all dialogs and show a new one. */
  replace: (options: TShowOptions) => DialogId;
}
declare function isDialogToClose(value: Dialog | DialogToClose): value is DialogToClose;
//#endregion
//#region src/themes.d.ts
interface DialogTheme extends Omit<DialogContainerOptions, "manager"> {
  name: string;
  description: string;
}
declare const DEFAULT_BACKDROP_OPACITY = 89;
declare const DEFAULT_BACKDROP_COLOR = "#000000";
declare const DEFAULT_STYLE: DialogStyle;
declare const DEFAULT_PADDING: {
  top: number;
  right: number;
  bottom: number;
  left: number;
};
declare const minimal: DialogTheme;
declare const unstyled: DialogTheme;
declare const themes: {
  readonly minimal: DialogTheme;
  readonly unstyled: DialogTheme;
};
//#endregion
export { DialogToClose as C, DialogStyle as S, isDialogToClose as T, DialogContentFactory as _, DialogTheme as a, DialogShowOptions as b, unstyled as c, BaseChoiceOptions as d, BaseConfirmOptions as f, DialogContainerOptions as g, Dialog as h, DEFAULT_STYLE as i, AsyncDialogOptions as l, BasePromptOptions as m, DEFAULT_BACKDROP_OPACITY as n, minimal as o, BaseDialogActions as p, DEFAULT_PADDING as r, themes as s, DEFAULT_BACKDROP_COLOR as t, BaseAlertOptions as u, DialogId as v, InternalDialog as w, DialogSize as x, DialogOptions as y };