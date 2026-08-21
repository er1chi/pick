//#region src/types.ts
/**
* Check if a value is a SpinnerConfig object
*/
function isSpinnerConfig(value) {
	return typeof value === "object" && value !== null && "frames" in value && "interval" in value && Array.isArray(value.frames);
}
/**
* Check if an action object is a valid Action
*/
function isAction(action) {
	return typeof action === "object" && action !== null && "label" in action && "onClick" in action;
}
//#endregion
//#region src/icons.ts
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
const DEFAULT_SPINNER = {
	frames: [
		"◜",
		"◠",
		"◝",
		"◞",
		"◡",
		"◟"
	],
	interval: 100
};
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
const DEFAULT_ICONS = {
	success: "✓",
	error: "✗",
	warning: "!",
	info: "ℹ",
	loading: DEFAULT_SPINNER,
	close: "×"
};
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
const ASCII_ICONS = {
	success: "[/]",
	error: "[x]",
	warning: "[!]",
	info: "[i]",
	loading: "...",
	close: "x"
};
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
const MINIMAL_ICONS = {
	success: "*",
	error: "!",
	warning: "!",
	info: "i",
	loading: "~",
	close: "x"
};
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
const EMOJI_ICONS = {
	success: "✅",
	error: "❌",
	warning: "⚠️",
	info: "ℹ️",
	loading: "⏳",
	close: "✖️"
};
/**
* Get the icon string for a specific toast type
*
* For loading type, returns the first frame if it's a SpinnerConfig,
* or the static string otherwise.
*
* @internal - Used by ToastRenderable, not part of public API
*/
function getTypeIcon(type, icons) {
	switch (type) {
		case "success": return icons.success;
		case "error": return icons.error;
		case "warning": return icons.warning;
		case "info": return icons.info;
		case "loading": return getLoadingIcon(icons.loading);
		default: return "";
	}
}
/**
* Get the initial loading icon (first frame if spinner, or static string)
*
* @internal
*/
function getLoadingIcon(loading) {
	if (isSpinnerConfig(loading)) return loading.frames[0] ?? "◌";
	return loading;
}
/**
* Get the spinner config if loading is animated, or null if static
*
* @internal
*/
function getSpinnerConfig(loading) {
	return isSpinnerConfig(loading) ? loading : null;
}
//#endregion
export { MINIMAL_ICONS as a, getTypeIcon as c, EMOJI_ICONS as i, isAction as l, DEFAULT_ICONS as n, getLoadingIcon as o, DEFAULT_SPINNER as r, getSpinnerConfig as s, ASCII_ICONS as t, isSpinnerConfig as u };
