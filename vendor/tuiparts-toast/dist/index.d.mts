import { _ as isSpinnerConfig, d as ToastStyle, f as ToastType, g as isAction, h as TypeToastOptions, i as PromiseData, l as ToastIcons, m as ToasterOptions, n as ExternalToast, o as SpinnerConfig, p as ToasterOffset, r as Position, s as StackingMode, t as Action, u as ToastOptions } from "./types-DeXK0CHF.mjs";
import { ASCII_ICONS, DEFAULT_ICONS, EMOJI_ICONS, MINIMAL_ICONS } from "./icons.mjs";
import { n as ToasterRenderable, t as toast } from "./state-CVohZuAG.mjs";
//#region src/constants.d.ts
/**
 * Common toast duration presets (in milliseconds)
 *
 * Use these for consistent, readable duration values across your app.
 *
 * | Preset       | Duration   | Use Case                  |
 * |--------------|------------|---------------------------|
 * | `SHORT`      | 2000ms     | Brief confirmations       |
 * | `DEFAULT`    | 4000ms     | Standard notifications    |
 * | `LONG`       | 6000ms     | Important messages        |
 * | `EXTENDED`   | 10000ms    | Critical information      |
 * | `PERSISTENT` | Infinity   | Requires manual dismissal |
 *
 * @example
 * ```ts
 * import { toast, TOAST_DURATION } from '@tuiparts/toast';
 *
 * // Quick confirmation
 * toast.success('Copied!', { duration: TOAST_DURATION.SHORT });
 *
 * // Important warning
 * toast.warning('Check your settings', { duration: TOAST_DURATION.LONG });
 *
 * // Critical error that requires acknowledgment
 * toast.error('Connection lost', { duration: TOAST_DURATION.PERSISTENT });
 *
 * // Set as default for all toasts
 * const toaster = new ToasterRenderable(ctx, {
 *   toastOptions: { duration: TOAST_DURATION.LONG },
 * });
 * ```
 */
declare const TOAST_DURATION: {
  /** 2 seconds - for brief confirmations */
  readonly SHORT: 2000;
  /** 4 seconds - default duration */
  readonly DEFAULT: 4000;
  /** 6 seconds - for important messages */
  readonly LONG: 6000;
  /** 10 seconds - for critical information */
  readonly EXTENDED: 10000;
  /** Never auto-dismiss - requires manual dismissal */
  readonly PERSISTENT: number;
};
//#endregion
export { ASCII_ICONS, type Action, DEFAULT_ICONS, EMOJI_ICONS, type ExternalToast, MINIMAL_ICONS, type Position, type PromiseData, type SpinnerConfig, type StackingMode, TOAST_DURATION, type ToastIcons, type ToastOptions, type ToastStyle, type ToastType, type ToasterOffset, type ToasterOptions, ToasterRenderable, type TypeToastOptions, isAction, isSpinnerConfig, toast };