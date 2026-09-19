import { createMemo } from "solid-js";
import { FileLike } from "./file-like";
import { conflictDisplayRows } from "./utils/conflict-lines";

import type { FileContents } from "@pierre/diffs";
import type { FileViewProps } from "./types";

export interface UnresolvedFileProps<
  LAnnotation = undefined,
> extends FileViewProps<LAnnotation> {
  file: FileContents;
}

export function UnresolvedFile<LAnnotation = undefined>(
  props: UnresolvedFileProps<LAnnotation>,
) {
  const rows = createMemo(() => conflictDisplayRows(props.file));
  return <FileLike<LAnnotation> {...props} rows={rows()} defaultPrefix="U" />;
}
