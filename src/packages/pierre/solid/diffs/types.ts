import type {
  DiffLineAnnotation,
  FileContents,
  FileDiffMetadata,
  LineAnnotation,
  SelectedLineRange,
} from "@pierre/diffs";
import type { JSX } from "solid-js";

export interface DiffBaseProps<LAnnotation> {
  disableLineNumbers?: boolean;
  lineAnnotations?: DiffLineAnnotation<LAnnotation>[];
  selectedLines?: SelectedLineRange | null;
  renderAnnotation?: (
    annotation: DiffLineAnnotation<LAnnotation>,
  ) => JSX.Element;
  renderCustomHeader?: (fileDiff: FileDiffMetadata) => JSX.Element;
  renderHeaderPrefix?: (fileDiff: FileDiffMetadata) => JSX.Element;
  renderHeaderFilenameSuffix?: (fileDiff: FileDiffMetadata) => JSX.Element;
  renderHeaderMetadata?: (fileDiff: FileDiffMetadata) => JSX.Element;
}

export interface FileViewProps<LAnnotation> {
  disableLineNumbers?: boolean;
  lineAnnotations?: LineAnnotation<LAnnotation>[];
  selectedLines?: SelectedLineRange | null;
  renderAnnotation?: (annotation: LineAnnotation<LAnnotation>) => JSX.Element;
  renderCustomHeader?: (file: FileContents) => JSX.Element;
  renderHeaderPrefix?: (file: FileContents) => JSX.Element;
  renderHeaderFilenameSuffix?: (file: FileContents) => JSX.Element;
  renderHeaderMetadata?: (file: FileContents) => JSX.Element;
}
