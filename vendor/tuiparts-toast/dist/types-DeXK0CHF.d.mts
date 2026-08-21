import { BorderCharacters, BorderSides, BorderStyle } from "@opentui/core";
//#region src/types.d.ts
/**
 * Toast notification types
 */
type ToastType = "default" | "success" | "error" | "warning" | "info" | "loading";
/**
 * Position options for the toaster
 */
type Position = "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
/**
 * Stacking mode for multiple toasts
 */
type StackingMode = "single" | "stack";
/**
 * Action button configuration
 */
interface Action {
  label: string;
  onClick: () => void;
}
/**
 * Terminal-specific toast styling options
 *
 * These map to terminal box rendering properties and provide
 * intuitive shorthands for common patterns.
 */
interface ToastStyle {
  /**
   * Border configuration
   * - `true` = full border (all sides)
   * - `false` = no border
   * - `["left", "right"]` = specific sides only
   */
  border?: boolean | BorderSides[];
  /**
   * Border color (hex, rgb, or named color)
   */
  borderColor?: string;
  /**
   * Border style for terminal rendering
   * @default 'single'
   */
  borderStyle?: BorderStyle;
  /**
   * Custom border characters for full control over border rendering
   *
   * When provided, this overrides the borderStyle setting.
   * Use this to create unique border styles with custom characters.
   */
  customBorderChars?: BorderCharacters;
  /**
   * Minimum height in terminal rows
   */
  minHeight?: number;
  /**
   * Maximum width in terminal columns
   */
  maxWidth?: number;
  /**
   * Minimum width in terminal columns
   */
  minWidth?: number;
  /**
   * Uniform padding (all sides)
   */
  padding?: number;
  /**
   * Horizontal padding (left + right)
   */
  paddingX?: number;
  /**
   * Vertical padding (top + bottom)
   */
  paddingY?: number;
  /**
   * Top padding
   */
  paddingTop?: number;
  /**
   * Bottom padding
   */
  paddingBottom?: number;
  /**
   * Left padding
   */
  paddingLeft?: number;
  /**
   * Right padding
   */
  paddingRight?: number;
  /**
   * Background color (hex, rgb, or named color)
   */
  backgroundColor?: string;
  /**
   * Text/foreground color (hex, rgb, or named color)
   */
  foregroundColor?: string;
  /**
   * Muted text color (for descriptions)
   */
  mutedColor?: string;
  /**
   * Icon color override (defaults to borderColor)
   */
  iconColor?: string;
}
/**
 * Per-type toast options
 *
 * Each type can override style and duration.
 */
interface TypeToastOptions {
  /** Style overrides for this toast type */
  style?: Partial<ToastStyle>;
  /** Duration override for this toast type */
  duration?: number;
}
/**
 * Default options for all toasts, with per-type overrides
 *
 * Similar to react-hot-toast's toastOptions API:
 * @example
 * ```ts
 * toastOptions={{
 *   style: { backgroundColor: '#1a1a1a' },
 *   duration: 5000,
 *   success: {
 *     style: { borderColor: '#22c55e' },
 *     duration: 3000,
 *   },
 *   error: {
 *     style: { borderColor: '#ef4444' },
 *   },
 * }}
 * ```
 */
interface ToastOptions {
  /** Base styles applied to all toasts */
  style?: ToastStyle;
  /** Default duration for all toasts (ms) */
  duration?: number;
  /** Options for default toasts */
  default?: TypeToastOptions;
  /** Options for success toasts */
  success?: TypeToastOptions;
  /** Options for error toasts */
  error?: TypeToastOptions;
  /** Options for warning toasts */
  warning?: TypeToastOptions;
  /** Options for info toasts */
  info?: TypeToastOptions;
  /** Options for loading toasts */
  loading?: TypeToastOptions;
}
/**
 * Internal toast representation
 */
interface Toast {
  id: string | number;
  type: ToastType;
  title?: string | (() => string);
  description?: string | (() => string);
  duration?: number;
  dismissible?: boolean;
  icon?: string;
  action?: Action;
  onDismiss?: (toast: Toast) => void;
  onAutoClose?: (toast: Toast) => void;
  closeButton?: boolean;
  /**
   * Per-toast style overrides (highest priority)
   */
  style?: Partial<ToastStyle>;
}
/**
 * External toast options (user-facing API)
 *
 * This is the options object passed to `toast()`, `toast.success()`, etc.
 */
interface ExternalToast extends Partial<Omit<Toast, "id" | "type" | "title" | "promise">> {
  id?: string | number;
}
/**
 * Promise type for toast.promise()
 */
type PromiseT<Data = unknown> = Promise<Data> | (() => Promise<Data>);
/**
 * Extended result type for promise toasts
 */
interface PromiseExtendedResult extends ExternalToast {
  message: string;
}
/**
 * Promise result - can be a string or extended object
 */
type PromiseTResult<Data = unknown> = string | ((data: Data) => string | Promise<string>);
/**
 * Promise toast configuration
 */
interface PromiseData<ToastData = unknown> {
  loading?: string;
  success?: PromiseTResult<ToastData> | PromiseExtendedResult | ((data: ToastData) => PromiseExtendedResult | Promise<PromiseExtendedResult>);
  error?: PromiseTResult | PromiseExtendedResult | ((error: unknown) => PromiseExtendedResult | Promise<PromiseExtendedResult>);
  description?: PromiseTResult<ToastData>;
  finally?: () => void | Promise<void>;
}
/**
 * Spinner configuration for animated loading icons
 *
 * @example
 * ```ts
 * // Dots spinner
 * { frames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"], interval: 80 }
 *
 * // Simple spinner
 * { frames: ["-", "\\", "|", "/"], interval: 100 }
 * ```
 */
interface SpinnerConfig {
  /** Array of frames to cycle through */
  frames: string[];
  /** Interval between frames in milliseconds */
  interval: number;
}
/**
 * Check if a value is a SpinnerConfig object
 */
declare function isSpinnerConfig(value: string | SpinnerConfig): value is SpinnerConfig;
/**
 * Icon configuration
 */
interface ToastIcons {
  success: string;
  error: string;
  warning: string;
  info: string;
  /**
   * Loading icon - can be a static string or an animated spinner config
   *
   * @example
   * ```ts
   * // Static icon
   * loading: "◌"
   *
   * // Animated spinner
   * loading: {
   *   frames: ["◜", "◠", "◝", "◞", "◡", "◟"],
   *   interval: 100,
   * }
   * ```
   */
  loading: string | SpinnerConfig;
  close: string;
}
/**
 * Offset configuration for toaster positioning
 */
interface ToasterOffset {
  top?: number;
  right?: number;
  bottom?: number;
  left?: number;
}
/**
 * Toaster component options
 */
interface ToasterOptions {
  /**
   * Position of the toaster on screen
   * @default 'bottom-right'
   */
  position?: Position;
  /**
   * Gap between toasts in terminal rows
   * @default 1
   */
  gap?: number;
  /**
   * Maximum number of visible toasts in stack mode
   * @default 3
   */
  visibleToasts?: number;
  /**
   * Show close button on toasts
   * @default false
   */
  closeButton?: boolean;
  /**
   * Offset from screen edges
   */
  offset?: ToasterOffset;
  /**
   * Custom icons, or `false` to disable icons entirely
   *
   * @example
   * ```ts
   * // Custom icons
   * icons: { success: "✓", error: "✗" }
   *
   * // Disable icons
   * icons: false
   * ```
   */
  icons?: Partial<ToastIcons> | false;
  /**
   * How to handle multiple toasts
   * @default 'single'
   */
  stackingMode?: StackingMode;
  /**
   * Maximum width for toasts
   * @default 60
   */
  maxWidth?: number;
  /**
   * Default options for toasts (styles, duration, per-type overrides)
   *
   * @example
   * ```ts
   * toastOptions: {
   *   style: { backgroundColor: '#1a1a1a' },
   *   duration: 5000,
   *   success: {
   *     style: { borderColor: '#22c55e' },
   *     duration: 3000,
   *   },
   * }
   * ```
   */
  toastOptions?: ToastOptions;
}
/**
 * Check if an action object is a valid Action
 */
declare function isAction(action: Action | unknown): action is Action;
//#endregion
export { isSpinnerConfig as _, PromiseT as a, Toast as c, ToastStyle as d, ToastType as f, isAction as g, TypeToastOptions as h, PromiseData as i, ToastIcons as l, ToasterOptions as m, ExternalToast as n, SpinnerConfig as o, ToasterOffset as p, Position as r, StackingMode as s, Action as t, ToastOptions as u };