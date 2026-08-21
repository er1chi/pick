import { c as getTypeIcon, l as isAction, n as DEFAULT_ICONS, o as getLoadingIcon, s as getSpinnerConfig } from "./icons-BMmZyCM9.mjs";
import { BoxRenderable, TextAttributes, TextRenderable, parseColor } from "@opentui/core";
//#region src/constants.ts
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
const TOAST_DURATION = {
	/** 2 seconds - for brief confirmations */
	SHORT: 2e3,
	/** 4 seconds - default duration */
	DEFAULT: 4e3,
	/** 6 seconds - for important messages */
	LONG: 6e3,
	/** 10 seconds - for critical information */
	EXTENDED: 1e4,
	/** Never auto-dismiss - requires manual dismissal */
	PERSISTENT: Infinity
};
/**
* Default offset from screen edges
*
* @internal
*/
const DEFAULT_OFFSET = {
	top: 1,
	right: 2,
	bottom: 1,
	left: 2
};
/**
* Default toast options including base style and per-type overrides
*
* @internal
*/
const DEFAULT_TOAST_OPTIONS = {
	style: {
		border: true,
		borderStyle: "single",
		borderColor: "#333333",
		minHeight: 3,
		backgroundColor: "#1a1a1a",
		foregroundColor: "#ffffff",
		mutedColor: "#6b7280"
	},
	duration: TOAST_DURATION.DEFAULT,
	default: { style: { borderColor: "#333333" } },
	success: { style: { borderColor: "#22c55e" } },
	error: { style: { borderColor: "#ef4444" } },
	warning: { style: { borderColor: "#f59e0b" } },
	info: { style: { borderColor: "#3b82f6" } },
	loading: { style: { borderColor: "#6b7280" } }
};
//#endregion
//#region src/state.ts
let toastsCounter = 1;
/**
* Check if data is an HTTP Response object
*/
function isHttpResponse(data) {
	return data !== null && typeof data === "object" && "ok" in data && typeof data.ok === "boolean" && "status" in data && typeof data.status === "number";
}
/**
* Observer class implementing the pub/sub pattern for toast state management.
* This is the core of the Sonner-compatible API.
*/
var Observer = class {
	subscribers = [];
	toasts = [];
	dismissedToasts = /* @__PURE__ */ new Set();
	_activeToasts = [];
	_updateActiveToastsCache = () => {
		const active = this.toasts.filter((toast) => !this.dismissedToasts.has(toast.id));
		if (active.length !== this._activeToasts.length || active.some((t, i) => t !== this._activeToasts[i])) this._activeToasts = active;
	};
	/**
	* Subscribe to toast state changes
	*/
	subscribe = (subscriber) => {
		this.subscribers.push(subscriber);
		return () => {
			const index = this.subscribers.indexOf(subscriber);
			if (index > -1) this.subscribers.splice(index, 1);
		};
	};
	/**
	* Publish a toast to all subscribers
	*/
	publish = (data) => {
		for (const subscriber of this.subscribers) subscriber(data);
	};
	/**
	* Add a new toast
	*/
	addToast = (data) => {
		this.toasts = [...this.toasts, data];
		this._updateActiveToastsCache();
		this.publish(data);
	};
	/**
	* Create a toast (internal method)
	*/
	create = (data) => {
		const { message, ...rest } = data;
		const id = typeof data.id === "number" || data.id && data.id.length > 0 ? data.id : toastsCounter++;
		const alreadyExists = this.toasts.find((toast) => toast.id === id);
		const dismissible = data.dismissible === void 0 ? true : data.dismissible;
		if (this.dismissedToasts.has(id)) this.dismissedToasts.delete(id);
		if (alreadyExists) {
			this.toasts = this.toasts.map((toast) => {
				if (toast.id === id) {
					this.publish({
						...toast,
						...data,
						id,
						title: message
					});
					return {
						...toast,
						...data,
						id,
						dismissible,
						title: message
					};
				}
				return toast;
			});
			this._updateActiveToastsCache();
		} else this.addToast({
			title: message,
			...rest,
			dismissible,
			id,
			type: data.type ?? "default"
		});
		return id;
	};
	/**
	* Dismiss a toast by ID, or all toasts if no ID provided
	*
	* @example
	* ```ts
	* // Dismiss a specific toast
	* const id = toast('Hello');
	* toast.dismiss(id);
	*
	* // Dismiss all toasts
	* toast.dismiss();
	* ```
	*/
	dismiss = (id) => {
		if (id !== void 0) {
			this.dismissedToasts.add(id);
			this._updateActiveToastsCache();
			setTimeout(() => {
				for (const subscriber of this.subscribers) subscriber({
					id,
					dismiss: true
				});
			}, 0);
		} else {
			for (const toast of this.toasts) {
				this.dismissedToasts.add(toast.id);
				for (const subscriber of this.subscribers) subscriber({
					id: toast.id,
					dismiss: true
				});
			}
			this._updateActiveToastsCache();
		}
		return id;
	};
	/**
	* Create a basic message toast
	*
	* @example
	* ```ts
	* toast.message('Hello World');
	* toast.message('With description', { description: 'More details here' });
	* ```
	*/
	message = (message, data) => {
		return this.create({
			...data,
			message,
			type: "default"
		});
	};
	/**
	* Create an error toast
	*
	* @example
	* ```ts
	* toast.error('Something went wrong');
	* toast.error('Failed to save', { description: 'Please try again' });
	* ```
	*/
	error = (message, data) => {
		return this.create({
			...data,
			message,
			type: "error"
		});
	};
	/**
	* Create a success toast
	*
	* @example
	* ```ts
	* toast.success('Operation completed!');
	* toast.success('File uploaded', { description: 'document.pdf saved' });
	* ```
	*/
	success = (message, data) => {
		return this.create({
			...data,
			message,
			type: "success"
		});
	};
	/**
	* Create an info toast
	*
	* @example
	* ```ts
	* toast.info('Did you know?');
	* toast.info('Tip', { description: 'Press Ctrl+S to save' });
	* ```
	*/
	info = (message, data) => {
		return this.create({
			...data,
			message,
			type: "info"
		});
	};
	/**
	* Create a warning toast
	*
	* @example
	* ```ts
	* toast.warning('Be careful!');
	* toast.warning('Unsaved changes', { description: 'Your work may be lost' });
	* ```
	*/
	warning = (message, data) => {
		return this.create({
			...data,
			message,
			type: "warning"
		});
	};
	/**
	* Create a loading toast with an animated spinner
	*
	* @example
	* ```ts
	* // Basic loading toast
	* const id = toast.loading('Processing...');
	*
	* // Update to success when done
	* toast.success('Done!', { id });
	*
	* // Or update to error on failure
	* toast.error('Failed', { id });
	* ```
	*/
	loading = (message, data) => {
		return this.create({
			...data,
			message,
			type: "loading"
		});
	};
	/**
	* Create a promise toast that auto-updates based on promise state
	*
	* Automatically shows loading, success, or error states based on the promise result.
	* Handles HTTP Response objects with non-2xx status codes as errors.
	*
	* @example
	* ```ts
	* // Basic promise toast
	* toast.promise(fetch('/api/data'), {
	*   loading: 'Fetching data...',
	*   success: 'Data loaded!',
	*   error: 'Failed to load data',
	* });
	*
	* // With dynamic messages based on result
	* toast.promise(saveUser(data), {
	*   loading: 'Saving user...',
	*   success: (user) => `${user.name} saved!`,
	*   error: (err) => `Error: ${err.message}`,
	* });
	*
	* // Access the underlying promise result
	* const result = toast.promise(fetchData(), { ... });
	* const data = await result.unwrap();
	* ```
	*/
	promise = (promise, data) => {
		if (!data) return;
		let id;
		if (data.loading !== void 0) id = this.create({
			...data,
			type: "loading",
			message: data.loading,
			description: typeof data.description !== "function" ? data.description : void 0
		});
		const p = promise instanceof Function ? promise() : promise;
		let shouldDismiss = id !== void 0;
		let result;
		const originalPromise = p.then(async (response) => {
			result = ["resolve", response];
			if (isHttpResponse(response) && !response.ok) {
				shouldDismiss = false;
				const promiseData = typeof data.error === "function" ? await data.error(`HTTP error! status: ${response.status}`) : data.error;
				const description = typeof data.description === "function" ? await data.description(`HTTP error! status: ${response.status}`) : data.description;
				const toastSettings = typeof promiseData === "object" && promiseData !== null ? promiseData : { message: promiseData };
				this.create({
					id,
					type: "error",
					description,
					...toastSettings
				});
			} else if (response instanceof Error) {
				shouldDismiss = false;
				const promiseData = typeof data.error === "function" ? await data.error(response) : data.error;
				const description = typeof data.description === "function" ? await data.description(response) : data.description;
				const toastSettings = typeof promiseData === "object" && promiseData !== null ? promiseData : { message: promiseData };
				this.create({
					id,
					type: "error",
					description,
					...toastSettings
				});
			} else if (data.success !== void 0) {
				shouldDismiss = false;
				const promiseData = typeof data.success === "function" ? await data.success(response) : data.success;
				const description = typeof data.description === "function" ? await data.description(response) : data.description;
				const toastSettings = typeof promiseData === "object" && promiseData !== null ? promiseData : { message: promiseData };
				this.create({
					id,
					type: "success",
					description,
					...toastSettings
				});
			}
		}).catch(async (error) => {
			result = ["reject", error];
			if (data.error !== void 0) {
				shouldDismiss = false;
				const promiseData = typeof data.error === "function" ? await data.error(error) : data.error;
				const description = typeof data.description === "function" ? await data.description(error) : data.description;
				const toastSettings = typeof promiseData === "object" && promiseData !== null ? promiseData : { message: promiseData };
				this.create({
					id,
					type: "error",
					description,
					...toastSettings
				});
			}
		}).finally(() => {
			if (shouldDismiss) {
				this.dismiss(id);
				id = void 0;
			}
			data.finally?.();
		});
		const unwrap = () => new Promise((resolve, reject) => originalPromise.then(() => result[0] === "reject" ? reject(result[1]) : resolve(result[1])).catch(reject));
		if (typeof id !== "string" && typeof id !== "number") return { unwrap };
		return Object.assign(id, { unwrap });
	};
	getActiveToasts = () => {
		return this._activeToasts;
	};
};
/**
* Global toast state singleton
*/
const ToastState = new Observer();
/**
* Basic toast function - delegates to ToastState.message() for consistent behavior
*/
const toastFunction = (message, data) => ToastState.message(message, data);
/**
* Get toast history (all toasts ever created, including dismissed)
*
* @example
* ```ts
* const history = toast.getHistory();
* console.log(`Total toasts shown: ${history.length}`);
* ```
*/
const getHistory = () => ToastState.toasts;
/**
* Get currently active (visible) toasts
*
* @example
* ```ts
* const active = toast.getToasts();
* console.log(`Currently showing ${active.length} toasts`);
* ```
*/
const getToasts = () => ToastState.getActiveToasts();
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
const toast = Object.assign(toastFunction, {
	success: ToastState.success,
	info: ToastState.info,
	warning: ToastState.warning,
	error: ToastState.error,
	message: ToastState.message,
	promise: ToastState.promise,
	dismiss: ToastState.dismiss,
	loading: ToastState.loading
}, {
	getHistory,
	getToasts
});
//#endregion
//#region src/utils/position.ts
/**
* Convert a Position and offset to BoxOptions for absolute positioning
*
* Handles all 6 position variants:
* - top-left, top-center, top-right
* - bottom-left, bottom-center, bottom-right
*
* @example
* ```ts
* getPositionStyles("top-right", { top: 2, right: 3 })
* // => { position: "absolute", top: 2, right: 3, alignItems: "flex-end" }
*
* getPositionStyles("bottom-center", {})
* // => { position: "absolute", bottom: 1, left: 0, width: "100%", alignItems: "center" }
* ```
*/
function getPositionStyles(position, offset = {}) {
	const [y, x] = position.split("-");
	const styles = { position: "absolute" };
	if (y === "top") styles.top = offset.top ?? DEFAULT_OFFSET.top;
	else styles.bottom = offset.bottom ?? DEFAULT_OFFSET.bottom;
	if (x === "left") {
		styles.left = offset.left ?? DEFAULT_OFFSET.left;
		styles.alignItems = "flex-start";
	} else if (x === "center") {
		styles.left = 0;
		styles.width = "100%";
		styles.alignItems = "center";
	} else {
		styles.right = offset.right ?? DEFAULT_OFFSET.right;
		styles.alignItems = "flex-end";
	}
	return styles;
}
/**
* Check if a position is horizontally centered
*/
function isCenteredPosition(position) {
	return position.includes("center");
}
/**
* Check if a position is at the top of the screen
*/
function isTopPosition(position) {
	return position.startsWith("top");
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
//#region src/utils/style.ts
/**
* Style utilities for toast rendering
*/
/**
* Compute the final style for a toast by merging all style layers
*
* Merges styles in order of increasing specificity:
* 1. DEFAULT_TOAST_OPTIONS.style (sensible defaults)
* 2. DEFAULT_TOAST_OPTIONS[type].style (default type colors)
* 3. toastOptions.style (user's global style)
* 4. toastOptions[type].style (user's type-specific overrides)
* 5. toastStyle (per-toast inline style from toast() call)
*
* @example
* ```ts
* computeToastStyle("success", { style: { paddingX: 2 }, success: { style: { borderColor: "green" } } })
* ```
*/
function computeToastStyle(type, toastOptions, toastStyle) {
	const defaultBaseStyle = DEFAULT_TOAST_OPTIONS.style;
	const defaultTypeStyle = DEFAULT_TOAST_OPTIONS[type]?.style;
	const userBaseStyle = toastOptions?.style;
	const userTypeStyle = toastOptions?.[type]?.style;
	const computedStyle = mergeStyles(defaultBaseStyle, defaultTypeStyle, userBaseStyle, userTypeStyle, toastStyle);
	if (computedStyle.border === false) {
		delete computedStyle.borderStyle;
		delete computedStyle.borderColor;
	}
	return computedStyle;
}
/**
* Compute the duration for a toast
*
* Priority: toast.duration > toastOptions[type].duration > toastOptions.duration > DEFAULT
*/
function computeToastDuration(type, toastOptions, toastDuration) {
	if (toastDuration !== void 0) return toastDuration;
	const typeDuration = toastOptions?.[type]?.duration;
	if (typeDuration !== void 0) return typeDuration;
	if (toastOptions?.duration !== void 0) return toastOptions.duration;
	return DEFAULT_TOAST_OPTIONS.duration;
}
//#endregion
//#region src/renderables/toast.ts
/**
* ToastRenderable - A single toast notification component
*
* Renders a toast with icon, title, description, action button, and close button.
*/
/**
* ToastRenderable - A single toast notification
*
* Renders a toast with:
* - Icon (based on type, with spinner animation for loading)
* - Title (bold text)
* - Description (optional, muted text)
* - Action button (optional)
* - Close button (optional)
*
* Supports:
* - Auto-dismiss with configurable duration
* - Pause/resume timer
* - Style updates when toast type changes
* - Spinner animation for loading toasts
*/
var ToastRenderable = class extends BoxRenderable {
	_toast;
	_icons;
	_toastOptions;
	_computedStyle;
	_closeButton;
	_onRemove;
	_remainingTime;
	_closeTimerStartTime = 0;
	_lastCloseTimerStartTime = 0;
	_timerHandle = null;
	_paused = false;
	_dismissed = false;
	_spinnerHandle = null;
	_spinnerFrameIndex = 0;
	_spinnerConfig = null;
	_iconText = null;
	_contentBox = null;
	_titleText = null;
	_descriptionText = null;
	_actionsBox = null;
	constructor(ctx, options) {
		const computedStyle = computeToastStyle(options.toast.type, options.toastOptions, options.toast.style);
		const duration = computeToastDuration(options.toast.type, options.toastOptions, options.toast.duration);
		const padding = resolvePadding(computedStyle, {
			top: 0,
			right: 1,
			bottom: 0,
			left: 1
		});
		super(ctx, {
			id: `toast-${options.toast.id}`,
			flexDirection: "row",
			gap: 1,
			border: computedStyle.border,
			borderStyle: computedStyle.borderStyle,
			borderColor: computedStyle.borderColor,
			customBorderChars: computedStyle.customBorderChars,
			backgroundColor: computedStyle.backgroundColor,
			minHeight: computedStyle.minHeight,
			maxWidth: computedStyle.maxWidth ?? 60,
			minWidth: computedStyle.minWidth,
			paddingTop: padding.top,
			paddingRight: padding.right,
			paddingBottom: padding.bottom,
			paddingLeft: padding.left,
			onMouseOver: () => this.pause(),
			onMouseOut: () => this.resume()
		});
		this._toast = options.toast;
		this._icons = options.icons === false ? false : {
			...DEFAULT_ICONS,
			...options.icons
		};
		this._toastOptions = options.toastOptions;
		this._computedStyle = computedStyle;
		this._closeButton = options.closeButton;
		this._onRemove = options.onRemove;
		this._remainingTime = duration;
		this.setupContent();
		if (this._remainingTime !== Infinity && this._toast.type !== "loading") this.startTimer();
		if (this._toast.type === "loading") this.startSpinner();
	}
	/**
	* Set up the toast content (icon, title, description, actions)
	*/
	setupContent() {
		const ctx = this.ctx;
		const toast = this._toast;
		const style = this._computedStyle;
		const icons = this._icons;
		const iconColor = style.iconColor ?? style.borderColor;
		const isLoading = toast.type === "loading";
		if (isLoading && icons !== false) this._spinnerConfig = getSpinnerConfig(icons.loading);
		const icon = toast.icon ?? (icons === false ? void 0 : isLoading ? getLoadingIcon(icons.loading) : getTypeIcon(toast.type, icons));
		if (icon) {
			this._iconText = new TextRenderable(ctx, {
				id: `${this.id}-icon`,
				content: icon,
				fg: iconColor,
				flexShrink: 0,
				paddingTop: 0,
				paddingBottom: 0
			});
			this.add(this._iconText);
		}
		this._contentBox = new BoxRenderable(ctx, {
			id: `${this.id}-content`,
			flexDirection: "column",
			flexGrow: 1,
			flexShrink: 1,
			gap: 0
		});
		const title = typeof toast.title === "function" ? toast.title() : toast.title;
		if (title) {
			this._titleText = new TextRenderable(ctx, {
				id: `${this.id}-title`,
				content: title,
				fg: style.foregroundColor,
				attributes: TextAttributes.BOLD,
				wrapMode: "word"
			});
			this._contentBox.add(this._titleText);
		}
		const description = typeof toast.description === "function" ? toast.description() : toast.description;
		if (description) {
			this._descriptionText = new TextRenderable(ctx, {
				id: `${this.id}-description`,
				content: description,
				fg: style.mutedColor,
				wrapMode: "word"
			});
			this._contentBox.add(this._descriptionText);
		}
		this.add(this._contentBox);
		if (toast.action) {
			this._actionsBox = new BoxRenderable(ctx, {
				id: `${this.id}-actions`,
				flexDirection: "row",
				gap: 1,
				flexShrink: 0,
				alignItems: "center"
			});
			if (toast.action && isAction(toast.action)) {
				const actionText = new TextRenderable(ctx, {
					id: `${this.id}-action`,
					content: `[${toast.action.label}]`,
					fg: style.foregroundColor,
					onMouseUp: () => toast.action?.onClick?.()
				});
				this._actionsBox.add(actionText);
			}
			this.add(this._actionsBox);
		}
		if ((toast.closeButton ?? this._closeButton) && toast.dismissible !== false) {
			const closeIcon = icons === false ? "×" : icons.close;
			const closeText = new TextRenderable(ctx, {
				id: `${this.id}-close`,
				content: closeIcon,
				fg: style.mutedColor,
				flexShrink: 0,
				onMouseUp: () => this.dismiss()
			});
			this.add(closeText);
		}
	}
	/**
	* Start the auto-dismiss timer
	*/
	startTimer() {
		if (this._remainingTime === Infinity) return;
		this._closeTimerStartTime = Date.now();
		this._timerHandle = setTimeout(() => {
			this._toast.onAutoClose?.(this._toast);
			this.dismiss();
		}, this._remainingTime);
	}
	/**
	* Pause the auto-dismiss timer
	*
	* Call this when the user is interacting with the toast
	* (e.g., hovering over it in a mouse-enabled terminal)
	*/
	pause() {
		if (this._paused || this._remainingTime === Infinity) return;
		this._paused = true;
		if (this._timerHandle) {
			clearTimeout(this._timerHandle);
			this._timerHandle = null;
		}
		if (this._lastCloseTimerStartTime < this._closeTimerStartTime) {
			const elapsed = Date.now() - this._closeTimerStartTime;
			this._remainingTime = Math.max(0, this._remainingTime - elapsed);
		}
		this._lastCloseTimerStartTime = Date.now();
	}
	/**
	* Resume the auto-dismiss timer
	*
	* Call this when the user stops interacting with the toast
	*/
	resume() {
		if (!this._paused || this._remainingTime === Infinity) return;
		this._paused = false;
		this.startTimer();
	}
	/**
	* Start the spinner animation for loading toasts
	*/
	startSpinner() {
		if (this._spinnerHandle || !this._spinnerConfig) return;
		const { frames, interval } = this._spinnerConfig;
		this._spinnerHandle = setInterval(() => {
			this._spinnerFrameIndex = (this._spinnerFrameIndex + 1) % frames.length;
			const frame = frames[this._spinnerFrameIndex];
			if (this._iconText && frame) {
				this._iconText.content = frame;
				this.requestRender();
			}
		}, interval);
	}
	/**
	* Stop the spinner animation
	*/
	stopSpinner() {
		if (this._spinnerHandle) {
			clearInterval(this._spinnerHandle);
			this._spinnerHandle = null;
		}
	}
	/**
	* Dismiss this toast
	*
	* Triggers the onDismiss callback and schedules removal.
	* Also notifies ToastState subscribers (e.g., React hooks) about the dismissal.
	*/
	dismiss() {
		if (this._dismissed) return;
		this._dismissed = true;
		if (this._timerHandle) {
			clearTimeout(this._timerHandle);
			this._timerHandle = null;
		}
		this.stopSpinner();
		this._toast.onDismiss?.(this._toast);
		ToastState.dismiss(this._toast.id);
		setTimeout(() => {
			this._onRemove?.(this._toast);
		}, 200);
	}
	/**
	* Update the toast data
	*
	* Used for updating an existing toast (e.g., toast.success('done', { id: existingId }))
	*/
	updateToast(toast) {
		this._toast = toast;
		const computedStyle = computeToastStyle(toast.type, this._toastOptions, toast.style);
		this._computedStyle = computedStyle;
		if (computedStyle.borderColor) this.borderColor = computedStyle.borderColor;
		if (computedStyle.customBorderChars) this.customBorderChars = computedStyle.customBorderChars;
		const iconColor = computedStyle.iconColor ?? computedStyle.borderColor;
		if (this._iconText) {
			const icon = toast.icon ?? (this._icons === false ? void 0 : getTypeIcon(toast.type, this._icons));
			if (icon) this._iconText.content = icon;
			if (iconColor) this._iconText.fg = parseColor(iconColor);
		}
		if (this._titleText) {
			const title = typeof toast.title === "function" ? toast.title() : toast.title;
			if (title) this._titleText.content = title;
		}
		if (this._descriptionText) {
			const description = typeof toast.description === "function" ? toast.description() : toast.description;
			if (description) this._descriptionText.content = description;
		}
		const wasLoading = this._spinnerHandle !== null;
		const isLoading = toast.type === "loading";
		if (wasLoading && !isLoading) {
			this.stopSpinner();
			this._spinnerConfig = null;
		} else if (!wasLoading && isLoading) {
			if (this._icons !== false) this._spinnerConfig = getSpinnerConfig(this._icons.loading);
			this.startSpinner();
		}
		if (toast.type !== "loading") {
			if (this._timerHandle) clearTimeout(this._timerHandle);
			this._remainingTime = computeToastDuration(toast.type, this._toastOptions, toast.duration);
			if (this._remainingTime !== Infinity) this.startTimer();
		}
		this.requestRender();
	}
	/**
	* Get the toast data
	*/
	get toast() {
		return this._toast;
	}
	/**
	* Check if toast is dismissed
	*/
	get isDismissed() {
		return this._dismissed;
	}
	/**
	* Clean up on destroy
	*/
	destroy() {
		if (this._timerHandle) {
			clearTimeout(this._timerHandle);
			this._timerHandle = null;
		}
		this.stopSpinner();
		super.destroy();
	}
};
//#endregion
//#region src/renderables/toaster.ts
/**
* ToasterRenderable - Container for toast notifications
*
* Manages the display of multiple toasts, subscribes to ToastState,
* and handles positioning, stacking, and removal.
*/
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
var ToasterRenderable = class extends BoxRenderable {
	_options = {};
	_toastRenderables = /* @__PURE__ */ new Map();
	_unsubscribe = null;
	constructor(ctx, options = {}) {
		super(ctx, {
			id: "toaster",
			flexDirection: "column",
			gap: 1,
			zIndex: 9999
		});
		this._options = options;
		this.applyLayoutOptions();
		this.subscribe();
	}
	/**
	* Apply layout-related options to the renderable
	*/
	applyLayoutOptions() {
		const toastPosition = this._options.position ?? "bottom-right";
		const positionStyles = getPositionStyles(toastPosition, this._options.offset ?? {});
		const isCentered = isCenteredPosition(toastPosition);
		Object.assign(this, positionStyles);
		super.gap = this._options.gap ?? 1;
		if (!isCentered) super.maxWidth = this._options.maxWidth ?? 60;
	}
	isToastPosition(value) {
		return value === "top-left" || value === "top-center" || value === "top-right" || value === "bottom-left" || value === "bottom-center" || value === "bottom-right";
	}
	set position(value) {
		if (this.isToastPosition(value)) {
			this._options.position = value;
			this.applyLayoutOptions();
		} else super.position = value;
	}
	set offset(value) {
		this._options.offset = value;
		this.applyLayoutOptions();
	}
	set gap(value) {
		this._options.gap = value;
		super.gap = value;
	}
	set visibleToasts(value) {
		this._options.visibleToasts = value;
	}
	set closeButton(value) {
		this._options.closeButton = value;
	}
	set icons(value) {
		this._options.icons = value;
	}
	set stackingMode(value) {
		this._options.stackingMode = value;
	}
	set maxWidth(value) {
		this._options.maxWidth = value;
		super.maxWidth = value;
	}
	set toastOptions(value) {
		this._options.toastOptions = value;
	}
	/**
	* Subscribe to toast state changes
	*/
	subscribe() {
		this._unsubscribe = ToastState.subscribe((toast) => {
			if ("dismiss" in toast && toast.dismiss) this.removeToast(toast.id);
			else this.addOrUpdateToast(toast);
		});
	}
	/**
	* Add a new toast or update an existing one
	*/
	addOrUpdateToast(toast) {
		const existing = this._toastRenderables.get(toast.id);
		if (existing) {
			existing.updateToast(toast);
			return;
		}
		if ((this._options.stackingMode ?? "single") === "single") for (const [id] of this._toastRenderables) this.removeToast(id);
		else {
			const maxVisible = this._options.visibleToasts ?? 3;
			const currentCount = this._toastRenderables.size;
			if (currentCount >= maxVisible) {
				const toRemove = currentCount - maxVisible + 1;
				const ids = Array.from(this._toastRenderables.keys());
				for (let i = 0; i < toRemove; i++) {
					const id = ids[i];
					if (id !== void 0) this.removeToast(id);
				}
			}
		}
		const toastRenderable = new ToastRenderable(this.ctx, {
			toast,
			icons: this._options.icons,
			toastOptions: this._options.toastOptions,
			closeButton: this._options.closeButton,
			onRemove: (t) => this.handleToastRemoved(t)
		});
		this._toastRenderables.set(toast.id, toastRenderable);
		if (isTopPosition(this._options.position ?? "bottom-right")) this.add(toastRenderable);
		else this.add(toastRenderable, 0);
		this.requestRender();
	}
	/**
	* Remove a toast by ID
	*/
	removeToast(id) {
		const toast = this._toastRenderables.get(id);
		if (toast) toast.dismiss();
	}
	/**
	* Handle when a toast is fully removed
	*/
	handleToastRemoved(toast) {
		const renderable = this._toastRenderables.get(toast.id);
		if (renderable) {
			this._toastRenderables.delete(toast.id);
			this.remove(renderable);
			renderable.destroy();
			this.requestRender();
		}
	}
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
	get toastCount() {
		return this._toastRenderables.size;
	}
	/**
	* Dismiss all toasts managed by this toaster
	*
	* @example
	* ```ts
	* // Clear all notifications
	* toaster.dismissAll();
	* ```
	*/
	dismissAll() {
		for (const [id] of this._toastRenderables) this.removeToast(id);
	}
	/**
	* Clean up on destroy
	*/
	destroy() {
		this._unsubscribe?.();
		for (const [, renderable] of this._toastRenderables) renderable.destroy();
		this._toastRenderables.clear();
		super.destroy();
	}
};
//#endregion
export { TOAST_DURATION as i, ToastState as n, toast as r, ToasterRenderable as t };
