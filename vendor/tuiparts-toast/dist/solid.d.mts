import { c as Toast, m as ToasterOptions } from "./types-DeXK0CHF.mjs";
import { n as ToasterRenderable, t as toast } from "./state-CVohZuAG.mjs";
//#region src/solid.d.ts
declare module "@opentui/solid" {
  interface OpenTUIComponents {
    toaster: typeof ToasterRenderable;
  }
}
declare function Toaster(props: ToasterOptions): import("@opentui/core").BaseRenderable;
declare function useToasts(): import("solid-js").Accessor<Toast[]>;
//#endregion
export { Toaster, toast, useToasts };