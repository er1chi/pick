import { i as DialogManager, r as JSX_CONTENT_KEY, t as DialogContainerRenderable } from "./dialog-container-DTi_aI2c.mjs";
import { themes } from "./themes.mjs";
import { BoxRenderable } from "@opentui/core";
import { createPortal, useKeyboard, useRenderer, useTerminalDimensions } from "@opentui/react";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState, useSyncExternalStore } from "react";
import { jsxs } from "@opentui/react/jsx-runtime";
//#region src/react.tsx
/** @jsxImportSource @opentui/react */
const DialogContext = createContext(null);
const createPlaceholderContent = () => (ctx) => new BoxRenderable(ctx, { id: "~jsx-placeholder" });
function buildShowOptions(content, rest, ctx) {
	const resolvedContent = ctx !== void 0 ? content(ctx) : content();
	return {
		...rest,
		content: createPlaceholderContent(),
		[JSX_CONTENT_KEY]: resolvedContent,
		deferred: true
	};
}
function useDialogManager() {
	const manager = useContext(DialogContext);
	if (!manager) throw new Error("useDialog/useDialogState must be used within a DialogProvider.\n\nWrap your app with <DialogProvider>:\n\n  import { DialogProvider } from '@tuiparts/dialog/react';\n\n  function App() {\n    return (\n      <DialogProvider>\n        <YourContent />\n      </DialogProvider>\n    );\n  }");
	return manager;
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
* // Show a dialog (content must be a function)
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
	const manager = useDialogManager();
	return useMemo(() => ({
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
	}), [manager]);
}
/**
* Subscribe to reactive dialog state with a selector.
*
* Only re-renders when the selected value changes (using reference equality).
*
* @example
* ```tsx
* // Subscribe to specific state
* const isOpen = useDialogState(s => s.isOpen);
* const count = useDialogState(s => s.count);
* const topDialog = useDialogState(s => s.topDialog);
* const dialogs = useDialogState(s => s.dialogs);
*
* // Use in your component
* if (isOpen) {
*   console.log(`${count} dialog(s) open`);
* }
* ```
*/
function useDialogState(selector) {
	const manager = useDialogManager();
	const subscribe = useMemo(() => (onStoreChange) => manager.subscribe(onStoreChange), [manager]);
	const getSnapshot = useCallback(() => {
		const dialogs = manager.getDialogs();
		return selector({
			isOpen: dialogs.length > 0,
			dialogs,
			topDialog: dialogs.length > 0 ? dialogs[dialogs.length - 1] : void 0,
			count: dialogs.length
		});
	}, [manager, selector]);
	return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
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
* function DeleteConfirmDialog({ resolve, dialogId }: ConfirmContext) {
*   useDialogKeyboard((key) => {
*     if (key.name === "return") resolve(true);
*     if (key.name === "escape") resolve(false);
*   }, dialogId);
*
*   return <text>Press Enter to confirm</text>;
* }
* ```
*/
function useDialogKeyboard(handler, dialogId) {
	const isTopmost = useDialogState((s) => s.topDialog?.id === dialogId);
	useKeyboard((key) => {
		if (isTopmost) handler(key);
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
	const { children, ...containerOptions } = props;
	const renderer = useRenderer();
	const dimensions = useTerminalDimensions();
	const [manager] = useState(() => new DialogManager(renderer));
	const [container] = useState(() => new DialogContainerRenderable(renderer, {
		manager,
		...containerOptions
	}));
	const dialogs = useSyncExternalStore((onStoreChange) => manager.subscribe(onStoreChange), () => manager.getDialogs(), () => manager.getDialogs());
	useEffect(() => {
		renderer.root.add(container);
		return () => {
			renderer.root.remove(container);
			container.destroyRecursively();
			manager.destroy();
		};
	}, [
		container,
		manager,
		renderer
	]);
	useEffect(() => {
		container.updateDimensions(dimensions.width);
	}, [container, dimensions.width]);
	const portals = useMemo(() => {
		if (!dialogs || dialogs.length === 0) return [];
		const portals = [];
		for (const [id, dialogRenderable] of container.getDialogRenderables()) {
			const jsxContent = dialogRenderable.dialog[JSX_CONTENT_KEY];
			if (jsxContent !== void 0) portals.push(createPortal(jsxContent, dialogRenderable, id));
		}
		return portals;
	}, [container, dialogs]);
	useLayoutEffect(() => {
		const raf = globalThis.requestAnimationFrame;
		for (const [, dialogRenderable] of container.getDialogRenderables()) raf(() => {
			dialogRenderable.visible = true;
		});
	}, [container, dialogs]);
	return /* @__PURE__ */ jsxs(DialogContext.Provider, {
		value: manager,
		children: [children, portals]
	});
}
//#endregion
export { DialogProvider, themes, useDialog, useDialogKeyboard, useDialogState };
