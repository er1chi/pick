import { n as ToastState, r as toast, t as ToasterRenderable } from "./toaster-CHQtGmiX.mjs";
import { createElement, extend, spread } from "@opentui/solid";
import { createSignal, onCleanup } from "solid-js";
//#region src/solid.ts
/** @jsxImportSource @opentui/solid */
extend({ toaster: ToasterRenderable });
function Toaster(props) {
	const el = createElement("toaster");
	spread(el, props);
	return el;
}
function useToasts() {
	const [toasts, setToasts] = createSignal(ToastState.getActiveToasts());
	onCleanup(ToastState.subscribe(() => {
		setToasts(ToastState.getActiveToasts());
	}));
	return toasts;
}
//#endregion
export { Toaster, toast, useToasts };
