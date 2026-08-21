import { DEFAULT_PADDING, DEFAULT_STYLE } from "./themes.mjs";
import { BoxRenderable, parseColor } from "@opentui/core";
//#region src/manager.ts
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
var DialogManager = class {
	dialogs = [];
	subscribers = /* @__PURE__ */ new Set();
	idCounter = 1;
	savedFocus = null;
	ctx;
	focusRestoreTimeout;
	destroyed = false;
	constructor(ctx) {
		this.ctx = ctx;
	}
	saveFocus() {
		this.cancelPendingFocusRestore();
		this.savedFocus = this.ctx.currentFocusedRenderable;
		this.savedFocus?.blur();
	}
	cancelPendingFocusRestore() {
		if (this.focusRestoreTimeout) {
			clearTimeout(this.focusRestoreTimeout);
			this.focusRestoreTimeout = void 0;
		}
	}
	restoreFocus() {
		this.cancelPendingFocusRestore();
		if (this.savedFocus && !this.savedFocus.isDestroyed) this.focusRestoreTimeout = setTimeout(() => {
			if (!this.destroyed && this.savedFocus && !this.savedFocus.isDestroyed) this.savedFocus.focus();
			this.savedFocus = null;
			this.focusRestoreTimeout = void 0;
		}, 1);
		else this.savedFocus = null;
	}
	/** Subscribe to dialog state changes. Returns an unsubscribe function. */
	subscribe(subscriber) {
		this.subscribers.add(subscriber);
		return () => {
			this.subscribers.delete(subscriber);
		};
	}
	publish(data) {
		for (const subscriber of this.subscribers) try {
			subscriber(data);
		} catch (error) {
			console.error("[@tuiparts/dialog] Subscriber threw an error:", error);
		}
	}
	addDialog(data) {
		this.dialogs = [...this.dialogs, data];
		this.publish(data);
	}
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
	show(options) {
		if (this.destroyed) throw new Error("[@tuiparts/dialog] Cannot show dialog: DialogManager has been destroyed.");
		if (options.content === void 0 || options.content === null) throw new Error("[@tuiparts/dialog] Missing required 'content' property.\n\nThe 'content' property must be a factory function that returns a Renderable:\n\n  manager.show({\n    content: (ctx) => new TextRenderable(ctx, { content: \"Hello\" }),\n  });\n\nFor React, use: import { useDialog } from '@tuiparts/dialog/react'\nFor Solid, use: import { useDialog } from '@tuiparts/dialog/solid'");
		if (typeof options.content !== "function") throw new Error(`[@tuiparts/dialog] Invalid 'content' type: expected function, got ${typeof options.content}.\n\nThe 'content' property must be a factory function that receives a RenderContext\nand returns a Renderable:\n\n  manager.show({\n    content: (ctx) => new TextRenderable(ctx, { content: "Hello" }),\n  });\n\nIf you're using React or Solid, make sure you're importing from\nthe correct entry point:\n  - React: import { useDialog } from '@tuiparts/dialog/react'\n  - Solid: import { useDialog } from '@tuiparts/dialog/solid'`);
		const id = options.id !== void 0 && options.id !== null ? options.id : this.idCounter++;
		const existingIndex = this.dialogs.findIndex((d) => d.id === id);
		if (existingIndex !== -1) {
			const existing = this.dialogs[existingIndex];
			if (existing) {
				const updated = {
					...existing,
					...options,
					id
				};
				this.dialogs = [
					...this.dialogs.slice(0, existingIndex),
					updated,
					...this.dialogs.slice(existingIndex + 1)
				];
				this.publish(updated);
			}
		} else {
			if (this.dialogs.length === 0) this.saveFocus();
			const dialog = {
				...options,
				id
			};
			this.addDialog(dialog);
			dialog.onOpen?.();
		}
		return id;
	}
	/** Close a dialog by ID, or the top-most dialog if no ID provided. */
	close(id) {
		let targetId;
		if (id !== void 0) targetId = id;
		else targetId = this.dialogs[this.dialogs.length - 1]?.id;
		if (targetId === void 0) return;
		const dialogIndex = this.dialogs.findIndex((d) => d.id === targetId);
		if (dialogIndex === -1) return;
		const dialog = this.dialogs[dialogIndex];
		this.dialogs = [...this.dialogs.slice(0, dialogIndex), ...this.dialogs.slice(dialogIndex + 1)];
		this.publish({
			id: targetId,
			close: true
		});
		dialog?.onClose?.();
		if (this.dialogs.length === 0) this.restoreFocus();
		return targetId;
	}
	/** Close all open dialogs. */
	closeAll() {
		const dialogsToClose = [...this.dialogs].reverse();
		for (const d of dialogsToClose) this.close(d.id);
	}
	/** Close all dialogs and show a new one. */
	replace(options) {
		this.closeAll();
		return this.show(options);
	}
	/**
	* Get all active dialogs (oldest first).
	*
	* Returns a stable reference that only changes when dialogs are
	* added/removed/updated.
	*/
	getDialogs() {
		return this.dialogs;
	}
	/** Get the top-most active dialog. */
	getTopDialog() {
		if (this.dialogs.length === 0) return;
		return this.dialogs[this.dialogs.length - 1];
	}
	/** Check if any dialogs are open. */
	isOpen() {
		return this.dialogs.length > 0;
	}
	/**
	* Builds DialogShowOptions from either a factory function or a CoreOptions object.
	*/
	buildShowOptions(input, ctx) {
		if (typeof input === "function") return input(ctx);
		const { content, ...rest } = input;
		return {
			...rest,
			content: (renderCtx) => content(renderCtx, ctx)
		};
	}
	/**
	* Internal helper that handles common async dialog logic:
	* - Promise creation
	* - Safe double-resolve protection
	* - Dialog show/close lifecycle
	* - Fallback value handling for ESC/backdrop dismissal
	*/
	showAsyncDialog(createContextAndOptions, defaultDismissValue) {
		return new Promise((resolve) => {
			let resolved = false;
			const dialogId = this.idCounter++;
			const safeResolve = (value) => {
				if (resolved) return;
				resolved = true;
				resolve(value);
				this.close(dialogId);
			};
			const { showOptions, fallback } = createContextAndOptions(safeResolve, dialogId);
			this.show({
				...showOptions,
				id: dialogId,
				onClose: () => {
					showOptions.onClose?.();
					safeResolve(fallback ?? defaultDismissValue);
				}
			});
		});
	}
	prompt(input) {
		return this.showAsyncDialog((safeResolve, dialogId) => {
			const ctx = {
				resolve: safeResolve,
				dismiss: () => safeResolve(void 0),
				dialogId
			};
			if (typeof input === "function") {
				const result = input(ctx);
				return {
					showOptions: result,
					fallback: result.fallback
				};
			}
			const { fallback, ...rest } = input;
			return {
				showOptions: this.buildShowOptions(rest, ctx),
				fallback
			};
		}, void 0);
	}
	confirm(input) {
		return this.showAsyncDialog((safeResolve, dialogId) => {
			const ctx = {
				resolve: safeResolve,
				dismiss: () => safeResolve(false),
				dialogId
			};
			if (typeof input === "function") {
				const result = input(ctx);
				return {
					showOptions: result,
					fallback: result.fallback
				};
			}
			const { fallback, ...rest } = input;
			return {
				showOptions: this.buildShowOptions(rest, ctx),
				fallback
			};
		}, false);
	}
	alert(input) {
		return this.showAsyncDialog((safeResolve, dialogId) => {
			const ctx = {
				dismiss: safeResolve,
				dialogId
			};
			return { showOptions: this.buildShowOptions(input, ctx) };
		}, void 0);
	}
	choice(input) {
		return this.showAsyncDialog((safeResolve, dialogId) => {
			const ctx = {
				resolve: safeResolve,
				dismiss: () => safeResolve(void 0),
				dialogId
			};
			if (typeof input === "function") {
				const result = input(ctx);
				return {
					showOptions: result,
					fallback: result.fallback
				};
			}
			const { fallback, ...rest } = input;
			return {
				showOptions: this.buildShowOptions(rest, ctx),
				fallback
			};
		}, void 0);
	}
	/** Destroy the manager and clean up resources. */
	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.cancelPendingFocusRestore();
		this.savedFocus = null;
		this.subscribers.clear();
		this.dialogs = [];
	}
	get isDestroyed() {
		return this.destroyed;
	}
};
/**
* Normalize opacity to 0-255 integer range using CSS-like semantics.
*
* Accepts the following formats (aligned with CSS opacity behavior):
* - **0-1 (number)**: Float value where 0 = transparent, 1 = opaque
* - **"50%" (string)**: Percentage string where "0%" = transparent, "100%" = opaque
*
* Values are clamped to valid ranges automatically.
*
* @param value - The opacity value to normalize
* @param defaultValue - Default value if undefined (defaults to DEFAULT_OPACITY)
* @returns Normalized opacity as integer 0-255
*
* @example
* ```ts
* normalizeOpacity(0.5);       // 128 (50% opacity)
* normalizeOpacity(1);         // 255 (fully opaque)
* normalizeOpacity(0);         // 0 (fully transparent)
* normalizeOpacity("50%");     // 128 (50% opacity)
* normalizeOpacity("100%");    // 255 (fully opaque)
* normalizeOpacity(undefined); // DEFAULT_OPACITY (~60%)
* ```
*
* @throws {Error} If value is a number outside 0-1 range
*/
function normalizeOpacity(value, defaultValue = 255, caller = "@tuiparts/utils") {
	if (value === void 0) return defaultValue;
	if (typeof value === "string") {
		if (value.endsWith("%")) {
			const percent = parseFloat(value);
			if (!Number.isNaN(percent)) return Math.round(Math.min(100, Math.max(0, percent)) / 100 * 255);
		}
		const parsed = parseFloat(value);
		if (!Number.isNaN(parsed)) {
			if (parsed < 0 || parsed > 1) throw new Error(`[${caller}] Invalid opacity value "${value}". Numeric opacity must be between 0 and 1, or use a percentage string like "50%".`);
			return Math.round(parsed * 255);
		}
		console.warn(`[${caller}] Invalid opacity string "${value}", using default. Use a number (0-1) or percentage string ("50%").`);
		return defaultValue;
	}
	if (typeof value === "number") {
		if (value < 0 || value > 1) throw new Error(`[${caller}] Invalid opacity value ${value}. Opacity must be between 0 and 1 (CSS-like), where 0 = transparent and 1 = opaque. For percentage, use a string like "50%".`);
		return Math.round(value * 255);
	}
	return defaultValue;
}
//#endregion
//#region ../utils/src/utils/padding.ts
/**
* Resolve padding values with shorthand support
*
* Priority (highest to lowest):
* 1. Specific side (paddingTop, paddingRight, etc.)
* 2. Axis (paddingX, paddingY)
* 3. Uniform (padding)
* 4. Default values
*
* @param style - Style object containing padding properties
* @param defaults - Default padding values (defaults to 0 for all sides)
* @returns Resolved padding for each side
*
* @example
* ```ts
* resolvePadding({ padding: 1 })
* // => { top: 1, right: 1, bottom: 1, left: 1 }
*
* resolvePadding({ paddingX: 2, paddingY: 1 })
* // => { top: 1, right: 2, bottom: 1, left: 2 }
*
* resolvePadding({ padding: 1, paddingLeft: 3 })
* // => { top: 1, right: 1, bottom: 1, left: 3 }
*
* resolvePadding({ paddingTop: 2 }, { top: 0, right: 1, bottom: 0, left: 1 })
* // => { top: 2, right: 1, bottom: 0, left: 1 }
* ```
*/
function resolvePadding(style, defaults = {
	top: 0,
	right: 0,
	bottom: 0,
	left: 0
}) {
	if (!style) return { ...defaults };
	const uniform = style.padding;
	const axisX = style.paddingX;
	const axisY = style.paddingY;
	return {
		top: style.paddingTop ?? axisY ?? uniform ?? defaults.top,
		right: style.paddingRight ?? axisX ?? uniform ?? defaults.right,
		bottom: style.paddingBottom ?? axisY ?? uniform ?? defaults.bottom,
		left: style.paddingLeft ?? axisX ?? uniform ?? defaults.left
	};
}
//#endregion
//#region ../utils/src/utils/styles.ts
/**
* Style merging utilities
*
* Provides helpers for combining style objects with proper precedence.
*/
/**
* Merge multiple style objects (later wins)
*
* Uses shallow Object.assign, so later styles completely
* override earlier values for the same property.
*
* @param styles - Style objects to merge (undefined values are skipped)
* @returns Merged style object
*
* @example
* ```ts
* mergeStyles(
*   { borderColor: "red", padding: 1 },
*   { borderColor: "blue" }
* )
* // => { borderColor: "blue", padding: 1 }
*
* mergeStyles(
*   { padding: 1 },
*   undefined,
*   { paddingLeft: 2 }
* )
* // => { padding: 1, paddingLeft: 2 }
* ```
*/
function mergeStyles(...styles) {
	const result = {};
	for (const style of styles) {
		if (!style) continue;
		Object.assign(result, style);
	}
	return result;
}
//#endregion
//#region src/renderables/backdrop.ts
var BackdropRenderable = class BackdropRenderable extends BoxRenderable {
	_containerOptions;
	constructor(ctx, options) {
		super(ctx, {
			id: "dialog-backdrop",
			position: "absolute",
			left: 0,
			top: 0,
			width: ctx.width,
			height: ctx.height,
			backgroundColor: BackdropRenderable.computeColor(void 0, options.containerOptions),
			visible: false,
			onMouseUp: options.onClick
		});
		this._containerOptions = options.containerOptions;
	}
	updateStyle(dialog) {
		this.backgroundColor = BackdropRenderable.computeColor(dialog, this._containerOptions);
	}
	updateDimensions(width, height) {
		this.width = width;
		this.height = height;
	}
	updateContainerOptions(options) {
		this._containerOptions = options;
	}
	static computeColor(dialog, containerOptions) {
		const color = dialog?.backdropColor ?? containerOptions.backdropColor ?? "#000000";
		const opacity = normalizeOpacity(dialog?.backdropOpacity ?? containerOptions.backdropOpacity, 89, "@tuiparts/dialog");
		const rgba = parseColor(color);
		rgba.a = opacity / 255;
		return rgba;
	}
};
const DEFAULT_SIZES = {
	small: 40,
	medium: 60,
	large: 80,
	full: -1
};
const DIALOG_Z_INDEX = 9998;
/** @internal Used by React/Solid bindings for JSX portals */
const JSX_CONTENT_KEY = Symbol("dialog-jsx-content");
//#endregion
//#region src/utils/style.ts
function computeDialogStyle(input) {
	const { dialog, containerOptions } = input;
	const isUnstyled = dialog.unstyled ?? containerOptions?.unstyled ?? false;
	const computed = mergeStyles(isUnstyled ? {} : DEFAULT_STYLE, containerOptions?.dialogOptions?.style, dialog.style);
	const resolvedPadding = isUnstyled ? {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	} : resolvePadding(computed, isUnstyled ? {
		top: 0,
		right: 0,
		bottom: 0,
		left: 0
	} : DEFAULT_PADDING);
	return {
		...computed,
		resolvedPadding
	};
}
function getDialogWidth(size, containerOptions, terminalWidth) {
	const effectiveSize = size ?? containerOptions?.size ?? "medium";
	const customWidth = containerOptions?.sizePresets?.[effectiveSize];
	if (customWidth !== void 0 && customWidth > 0) return customWidth;
	const defaultWidth = DEFAULT_SIZES[effectiveSize];
	if (defaultWidth === -1) return terminalWidth ? terminalWidth - 4 : 80;
	return defaultWidth;
}
//#endregion
//#region src/renderables/dialog.ts
var DialogRenderable = class extends BoxRenderable {
	_dialog;
	_computedStyle;
	_containerOptions;
	constructor(ctx, options) {
		const { dialog, containerOptions } = options;
		const isDeferred = dialog.deferred === true;
		const computedStyle = computeDialogStyle({
			dialog,
			containerOptions
		});
		const dialogWidth = getDialogWidth(dialog.size, containerOptions, ctx.width);
		const padding = computedStyle.resolvedPadding;
		const panelWidth = typeof computedStyle.width === "number" ? computedStyle.width : dialogWidth;
		super(ctx, {
			id: `dialog-${dialog.id}`,
			position: "absolute",
			width: panelWidth,
			maxWidth: computedStyle.maxWidth ?? ctx.width - 2,
			minWidth: computedStyle.minWidth,
			maxHeight: computedStyle.maxHeight,
			backgroundColor: computedStyle.backgroundColor,
			border: computedStyle.border,
			borderColor: computedStyle.borderColor,
			borderStyle: computedStyle.borderStyle,
			paddingTop: padding.top,
			paddingRight: padding.right,
			paddingBottom: padding.bottom,
			paddingLeft: padding.left,
			visible: !isDeferred
		});
		this._dialog = dialog;
		this._containerOptions = containerOptions;
		this._computedStyle = computedStyle;
		if (dialog?.[JSX_CONTENT_KEY]) return;
		this.createContent();
	}
	createContent() {
		try {
			const contentRenderable = this._dialog.content(this.ctx);
			this.add(contentRenderable);
		} catch (error) {
			const dialogId = this._dialog.id;
			const originalMessage = error instanceof Error ? error.message : String(error);
			const originalStack = error instanceof Error ? error.stack : void 0;
			const enhancedError = /* @__PURE__ */ new Error(`[@tuiparts/dialog] Failed to create content for dialog "${dialogId}".\n\nRoot cause: ${originalMessage}\n\nThis error occurred while executing the content factory function. Check that your content factory returns a valid Renderable and doesn't throw.\n\nExample of a valid content factory:\n  content: (ctx) => new TextRenderable(ctx, { content: "Hello" })`);
			if (originalStack) enhancedError.stack = `${enhancedError.message}\n\nOriginal stack trace:\n${originalStack}`;
			throw enhancedError;
		}
	}
	updateDimensions(width, _height) {
		const dialogWidth = getDialogWidth(this._dialog.size, this._containerOptions, width);
		const panelWidth = typeof this._computedStyle.width === "number" ? this._computedStyle.width : dialogWidth;
		this.width = panelWidth;
		this.maxWidth = this._computedStyle.maxWidth ?? width - 2;
		this.requestRender();
	}
	get dialog() {
		return this._dialog;
	}
};
//#endregion
//#region src/types.ts
function isDialogToClose(value) {
	return "close" in value && value.close === true;
}
//#endregion
//#region src/renderables/dialog-container.ts
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
var DialogContainerRenderable = class extends BoxRenderable {
	_manager;
	_options;
	_backdrop;
	_dialogRenderables = /* @__PURE__ */ new Map();
	_unsubscribe = null;
	_destroyed = false;
	constructor(ctx, options) {
		super(ctx, {
			id: "dialog-container",
			position: "absolute",
			left: 0,
			top: 0,
			width: ctx.width,
			height: ctx.height,
			zIndex: DIALOG_Z_INDEX,
			alignItems: "center",
			justifyContent: "center",
			backgroundColor: "transparent",
			visible: false
		});
		this._manager = options.manager;
		const { manager: _, ...containerOptions } = options;
		this._options = containerOptions;
		this._backdrop = new BackdropRenderable(ctx, {
			containerOptions: this._options,
			onClick: () => this.handleBackdropClick()
		});
		this.add(this._backdrop);
		this._ctx.keyInput.on("keypress", this.handleKeyboard);
		this.subscribe();
	}
	subscribe() {
		this._unsubscribe?.();
		this._unsubscribe = this._manager.subscribe((data) => {
			if (this._destroyed) return;
			if (isDialogToClose(data)) this.removeDialog(data.id);
			else this.addOrUpdateDialog(data);
		});
	}
	/**
	* Handle keyboard events. Returns true if handled (e.g., ESC closed a dialog).
	*/
	handleKeyboard = (evt) => {
		if (evt.name === "escape" && this._dialogRenderables.size > 0) {
			const topDialog = this.getTopDialogRenderable();
			if (topDialog) {
				if ((topDialog.dialog.closeOnEscape ?? this._options.closeOnEscape) === false) return false;
				evt.preventDefault?.();
				this._manager.close(topDialog.dialog.id);
				return true;
			}
		}
		return false;
	};
	getTopDialogRenderable() {
		if (this._dialogRenderables.size === 0) return;
		const ids = Array.from(this._dialogRenderables.keys());
		const topId = ids[ids.length - 1];
		return topId !== void 0 ? this._dialogRenderables.get(topId) : void 0;
	}
	getDialogRenderable(id) {
		return this._dialogRenderables.get(id);
	}
	getDialogRenderables() {
		return this._dialogRenderables;
	}
	addOrUpdateDialog(dialog) {
		if (this._dialogRenderables.get(dialog.id)) this.removeDialog(dialog.id);
		const dialogRenderable = new DialogRenderable(this.ctx, {
			dialog,
			containerOptions: this._options
		});
		this._dialogRenderables.set(dialog.id, dialogRenderable);
		this.add(dialogRenderable);
		this.updateBackdropVisibility();
		this.updateBackdropStyle();
		this.requestRender();
	}
	removeDialog(id) {
		const renderable = this._dialogRenderables.get(id);
		if (renderable) {
			this._dialogRenderables.delete(id);
			this.remove(renderable);
			renderable.destroyRecursively();
			this.updateBackdropVisibility();
			this.updateBackdropStyle();
			this.requestRender();
		}
	}
	updateDimensions(width, height) {
		const h = height ?? this._ctx.height;
		this.width = width;
		this.height = h;
		this._backdrop.updateDimensions(width, h);
		for (const [, renderable] of this._dialogRenderables) renderable.updateDimensions(width, h);
	}
	set size(value) {
		this._options.size = value;
	}
	set dialogOptions(value) {
		this._options.dialogOptions = value;
	}
	set sizePresets(value) {
		this._options.sizePresets = value;
	}
	set closeOnEscape(value) {
		this._options.closeOnEscape = value;
	}
	set closeOnClickOutside(value) {
		this._options.closeOnClickOutside = value;
	}
	set backdropColor(value) {
		this._options.backdropColor = value;
		this._backdrop.updateContainerOptions(this._options);
		this.updateBackdropStyle();
	}
	set backdropOpacity(value) {
		this._options.backdropOpacity = value;
		this._backdrop.updateContainerOptions(this._options);
		this.updateBackdropStyle();
	}
	updateBackdropVisibility() {
		const hasDialogs = this._dialogRenderables.size > 0;
		this._backdrop.visible = hasDialogs;
		this.visible = hasDialogs;
	}
	updateBackdropStyle() {
		const topDialog = this.getTopDialogRenderable();
		this._backdrop.updateStyle(topDialog?.dialog);
	}
	handleBackdropClick() {
		const topDialog = this.getTopDialogRenderable();
		if (!topDialog) return;
		topDialog.dialog.onBackdropClick?.();
		if ((topDialog.dialog.closeOnClickOutside ?? this._options.closeOnClickOutside) === true) this._manager.close(topDialog.dialog.id);
	}
	set unstyled(value) {
		this._options.unstyled = value;
	}
	destroy() {
		if (this._destroyed) return;
		this._destroyed = true;
		this._unsubscribe?.();
		this._unsubscribe = null;
		this._ctx.keyInput.off("keypress", this.handleKeyboard);
		for (const [, renderable] of this._dialogRenderables) renderable.destroyRecursively();
		this._dialogRenderables.clear();
		this._backdrop.destroyRecursively();
		super.destroy();
	}
};
//#endregion
export { DialogManager as i, isDialogToClose as n, JSX_CONTENT_KEY as r, DialogContainerRenderable as t };
