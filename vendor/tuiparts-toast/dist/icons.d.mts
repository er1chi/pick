import { f as ToastType, l as ToastIcons, o as SpinnerConfig } from "./types-DeXK0CHF.mjs";
//#region src/icons.d.ts
/**
 * Default spinner configuration for loading toasts
 *
 * Uses a circular animation pattern. Override this by providing
 * a custom `loading` value in the `icons` option.
 *
 * @example
 * ```ts
 * // Use a different spinner pattern
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: {
 *     ...DEFAULT_ICONS,
 *     loading: {
 *       frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
 *       interval: 80,
 *     },
 *   },
 * });
 * ```
 */
declare const DEFAULT_SPINNER: SpinnerConfig;
/**
 * Default Unicode icons for toast notifications
 *
 * These work in most modern terminals. Use these as the base
 * and override specific icons as needed.
 *
 * @example
 * ```ts
 * import { DEFAULT_ICONS, ToasterRenderable } from '@tuiparts/toast';
 *
 * // Use defaults with a custom success icon
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: { ...DEFAULT_ICONS, success: '++' },
 * });
 * ```
 */
declare const DEFAULT_ICONS: ToastIcons;
/**
 * ASCII-only icons for terminals with limited Unicode support
 *
 * Use these when targeting older terminals or environments
 * where Unicode characters may not render correctly.
 *
 * @example
 * ```ts
 * import { ASCII_ICONS, ToasterRenderable } from '@tuiparts/toast';
 *
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: ASCII_ICONS,
 * });
 * ```
 */
declare const ASCII_ICONS: ToastIcons;
/**
 * Minimal icons using simple single characters
 *
 * Perfect for clean, unobtrusive toast notifications.
 * Pairs well with the `minimal` theme.
 *
 * @example
 * ```ts
 * import { MINIMAL_ICONS, ToasterRenderable } from '@tuiparts/toast';
 * import { minimal } from '@tuiparts/toast/themes';
 *
 * const toaster = new ToasterRenderable(ctx, {
 *   ...minimal,
 *   icons: MINIMAL_ICONS,
 * });
 * ```
 */
declare const MINIMAL_ICONS: ToastIcons;
/**
 * Emoji icons for terminals with good emoji support
 *
 * Note: Emoji rendering varies across terminals. Test in your
 * target environment before using in production.
 *
 * @example
 * ```ts
 * import { EMOJI_ICONS, ToasterRenderable } from '@tuiparts/toast';
 *
 * const toaster = new ToasterRenderable(ctx, {
 *   icons: EMOJI_ICONS,
 * });
 * ```
 */
declare const EMOJI_ICONS: ToastIcons;
/**
 * Get the icon string for a specific toast type
 *
 * For loading type, returns the first frame if it's a SpinnerConfig,
 * or the static string otherwise.
 *
 * @internal - Used by ToastRenderable, not part of public API
 */
declare function getTypeIcon(type: ToastType, icons: ToastIcons): string;
/**
 * Get the initial loading icon (first frame if spinner, or static string)
 *
 * @internal
 */
declare function getLoadingIcon(loading: string | SpinnerConfig): string;
/**
 * Get the spinner config if loading is animated, or null if static
 *
 * @internal
 */
declare function getSpinnerConfig(loading: string | SpinnerConfig): SpinnerConfig | null;
//#endregion
export { ASCII_ICONS, DEFAULT_ICONS, DEFAULT_SPINNER, EMOJI_ICONS, MINIMAL_ICONS, getLoadingIcon, getSpinnerConfig, getTypeIcon };