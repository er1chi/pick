import type { DiffLineAnnotation, LineAnnotation } from "@pierre/diffs";
import type { DisplayRow } from "./display-row";

interface LinedAnnotation {
  lineNumber: number;
}

function annotationsOnLine<TAnnotation extends LinedAnnotation>(
  annotations: readonly TAnnotation[] | undefined,
  lineNumber: number,
): readonly TAnnotation[] {
  if (annotations == null) {
    return [];
  }
  return annotations.filter(
    (annotation) => annotation.lineNumber === lineNumber,
  );
}

export function fileLevelAnnotations<LAnnotation>(
  annotations: readonly LineAnnotation<LAnnotation>[] | undefined,
): readonly LineAnnotation<LAnnotation>[] {
  return annotationsOnLine(annotations, 0);
}

export function diffFileLevelAnnotations<LAnnotation>(
  annotations: readonly DiffLineAnnotation<LAnnotation>[] | undefined,
): readonly DiffLineAnnotation<LAnnotation>[] {
  return annotationsOnLine(annotations, 0);
}

export function fileAnnotationsForRow<LAnnotation>(
  row: DisplayRow,
  annotations: readonly LineAnnotation<LAnnotation>[] | undefined,
): readonly LineAnnotation<LAnnotation>[] {
  if (row.lineNumber === undefined) {
    return [];
  }
  return annotationsOnLine(annotations, row.lineNumber);
}

function matchesDiffRow<LAnnotation>(
  row: DisplayRow,
  annotation: DiffLineAnnotation<LAnnotation>,
): boolean {
  if (annotation.lineNumber === 0) {
    return false;
  }
  if (annotation.side === "deletions") {
    return (
      row.oldLine === annotation.lineNumber &&
      (row.kind === "deletion" || row.kind === "context")
    );
  }
  return (
    row.newLine === annotation.lineNumber &&
    (row.kind === "addition" || row.kind === "context")
  );
}

export function diffAnnotationsForRow<LAnnotation>(
  row: DisplayRow,
  annotations: readonly DiffLineAnnotation<LAnnotation>[] | undefined,
): readonly DiffLineAnnotation<LAnnotation>[] {
  if (annotations == null) {
    return [];
  }
  return annotations.filter((annotation) => matchesDiffRow(row, annotation));
}
