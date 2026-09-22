import { createMemo } from "solid-js";
import { FileLike } from "./file-like";
import { fileDisplayRows } from "./utils/file-lines";

import type { FileContents } from "@pierre/diffs";
import type { FileViewProps } from "./types";

export interface FileProps<
  LAnnotation = undefined,
> extends FileViewProps<LAnnotation> {
  file: FileContents;
}

export function File<LAnnotation = undefined>(props: FileProps<LAnnotation>) {
  const rows = createMemo(() => fileDisplayRows(props.file));
  return <FileLike<LAnnotation> {...props} rows={rows()} />;
}
