import { createMemo } from "solid-js";
import { CodeHeader } from "./code-header";
import { AnnotatedCodeSurface } from "./code-surface";
import {
  diffAnnotationsForRow,
  diffFileLevelAnnotations,
} from "./utils/annotations";
import { flattenHunks } from "./utils/flatten-hunks";

import type { ChangeTypes, FileDiffMetadata } from "@pierre/diffs";
import type { DiffBaseProps } from "./types";

export type { FileDiffMetadata };

export interface FileDiffProps<
  LAnnotation = undefined,
> extends DiffBaseProps<LAnnotation> {
  fileDiff: FileDiffMetadata;
}

function changePrefix(type: ChangeTypes): string {
  switch (type) {
    case "change":
      return "M";
    case "new":
      return "A";
    case "deleted":
      return "D";
    case "rename-pure":
    case "rename-changed":
      return "R";
  }
}

function filename(fileDiff: FileDiffMetadata): string {
  if (fileDiff.prevName == null) {
    return fileDiff.name;
  }
  return `${fileDiff.prevName} → ${fileDiff.name}`;
}

export function FileDiff<LAnnotation = undefined>(
  props: FileDiffProps<LAnnotation>,
) {
  const rows = createMemo(() => flattenHunks(props.fileDiff));

  return (
    <AnnotatedCodeSurface
      header={
        <CodeHeader
          custom={props.renderCustomHeader?.(props.fileDiff)}
          prefix={
            props.renderHeaderPrefix?.(props.fileDiff) ?? (
              <text>{changePrefix(props.fileDiff.type)}</text>
            )
          }
          filename={filename(props.fileDiff)}
          suffix={props.renderHeaderFilenameSuffix?.(props.fileDiff)}
          metadata={props.renderHeaderMetadata?.(props.fileDiff)}
        />
      }
      rows={rows()}
      disableLineNumbers={props.disableLineNumbers}
      selectedLines={props.selectedLines}
      fileLevel={diffFileLevelAnnotations(props.lineAnnotations)}
      annotationsForRow={(row) =>
        diffAnnotationsForRow(row, props.lineAnnotations)
      }
      renderAnnotation={props.renderAnnotation}
    />
  );
}
