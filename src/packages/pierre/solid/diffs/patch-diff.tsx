import { getSingularPatch } from "@pierre/diffs";
import { createMemo, splitProps } from "solid-js";
import { FileDiff } from "./file-diff";
import type { DiffBaseProps } from "./types";

export interface PatchDiffProps<
  LAnnotation = undefined,
> extends DiffBaseProps<LAnnotation> {
  patch: string;
}

export function PatchDiff<LAnnotation = undefined>(
  props: PatchDiffProps<LAnnotation>,
) {
  const [local, rest] = splitProps(props, ["patch"]);
  const fileDiff = createMemo(() => getSingularPatch(local.patch));
  return <FileDiff<LAnnotation> {...rest} fileDiff={fileDiff()} />;
}
