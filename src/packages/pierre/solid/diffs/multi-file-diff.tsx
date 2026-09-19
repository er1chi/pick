import { parseDiffFromFile, type DiffFileInput } from "@pierre/diffs";
import { createMemo, splitProps } from "solid-js";
import { FileDiff } from "./file-diff";

import type { DiffBaseProps } from "./types";

export type MultiFileDiffProps<LAnnotation = undefined> =
  DiffBaseProps<LAnnotation> & DiffFileInput;

export function MultiFileDiff<LAnnotation = undefined>(
  props: MultiFileDiffProps<LAnnotation>,
) {
  const [local, rest] = splitProps(props, ["oldFile", "newFile"]);
  const fileDiff = createMemo(() =>
    parseDiffFromFile(local.oldFile, local.newFile),
  );
  return <FileDiff<LAnnotation> {...rest} fileDiff={fileDiff()} />;
}
