import type { FileDiffMetadata } from "@pierre/diffs";
import { parsePatchFiles } from "@pierre/diffs";
import type { ForgeSection, PullRequestPatch } from "@/services/forge/types";

export interface PatchFileIndex {
  readonly files: readonly FileDiffMetadata[];
  readonly byPath: ReadonlyMap<string, FileDiffMetadata>;
}

const emptyIndex: PatchFileIndex = {
  files: [],
  byPath: new Map(),
};
const indexCache = new WeakMap<object, PatchFileIndex>();

/** Parse an available patch once and preserve file identities across selection. */
export function patchFileIndex(
  section: ForgeSection<PullRequestPatch> | undefined,
): PatchFileIndex {
  if (section?.status !== "available") {
    return emptyIndex;
  }

  const cached = indexCache.get(section);
  if (cached !== undefined) {
    return cached;
  }

  const files = parsePatchFiles(section.value.text).flatMap(
    (entry) => entry.files,
  );
  const byPath = new Map<string, FileDiffMetadata>();
  for (const file of files) {
    byPath.set(file.name, file);
    if (file.prevName !== undefined) {
      byPath.set(file.prevName, file);
    }
  }

  const index = { files, byPath };
  indexCache.set(section, index);
  return index;
}
