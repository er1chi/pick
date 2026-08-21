import { a as PromiseT, c as Toast, i as PromiseData, l as ToastIcons, m as ToasterOptions, n as ExternalToast, p as ToasterOffset, s as StackingMode, u as ToastOptions } from "./types-DeXK0CHF.mjs";
import { BoxRenderable, RenderContext } from "@opentui/core";
//#region src/renderables/toaster.d.ts
/**
 * ToasterRenderable - Container for toast notifications
 *
 * Features:
 * - Subscribes to ToastState for automatic toast management
 * - Supports 6 position variants (top/bottom + left/center/right)
 * - Single or stack mode for multiple toasts
 * - Configurable visible toast limit in stack mode
 * - Automatic oldest toast removal when limit exceeded
 *
 * @example
 * ```ts
 * import { ToasterRenderable, toast } from '@tuiparts/toast';
 *
 * // Basic usage - add to your app once
 * const toaster = new ToasterRenderable(ctx);
 * ctx.root.add(toaster);
 *
 * // Then show toasts from anywhere
 * toast.success('Hello World!');
 * ```
 *
 * @example
 * ```ts
 * // With full configuration
 * const toaster = new ToasterRenderable(ctx, {
 *   position: 'top-right',
 *   stackingMode: 'stack',
 *   visibleToasts: 5,
 *   closeButton: true,
 *   gap: 1,
 *   toastOptions: {
 *     style: { backgroundColor: '#1a1a1a' },
 *     duration: 5000,
 *     success: { style: { borderColor: '#22c55e' } },
 *     error: { style: { borderColor: '#ef4444' } },
 *   },
 * });
 * ```
 *
 * @example
 * ```ts
 * // With a theme preset
 * import { minimal } from '@tuiparts/toast/themes';
 *
 * const toaster = new ToasterRenderable(ctx, {
 *   ...minimal,
 *   position: 'bottom-center',
 * });
 * ```
 */
declare class ToasterRenderable extends BoxRenderable {
  private _options;
  private _toastRenderables;
  private _unsubscribe;
  constructor(ctx: RenderContext, options?: ToasterOptions);
  /**
   * Apply layout-related options to the renderable
   */
  private applyLayoutOptions;
  private isToastPosition;
  set position(value: unknown);
  set offset(value: ToasterOffset);
  set gap(value: number);
  set visibleToasts(value: number);
  set closeButton(value: boolean);
  set icons(value: Partial<ToastIcons> | false);
  set stackingMode(value: StackingMode);
  set maxWidth(value: number);
  set toastOptions(value: ToastOptions);
  /**
   * Subscribe to toast state changes
   */
  private subscribe;
  /**
   * Add a new toast or update an existing one
   */
  private addOrUpdateToast;
  /**
   * Remove a toast by ID
   */
  private removeToast;
  /**
   * Handle when a toast is fully removed
   */
  private handleToastRemoved;
  /**
   * Get the current number of visible toasts
   *
   * @example
   * ```ts
   * if (toaster.toastCount > 0) {
   *   console.log(`Showing ${toaster.toastCount} notifications`);
   * }
   * ```
   */
  get toastCount(): number;
  /**
   * Dismiss all toasts managed by this toaster
   *
   * @example
   * ```ts
   * // Clear all notifications
   * toaster.dismissAll();
   * ```
   */
  dismissAll(): void;
  /**
   * Clean up on destroy
   */
  destroy(): void;
}
//#endregion
//#region src/state.d.ts
type TitleT = string | (() => string);
/**
 * The main toast API - a function with methods attached
 *
 * @example
 * ```ts
 * // Basic usage
 * toast('Hello World');
 *
 * // With variants
 * toast.success('Operation completed');
 * toast.error('Something went wrong');
 * toast.warning('Be careful');
 * toast.info('Did you know?');
 * toast.loading('Processing...');
 *
 * // Promise toast
 * toast.promise(fetchData(), {
 *   loading: 'Loading...',
 *   success: 'Data loaded!',
 *   error: 'Failed to load',
 * });
 *
 * // Dismiss
 * const id = toast('Hello');
 * toast.dismiss(id);
 * toast.dismiss(); // dismiss all
 * ```
 */
declare const toast: ((message: TitleT, data?: ExternalToast) => string | number) & {
  success: (message: TitleT, data?: ExternalToast) => string | number;
  info: (message: TitleT, data?: ExternalToast) => string | number;
  warning: (message: TitleT, data?: ExternalToast) => string | number;
  error: (message: TitleT, data?: ExternalToast) => string | number;
  message: (message: TitleT, data?: ExternalToast) => string | number;
  promise: <ToastData>(promise: PromiseT<ToastData>, data?: PromiseData<ToastData> | undefined) => {
    unwrap: () => Promise<ToastData>;
  } | undefined;
  dismiss: (id?: string | number) => string | number | undefined;
  loading: (message: TitleT, data?: ExternalToast) => string | number;
} & {
  getHistory: () => Toast[];
  getToasts: () => Toast[];
};
//#endregion
export { ToasterRenderable as n, toast as t };