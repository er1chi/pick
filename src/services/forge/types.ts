export type ForgeKind = "github" | "forgejo";

export type ForgeInitializationError =
  | {
      readonly kind: ForgeKind;
      readonly code: "executable-unavailable";
    }
  | {
      readonly kind: ForgeKind;
      readonly code: "version-check-failed";
      readonly exitCode: number;
    };

export interface ForgeAdapter {
  readonly kind: ForgeKind;
}
