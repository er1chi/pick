//#region src/themes.ts
const DEFAULT_BACKDROP_OPACITY = 89;
const DEFAULT_BACKDROP_COLOR = "#000000";
const DEFAULT_STYLE = {
	backgroundColor: "#262626",
	border: false,
	padding: 1
};
const DEFAULT_PADDING = {
	top: 1,
	right: 1,
	bottom: 1,
	left: 1
};
const minimal = {
	name: "Minimal",
	description: "Clean and unobtrusive, lighter backdrop, no borders (default)",
	dialogOptions: { style: DEFAULT_STYLE }
};
const unstyled = {
	name: "Unstyled",
	description: "No default styles - full control for custom implementations",
	unstyled: true,
	backdropOpacity: 0,
	dialogOptions: { style: {
		backgroundColor: void 0,
		border: false,
		padding: 0
	} }
};
const themes = {
	minimal,
	unstyled
};
//#endregion
export { DEFAULT_BACKDROP_COLOR, DEFAULT_BACKDROP_OPACITY, DEFAULT_PADDING, DEFAULT_STYLE, minimal, themes, unstyled };
