import { normalizeTeams, normalizeUser, normalizeUsers } from "./normalization";

import type {
  GithubChecks,
  GithubComments,
  GithubLinkedIssues,
  GithubProjects,
  GithubPullRequestView,
  GithubRequestedReviewers,
  GithubReviews,
} from "./github-schemas";
import type {
  ForgeRepository,
  PullRequestCheck,
  PullRequestComment,
  PullRequestDetails,
  PullRequestLinkedIssue,
  PullRequestProject,
  PullRequestReview,
  PullRequestReviewComment,
  PullRequestReviewerRequests,
} from "./types";

type GithubComment = GithubComments[number];

export function normalizeDetails(
  payload: GithubPullRequestView,
  repository: ForgeRepository,
  number: number,
): PullRequestDetails {
  return {
    repository,
    number,
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

export function normalizeConversationComments(
  payload: GithubComments,
): readonly PullRequestComment[] {
  return payload.map(normalizeComment);
}

export function normalizeReviewComments(
  payload: GithubComments,
): readonly PullRequestReviewComment[] {
  return payload.map((comment) => ({
    ...normalizeComment(comment),
    path: comment.path ?? null,
  }));
}

export function normalizeReviews(
  payload: GithubReviews,
): readonly PullRequestReview[] {
  return payload.map((review) => ({
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
  commits: GithubChecks,
): readonly PullRequestCheck[] {
  const contexts =
    commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? [];
  return contexts.map((check) => ({
    name: check.name || check.context || "Unnamed check",
    status: check.status ?? check.state ?? "unknown",
    conclusion: check.conclusion ?? null,
    link: check.detailsUrl ?? check.targetUrl ?? null,
  }));
}

export function normalizeProjects(
  payload: GithubProjects,
): readonly PullRequestProject[] {
  return payload.projectItems.nodes.map((item) => ({
    title: item.project.title,
    status: item.fieldValueByName?.name || null,
  }));
}

export function normalizeLinkedIssues(
  issues: GithubLinkedIssues,
): readonly PullRequestLinkedIssue[] {
  return issues.nodes.map((issue) => ({
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
