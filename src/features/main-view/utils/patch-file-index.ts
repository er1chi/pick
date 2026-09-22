import { parsePatchFiles } from "@pierre/diffs";

import type { FileDiffMetadata } from "@pierre/diffs";
import type { ForgeSection, PullRequestPatch } from "@/services/forge/types";

export interface PatchFileIndex {
  readonly files: readonly FileDiffMetadata[];
  readonly byPath: ReadonlyMap<string, FileDiffMetadata>;
  /** Cached so callers get a stable array identity while the patch is unchanged. */
  readonly names: readonly string[];
  readonly counts: { readonly additions: number; readonly deletions: number };
}

const emptyIndex: PatchFileIndex = {
  files: [],
  byPath: new Map(),
  names: [],
  counts: { additions: 0, deletions: 0 },
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
  const names = files.map((file) => file.name);
  const byPath = new Map<string, FileDiffMetadata>();
  let additions = 0;
  let deletions = 0;
  for (const file of files) {
    byPath.set(file.name, file);
    if (file.prevName !== undefined) {
      byPath.set(file.prevName, file);
    }
    for (const hunk of file.hunks) {
      additions += hunk.additionLines;
      deletions += hunk.deletionLines;
    }
  }

  const index = { files, byPath, names, counts: { additions, deletions } };
  indexCache.set(section, index);
  return index;
}
