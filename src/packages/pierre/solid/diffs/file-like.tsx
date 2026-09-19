import { CodeHeader } from "./code-header";
import { AnnotatedCodeSurface } from "./code-surface";
import {
  fileAnnotationsForRow,
  fileLevelAnnotations,
} from "./utils/annotations";

import type { FileContents } from "@pierre/diffs";
import type { FileViewProps } from "./types";
import type { DisplayRow } from "./utils/display-row";

export function FileLike<LAnnotation>(
  props: FileViewProps<LAnnotation> & {
    file: FileContents;
    rows: readonly DisplayRow[];
    defaultPrefix?: string;
  },
) {
  return (
    <AnnotatedCodeSurface
      header={
        <CodeHeader
          custom={props.renderCustomHeader?.(props.file)}
          prefix={
            props.renderHeaderPrefix?.(props.file) ??
            (props.defaultPrefix == null ? undefined : (
              <text>{props.defaultPrefix}</text>
            ))
          }
          filename={props.file.name}
          suffix={props.renderHeaderFilenameSuffix?.(props.file)}
          metadata={props.renderHeaderMetadata?.(props.file)}
        />
      }
      rows={props.rows}
      disableLineNumbers={props.disableLineNumbers}
      selectedLines={props.selectedLines}
      fileLevel={fileLevelAnnotations(props.lineAnnotations)}
      annotationsForRow={(row) =>
        fileAnnotationsForRow(row, props.lineAnnotations)
      }
      renderAnnotation={props.renderAnnotation}
    />
  );
}
