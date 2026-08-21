import { n as ToastState, r as toast, t as ToasterRenderable } from "./toaster-CHQtGmiX.mjs";
import { extend } from "@opentui/react";
import { useSyncExternalStore } from "react";
import { jsx } from "@opentui/react/jsx-runtime";
//#region src/react.tsx
/** @jsxImportSource @opentui/react */
extend({ toaster: ToasterRenderable });
function Toaster(props) {
	return /* @__PURE__ */ jsx("toaster", { ...props });
}
function useToasts() {
	return { toasts: useSyncExternalStore(ToastState.subscribe, ToastState.getActiveToasts, ToastState.getActiveToasts) };
}
//#endregion
export { Toaster, toast, useToasts };
