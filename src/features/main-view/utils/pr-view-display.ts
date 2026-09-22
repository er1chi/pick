import {
  type ForgeSection,
  type PullRequestCheck,
  type PullRequestComment,
  type PullRequestCommit,
  type PullRequestDetails,
  type PullRequestLinkedIssue,
  type PullRequestProject,
  type PullRequestRef,
  type PullRequestReview,
  type PullRequestReviewComment,
  type PullRequestReviewerRequests,
  type PullRequestState,
  type PullRequestSummary,
} from "@/services/forge/types";
import { formatPresentTimestamp } from "@/utils/format-timestamp";
import { presentText } from "@/utils/present-text";
export { presentText };

export function persistentMetadataLines(
  details: PullRequestDetails,
): readonly string[] {
  const lines: string[] = [];
  pushPresent(lines, presentText(details.repository.url));
  pushPresent(lines, branchLine(details));
  pushPresent(lines, countsLine(details));
  pushPresent(lines, datesLine(details));
  pushPresent(lines, mergeabilityLine(details));
  return lines;
}

export function pullRequestTitleLine(
  title: string | null | undefined,
  number: number,
): string | undefined {
  const present = presentText(title);
  if (present === undefined) {
    return undefined;
  }
  return `${present} #${number}`;
}

export function presentRepositoryName(
  detailsName: string | null | undefined,
  fallback: string,
): string {
  return presentText(detailsName) ?? fallback;
}

export function isRenderableCollection<T>(
  section: ForgeSection<readonly T[]>,
): boolean {
  return isRenderableSection(section, isEmptyCollection);
}

export function isRenderableReviewerRequests(
  section: ForgeSection<PullRequestReviewerRequests>,
): boolean {
  return isRenderableSection(section, isEmptyReviewerRequests);
}

export function collectionAvailability<T>(
  section: ForgeSection<readonly T[]>,
): string {
  return sectionAvailability(section, (value) => `${value.length} available`);
}

export function reviewerAvailability(
  section: ForgeSection<PullRequestReviewerRequests>,
): string {
  return sectionAvailability(
    section,
    (value) => `${value.users.length} users, ${value.teams.length} teams`,
  );
}

export function reviewerNames(
  section: ForgeSection<PullRequestReviewerRequests>,
): string | undefined {
  if (section.status !== "available") {
    return undefined;
  }
  return joinPresent(reviewerNameList(section.value), ", ");
}

export function overviewMetaLine(
  summary: PullRequestSummary,
): string | undefined {
  const author = presentText(summary.author?.login);
  return joinPresent(
    [
      stateLabel(summary.state),
      summary.isDraft === true ? "Draft" : undefined,
      author === undefined ? undefined : `by ${author}`,
    ],
    " · ",
  );
}

export function commentMetaLine(
  comment: PullRequestComment,
): string | undefined {
  return joinPresent(
    [
      presentText(comment.author?.login),
      formatPresentTimestamp(comment.createdAt),
    ],
    " · ",
  );
}

export function commentBody(comment: PullRequestComment): string | undefined {
  return presentText(comment.body);
}

export function reviewMetaLine(review: PullRequestReview): string | undefined {
  return joinPresent(
    [
      presentText(review.state),
      presentText(review.author?.login),
      formatPresentTimestamp(review.submittedAt),
    ],
    " · ",
  );
}

export function reviewBody(review: PullRequestReview): string | undefined {
  return presentText(review.body);
}

export function reviewCommentMetaLine(
  comment: PullRequestReviewComment,
): string | undefined {
  return joinPresent(
    [presentText(comment.author?.login), presentText(comment.path)],
    " · ",
  );
}

export function commitMetaLine(
  commit: PullRequestCommit,
  counts?: { readonly additions: number; readonly deletions: number },
): string | undefined {
  const sha = presentText(commit.sha);
  return joinPresent(
    [
      sha === undefined ? undefined : sha.slice(0, 12),
      counts === undefined
        ? undefined
        : countsText(counts.additions, counts.deletions),
      presentText(commit.author?.login),
      formatPresentTimestamp(commit.committedAt),
    ],
    " · ",
  );
}

export function commitMessage(commit: PullRequestCommit): string | undefined {
  return presentText(commit.message);
}

export function checkLine(check: PullRequestCheck): string | undefined {
  const name = presentText(check.name);
  const details = joinPresent(
    [
      presentText(check.status),
      presentText(check.conclusion),
      presentText(check.link),
    ],
    " ",
  );
  if (name === undefined) {
    return details;
  }
  if (details === undefined) {
    return name;
  }
  return `${name}: ${details}`;
}

export function projectLine(project: PullRequestProject): string | undefined {
  return joinPresent(
    [presentText(project.title), presentText(project.status)],
    " · ",
  );
}

export function linkedIssueLine(issue: PullRequestLinkedIssue): string {
  return `${issue.repository}#${issue.number}`;
}

function stateLabel(state: PullRequestState): string {
  switch (state) {
    case "open":
      return "Open";
    case "closed":
      return "Closed";
    case "merged":
      return "Merged";
    case "unknown":
      return "Unknown";
    default:
      return "Unknown";
  }
}

function presentNumber(value: number | null | undefined): number | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  return value;
}

function countsText(
  additions: number | null | undefined,
  deletions: number | null | undefined,
): string | undefined {
  const presentAdditions = presentNumber(additions);
  const presentDeletions = presentNumber(deletions);
  const parts: string[] = [];
  if (presentAdditions !== undefined) {
    parts.push(`+${presentAdditions}`);
  }
  if (presentDeletions !== undefined) {
    parts.push(`-${presentDeletions}`);
  }
  return joinPresent(parts, " ");
}

function joinPresent(
  segments: readonly (string | undefined)[],
  separator: string,
): string | undefined {
  const present = segments.filter(isPresentText).map((value) => value.trim());
  if (present.length === 0) {
    return undefined;
  }
  return present.join(separator);
}

function isPresentText(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== "";
}

function pushPresent(lines: string[], value: string | undefined): void {
  if (value !== undefined) {
    lines.push(value);
  }
}

function refPart(ref: PullRequestRef): string | undefined {
  const name = presentText(ref.ref);
  const sha = presentText(ref.sha);
  if (sha === undefined) {
    return name;
  }

  const shortSha = sha.slice(0, 12);
  if (name === undefined) {
    return shortSha;
  }
  return `${name} (${shortSha})`;
}

function branchLine(details: PullRequestDetails): string | undefined {
  const base = refPart(details.base);
  const head = refPart(details.head);
  if (base === undefined) {
    return head;
  }
  if (head === undefined) {
    return base;
  }
  return `${base} <- ${head}`;
}

function countsLine(details: PullRequestDetails): string | undefined {
  return countsText(details.additions, details.deletions);
}

function dateSegment(
  label: string,
  value: string | null | undefined,
): string | undefined {
  const formatted = formatPresentTimestamp(value);
  if (formatted === undefined) {
    return undefined;
  }
  return `${label} ${formatted}`;
}

function datesLine(details: PullRequestDetails): string | undefined {
  return joinPresent(
    [
      dateSegment("Created", details.createdAt),
      dateSegment("Updated", details.updatedAt),
      dateSegment("Merged", details.mergedAt),
    ],
    " | ",
  );
}

function mergeableSegment(value: boolean | null): string | undefined {
  if (value === null) {
    return undefined;
  }
  if (value) {
    return "Mergeable yes";
  }
  return "Mergeable no";
}

function mergeStateSegment(value: string | null): string | undefined {
  const state = presentText(value);
  if (state === undefined) {
    return undefined;
  }
  return `state ${state}`;
}

function decisionSegment(value: string | null): string | undefined {
  const decision = presentText(value);
  return decision === undefined ? undefined : `decision ${decision}`;
}

function mergeabilityLine(details: PullRequestDetails): string | undefined {
  return joinPresent(
    [
      mergeableSegment(details.mergeability.mergeable),
      mergeStateSegment(details.mergeability.mergeState),
      decisionSegment(details.mergeability.reviewDecision),
    ],
    " | ",
  );
}

function reviewerNameList(
  value: PullRequestReviewerRequests,
): readonly string[] {
  return [
    ...value.users.map((user) => presentText(user.login)),
    ...value.teams.map((team) => presentText(team.name)),
  ].filter(isPresentText);
}

function isEmptyCollection<T>(value: readonly T[]): boolean {
  return value.length === 0;
}

function isEmptyReviewerRequests(value: PullRequestReviewerRequests): boolean {
  return reviewerNameList(value).length === 0;
}

function isRenderableSection<T>(
  section: ForgeSection<T>,
  isEmpty: (value: T) => boolean,
): boolean {
  switch (section.status) {
    case "available":
      return section.truncated || !isEmpty(section.value);
    case "unsupported":
    case "failed":
      return true;
  }
}

function sectionAvailability<T>(
  section: ForgeSection<T>,
  describeAvailable: (value: T) => string,
): string {
  switch (section.status) {
    case "available":
      if (section.truncated) {
        return `${describeAvailable(section.value)} (partial)`;
      }
      return describeAvailable(section.value);
    case "unsupported":
      return `unsupported — ${section.reason}`;
    case "failed":
      return `failed — ${section.error.message}`;
  }
}
