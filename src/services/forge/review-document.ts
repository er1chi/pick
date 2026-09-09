import { parsePatchFiles, type FileDiffMetadata } from "@pierre/diffs";
import type { GitStatusEntry } from "@pierre/trees";
import type { PullRequest, PullRequestFile } from "./types";

export interface PullRequestReviewFile {
  path: string;
  previousPath?: string;
  change: PullRequestFile;
  diff?: FileDiffMetadata;
}

export interface PullRequestReviewDocument {
  revisionKey: string;
  tree: {
    paths: readonly string[];
    gitStatus: readonly GitStatusEntry[];
  };
  files: readonly PullRequestReviewFile[];
}

function revisionKey(pullRequest: PullRequest): string {
  const { reference, changes } = pullRequest;
  return [
    reference.forge,
    reference.owner,
    reference.repository,
    String(reference.number),
    changes.revision.headSha,
  ].join(":");
}

export function createPullRequestReviewDocument(
  pullRequest: PullRequest,
): PullRequestReviewDocument {
  const key = revisionKey(pullRequest);
  const parsedDiffs = parsePatchFiles(
    pullRequest.changes.diff.text,
    key,
    true,
  ).flatMap((patch) => patch.files);
  const diffByPath = new Map(parsedDiffs.map((diff) => [diff.name, diff]));
  const files = pullRequest.changes.files.map((change) => ({
    path: change.path,
    previousPath: change.previousPath,
    change,
    diff: diffByPath.get(change.path),
  }));

  return {
    revisionKey: key,
    tree: {
      paths: files.map((file) => file.path),
      gitStatus: files.map(({ change }) => ({
        path: change.path,
        status: change.status,
      })),
    },
    files,
  };
}
