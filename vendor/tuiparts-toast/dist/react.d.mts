import { c as Toast, m as ToasterOptions } from "./types-DeXK0CHF.mjs";
import { n as ToasterRenderable, t as toast } from "./state-CVohZuAG.mjs";
//#region src/react.d.ts
declare module "@opentui/react" {
  interface OpenTUIComponents {
    toaster: typeof ToasterRenderable;
  }
}
declare function Toaster(props: ToasterOptions): import("react").ReactNode;
declare function useToasts(): {
  toasts: Toast[];
};
//#endregion
export { Toaster, toast, useToasts };