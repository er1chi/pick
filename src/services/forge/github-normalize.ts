import {
  normalizeGithubState,
  normalizeRepository,
  normalizeTeams,
  normalizeUser,
  normalizeUsers,
} from "./normalization";
import { ForgeKind } from "./types";

import type { Result as ResultType } from "better-result";
import type {
  GithubCheck,
  GithubCommentPages,
  GithubCommitPages,
  GithubLinkedIssue,
  GithubListItem,
  GithubProjectItem,
  GithubPullRequestView,
  GithubRepositoryPayload,
  GithubRequestedReviewers,
  GithubReviewPages,
} from "./github-schemas";
import type {
  ForgeOperationError,
  ForgeRepository,
  PullRequestCheck,
  PullRequestComment,
  PullRequestCommit,
  PullRequestDetails,
  PullRequestLinkedIssue,
  PullRequestProject,
  PullRequestReview,
  PullRequestReviewComment,
  PullRequestReviewerRequests,
  PullRequestSummary,
} from "./types";

type GithubComment = GithubCommentPages[number][number];

export function normalizeRepositoryPayload(
  payload: GithubRepositoryPayload,
): ResultType<ForgeRepository, ForgeOperationError> {
  return normalizeRepository(
    ForgeKind.GitHub,
    payload.nameWithOwner,
    payload.url,
  );
}

export function normalizeSummary(payload: GithubListItem): PullRequestSummary {
  return {
    number: payload.number,
    title: payload.title,
    state: normalizeGithubState(payload.state),
    isDraft: payload.isDraft ?? null,
    author: normalizeUser(payload.author),
  };
}

export function normalizeDetails(
  payload: GithubPullRequestView,
  repository: ForgeRepository,
): PullRequestDetails {
  return {
    repository,
    number: payload.number,
    body: payload.body ?? null,
    createdAt: payload.createdAt ?? null,
    updatedAt: payload.updatedAt ?? null,
    mergedAt: payload.mergedAt ?? null,
    base: { ref: payload.baseRefName ?? null, sha: payload.baseRefOid ?? null },
    head: { ref: payload.headRefName ?? null, sha: payload.headRefOid ?? null },
    additions: payload.additions ?? null,
    deletions: payload.deletions ?? null,
    mergeability: {
      mergeable: normalizeMergeable(payload.mergeable),
      mergeState: payload.mergeStateStatus ?? null,
      reviewDecision: payload.reviewDecision || null,
    },
  };
}

export function normalizeCommits(
  payload: GithubCommitPages,
): readonly PullRequestCommit[] {
  return payload.flat().map((commit) => ({
    sha: commit.sha,
    message: commit.commit.message,
    author: normalizeUser(commit.author),
    committer: normalizeUser(commit.committer),
    authoredAt: commit.commit.author?.date ?? null,
    committedAt: commit.commit.committer?.date ?? null,
    url: commit.html_url ?? null,
  }));
}

export function normalizeConversationComments(
  payload: GithubCommentPages,
): readonly PullRequestComment[] {
  return payload.flat().map(normalizeComment);
}

export function normalizeReviewComments(
  payload: GithubCommentPages,
): readonly PullRequestReviewComment[] {
  return payload.flat().map((comment) => ({
    ...normalizeComment(comment),
    path: comment.path ?? null,
  }));
}

export function normalizeReviews(
  payload: GithubReviewPages,
): readonly PullRequestReview[] {
  return payload.flat().map((review) => ({
    author: normalizeUser(review.user),
    body: review.body ?? null,
    state: review.state,
    submittedAt: review.submitted_at ?? null,
  }));
}

export function normalizeRequestedReviewers(
  payload: GithubRequestedReviewers,
): PullRequestReviewerRequests {
  return {
    users: normalizeUsers(payload.users),
    teams: normalizeTeams(payload.teams),
  };
}

export function normalizeChecks(
  checks: readonly GithubCheck[],
): readonly PullRequestCheck[] {
  return checks.map((check) => ({
    name: check.name || check.context || "Unnamed check",
    status: check.status ?? check.state ?? "unknown",
    conclusion: check.conclusion ?? null,
    link: check.detailsUrl ?? check.targetUrl ?? null,
  }));
}

export function normalizeProjects(
  projectItems: readonly GithubProjectItem[],
): readonly PullRequestProject[] {
  return projectItems.map((project) => ({
    title: project.title,
    status: project.status?.name || null,
  }));
}

export function normalizeLinkedIssues(
  issues: readonly GithubLinkedIssue[],
): readonly PullRequestLinkedIssue[] {
  return issues.map((issue) => ({
    repository: `${issue.repository.owner.login}/${issue.repository.name}`,
    number: issue.number,
  }));
}

function normalizeMergeable(value: string | null | undefined): boolean | null {
  if (value === "MERGEABLE") {
    return true;
  }
  if (value === "CONFLICTING") {
    return false;
  }
  return null;
}

function normalizeComment(comment: GithubComment): PullRequestComment {
  return {
    author: normalizeUser(comment.user),
    body: comment.body ?? null,
    createdAt: comment.created_at ?? null,
  };
}
