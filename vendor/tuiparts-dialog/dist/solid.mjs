import { i as DialogManager, n as isDialogToClose, r as JSX_CONTENT_KEY, t as DialogContainerRenderable } from "./dialog-container-DTi_aI2c.mjs";
import { themes } from "./themes.mjs";
import { BoxRenderable } from "@opentui/core";
import { Portal, createComponent, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/solid";
import { For, createContext, createEffect, createMemo, createSignal, onCleanup, useContext } from "solid-js";
//#region src/solid.tsx
/** @jsxImportSource @opentui/solid */
const DialogContext = createContext();
const createPlaceholderContent = () => (ctx) => new BoxRenderable(ctx, { id: "~jsx-placeholder" });
function buildShowOptions(content, rest, ctx) {
	const contentAccessor = ctx !== void 0 ? content(ctx) : content;
	validateContentAccessor(contentAccessor);
	return {
		...rest,
		content: createPlaceholderContent(),
		[JSX_CONTENT_KEY]: contentAccessor
	};
}
function validateContentAccessor(content) {
	if (typeof content !== "function") throw new Error(`[@tuiparts/dialog/solid] Invalid content type: expected a function returning JSX, but received ${typeof content}.\n\nSolid.js JSX is eagerly evaluated, so you must wrap content in a function:\n\n  // CORRECT\n  dialog.show({ content: () => <text>Hello</text> })\n\n  // WRONG - JSX evaluated immediately, before dialog context exists\n  dialog.show({ content: <text>Hello</text> })\n\nSee: https://github.com/tuiparts/tuiparts for more information.`);
}
function useDialogContext() {
	const ctx = useContext(DialogContext);
	if (!ctx) throw new Error("useDialog/useDialogState must be used within a DialogProvider.\n\nWrap your app with <DialogProvider>:\n\n  import { DialogProvider } from '@tuiparts/dialog/solid';\n\n  function App() {\n    return (\n      <DialogProvider>\n        <YourContent />\n      </DialogProvider>\n    );\n  }");
	return ctx;
}
/**
* Access dialog actions within a DialogProvider.
*
* For reactive state, use `useDialogState()` instead.
*
* @example
* ```tsx
* const dialog = useDialog();
*
* // Show a dialog (content must be a function returning JSX)
* dialog.show({ content: () => <text>Hello</text> });
*
* // Close the top dialog
* dialog.close();
*
* // Close a specific dialog
* dialog.close(dialogId);
*
* // Close all dialogs
* dialog.closeAll();
* ```
*/
function useDialog() {
	const { manager } = useDialogContext();
	return {
		show: (options) => {
			const { content, ...rest } = options;
			return manager.show(buildShowOptions(content, rest));
		},
		close: (id) => manager.close(id),
		closeAll: () => manager.closeAll(),
		replace: (options) => {
			const { content, ...rest } = options;
			return manager.replace(buildShowOptions(content, rest));
		},
		prompt: (options) => {
			const { content, fallback, ...rest } = options;
			return manager.prompt((ctx) => ({
				...buildShowOptions(content, rest, ctx),
				fallback
			}));
		},
		confirm: (options) => {
			const { content, fallback, ...rest } = options;
			return manager.confirm((ctx) => ({
				...buildShowOptions(content, rest, ctx),
				fallback
			}));
		},
		alert: (options) => {
			const { content, ...rest } = options;
			return manager.alert((ctx) => buildShowOptions(content, rest, ctx));
		},
		choice: (options) => {
			const { content, fallback, ...rest } = options;
			return manager.choice((ctx) => ({
				...buildShowOptions(content, rest, ctx),
				fallback
			}));
		}
	};
}
/**
* Subscribe to reactive dialog state with a selector.
*
* Returns an accessor that tracks in effects/memos. The selector
* is called inside a memo, so only the selected value is tracked.
*
* @example
* ```tsx
* // Subscribe to specific state - returns an accessor
* const isOpen = useDialogState(s => s.isOpen);
* const count = useDialogState(s => s.count);
* const topDialog = useDialogState(s => s.topDialog);
* const dialogs = useDialogState(s => s.dialogs);
*
* // Use in effects - tracks automatically
* createEffect(() => {
*   if (isOpen()) {
*     console.log(`${count()} dialog(s) open`);
*   }
* });
*
* // Use in JSX - tracks automatically
* <Show when={isOpen()}>
*   <text>{count()} dialogs open</text>
* </Show>
* ```
*/
function useDialogState(selector) {
	const { dialogs } = useDialogContext();
	return createMemo(() => {
		const d = dialogs();
		return selector({
			isOpen: d.length > 0,
			dialogs: d,
			topDialog: d.length > 0 ? d[d.length - 1] : void 0,
			count: d.length
		});
	});
}
/**
* A keyboard hook for dialog content that only fires when the dialog is topmost.
*
* This prevents keyboard events from affecting stacked dialogs that are not focused.
* Use this instead of `useKeyboard` inside dialog content components.
*
* @param handler - Keyboard event handler (only called when dialog is topmost)
* @param dialogId - The dialog's ID from context (e.g., `ctx.dialogId`)
*
* @example
* ```tsx
* function DeleteConfirmDialog(props: ConfirmContext) {
*   useDialogKeyboard((key) => {
*     if (key.name === "return") props.resolve(true);
*     if (key.name === "escape") props.resolve(false);
*   }, props.dialogId);
*
*   return () => <text>Press Enter to confirm</text>;
* }
* ```
*/
function useDialogKeyboard(handler, dialogId) {
	const isTopmost = useDialogState((s) => s.topDialog?.id === dialogId);
	useKeyboard((key) => {
		if (isTopmost()) handler(key);
	});
}
/**
* Provides dialog functionality to children via useDialog() and useDialogState() hooks.
*
* @example
* ```tsx
* <DialogProvider size="medium">
*   <App />
* </DialogProvider>
* ```
*/
function DialogProvider(props) {
	const renderer = useRenderer();
	const dimensions = useTerminalDimensions();
	const manager = new DialogManager(renderer);
	const [dialogs, setDialogs] = createSignal([]);
	let disposed = false;
	const portalItemCache = /* @__PURE__ */ new Map();
	const unsubscribe = manager.subscribe((data) => {
		// Dispose Solid portal children before the renderable layer destroys their mount.
		if (isDialogToClose(data)) {
			if (!disposed) setDialogs(manager.getDialogs());
			return;
		}
		queueMicrotask(() => {
			if (!disposed) setDialogs(manager.getDialogs());
		});
	});
	const container = new DialogContainerRenderable(renderer, {
		manager,
		size: props.size,
		dialogOptions: props.dialogOptions,
		sizePresets: props.sizePresets,
		closeOnEscape: props.closeOnEscape,
		closeOnClickOutside: props.closeOnClickOutside,
		backdropColor: props.backdropColor,
		backdropOpacity: props.backdropOpacity,
		unstyled: props.unstyled
	});
	renderer.root.add(container);
	onCleanup(() => {
		disposed = true;
		unsubscribe();
		portalItemCache.clear();
		renderer.root.remove(container);
		container.destroyRecursively();
		manager.destroy();
	});
	createEffect(() => {
		const dims = dimensions();
		container.updateDimensions(dims.width);
	});
	const portalItems = createMemo(() => {
		// The container still contains a closing dialog during Solid's synchronous cleanup.
		const activeDialogIds = new Set(dialogs().map((dialog) => dialog.id));
		const items = [];
		const dialogRenderables = container.getDialogRenderables();
		for (const [id, dialogRenderable] of dialogRenderables) {
			if (!activeDialogIds.has(id)) continue;
			const contentAccessor = dialogRenderable.dialog[JSX_CONTENT_KEY];
			if (contentAccessor !== void 0) {
				const cached = portalItemCache.get(id);
				const shouldUpdateCachedItem = !cached || cached.mount !== dialogRenderable;
				const item = shouldUpdateCachedItem ? {
					id,
					contentAccessor,
					mount: dialogRenderable
				} : cached;
				if (shouldUpdateCachedItem) portalItemCache.set(id, item);
				items.push(item);
			}
		}
		return items;
	});
	createEffect(() => {
		const activeIds = new Set(dialogs().map((dialog) => dialog.id));
		for (const id of portalItemCache.keys()) if (!activeIds.has(id)) portalItemCache.delete(id);
	});
	const contextValue = {
		manager,
		dialogs
	};
	return createComponent(DialogContext.Provider, {
		value: contextValue,
		get children() {
			return [props.children, createComponent(For, {
				get each() {
					return portalItems();
				},
				children: (item) => createComponent(Portal, {
					mount: item.mount,
					get children() {
						return item.contentAccessor();
					}
				})
			})];
		}
	});
}
//#endregion
export { DialogProvider, themes, useDialog, useDialogKeyboard, useDialogState };
