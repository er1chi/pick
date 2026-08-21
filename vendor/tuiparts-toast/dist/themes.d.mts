import { m as ToasterOptions } from "./types-DeXK0CHF.mjs";
//#region src/themes.d.ts
/**
 * A theme configuration for the toaster.
 * Extends ToasterOptions with metadata.
 */
interface ToasterTheme extends ToasterOptions {
  /** Human-readable name for the theme */
  name: string;
  /** Brief description of the theme */
  description: string;
}
/**
 * Minimal theme - clean and unobtrusive
 *
 * No borders, subtle styling. Perfect for apps where
 * toasts should be informative but not distracting.
 *
 * @example
 * ```ts
 * import { ToasterRenderable } from '@tuiparts/toast';
 * import { minimal } from '@tuiparts/toast/themes';
 *
 * const toaster = new ToasterRenderable(ctx, minimal);
 *
 * // Or customize it
 * const toaster = new ToasterRenderable(ctx, {
 *   ...minimal,
 *   position: 'top-center',
 *   stackingMode: 'stack',
 * });
 * ```
 */
declare const minimal: ToasterTheme;
/**
 * Monochrome theme - grayscale only
 *
 * No colors, just shades of gray. Useful for
 * accessibility or when color is not desired.
 *
 * @example
 * ```ts
 * import { ToasterRenderable } from '@tuiparts/toast';
 * import { monochrome } from '@tuiparts/toast/themes';
 *
 * const toaster = new ToasterRenderable(ctx, monochrome);
 * ```
 */
declare const monochrome: ToasterTheme;
/**
 * All available themes as a single object
 *
 * @example
 * ```ts
 * import { themes } from '@tuiparts/toast/themes';
 *
 * // Access themes by name
 * const toaster = new ToasterRenderable(ctx, themes.minimal);
 * ```
 */
declare const themes: {
  readonly minimal: ToasterTheme;
  readonly monochrome: ToasterTheme;
};
//#endregion
export { ToasterTheme, minimal, monochrome, themes };