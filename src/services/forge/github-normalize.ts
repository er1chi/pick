import { Result } from "better-result";
import {
  incompatible,
  normalizeDate,
  normalizeGithubState,
  normalizeIdentifier,
  normalizeLabel,
  normalizeMilestone,
  normalizeRepository,
  normalizeTeams,
  normalizeUser,
  normalizeUsers,
} from "./normalization";
import { available } from "./section";
import { ApplicationContext } from "./types";

import type { Result as ResultType } from "better-result";
import type {
  GithubCheck,
  GithubCommentPages,
  GithubCommitPages,
  GithubDetailsPayload,
  GithubLinkedIssue,
  GithubListItem,
  GithubProjectCard,
  GithubProjectItem,
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
  PullRequestOverview,
  PullRequestProject,
  PullRequestReview,
  PullRequestReviewComment,
  PullRequestReviewerRequests,
  PullRequestSummary,
} from "./types";

const kind = ApplicationContext.GitHub;

export type GithubOverviewFields = Pick<PullRequestOverview, "number" | "body">;

export function normalizeRepositoryPayload(
  payload: GithubRepositoryPayload,
): ResultType<ForgeRepository, ForgeOperationError> {
  return normalizeRepository(kind, payload.nameWithOwner, payload.url);
}

export function normalizeListPayload(
  payload: readonly GithubListItem[],
): ResultType<readonly PullRequestSummary[], ForgeOperationError> {
  return Result.ok(payload.map(normalizeSummary));
}

export function normalizeDetails(
  payload: GithubDetailsPayload,
  repository: ForgeRepository,
  expectedNumber: number,
): ResultType<PullRequestDetails, ForgeOperationError> {
  if (payload.number !== expectedNumber) {
    return incompatible(
      kind,
      `GitHub pull request details number did not match ${expectedNumber}`,
    );
  }

  const headRepository = payload.headRepository;
  const normalizedHeadRepository =
    headRepository === null || headRepository === undefined
      ? Result.ok<ForgeRepository | null, ForgeOperationError>(null)
      : normalizeRepository(
          kind,
          headRepository.nameWithOwner,
          headRepository.url,
        );
  if (normalizedHeadRepository.isErr()) {
    return Result.err(normalizedHeadRepository.error);
  }

  return Result.ok({
    repository,
    number: payload.number,
    createdAt: normalizeDate(payload.createdAt),
    updatedAt: normalizeDate(payload.updatedAt),
    closedAt: normalizeDate(payload.closedAt),
    mergedAt: normalizeDate(payload.mergedAt),
    mergedBy: normalizeUser(payload.mergedBy),
    base: {
      ref: payload.baseRefName ?? null,
      sha: payload.baseRefOid ?? null,
      repository,
    },
    head: {
      ref: payload.headRefName ?? null,
      sha: payload.headRefOid ?? null,
      repository: normalizedHeadRepository.value,
    },
    counts: {
      additions: payload.additions ?? null,
      deletions: payload.deletions ?? null,
      changedFiles: payload.changedFiles ?? null,
      conversationComments: null,
      reviewComments: null,
    },
    labels: (payload.labels ?? []).map(normalizeLabel),
    assignees: normalizeUsers(payload.assignees),
    milestone:
      payload.milestone === null
        ? null
        : normalizeMilestone({
            ...payload.milestone,
            dueAt: payload.milestone.dueOn,
          }),
    maintainerCanModify: payload.maintainerCanModify ?? null,
    mergeability: {
      mergeable: normalizeMergeable(payload.mergeable),
      mergeState: payload.mergeStateStatus ?? null,
      reviewDecision: available(payload.reviewDecision ?? null),
      mergeCommitSha: payload.mergeCommit?.oid ?? null,
    },
  });
}

export function normalizeCommits(
  payload: GithubCommitPages,
): ResultType<readonly PullRequestCommit[], ForgeOperationError> {
  return Result.ok(
    payload.flat().map((commit) => ({
      sha: commit.sha,
      message: commit.commit.message,
      author: normalizeUser(commit.author),
      committer: normalizeUser(commit.committer),
      authoredAt: normalizeDate(commit.commit.author?.date),
      committedAt: normalizeDate(commit.commit.committer?.date),
      url: commit.html_url ?? commit.url ?? null,
    })),
  );
}

export function normalizeConversationComments(
  payload: GithubCommentPages,
): ResultType<readonly PullRequestComment[], ForgeOperationError> {
  return Result.ok(payload.flat().map(normalizeCommentBase));
}

export function normalizeReviewComments(
  payload: GithubCommentPages,
): ResultType<readonly PullRequestReviewComment[], ForgeOperationError> {
  return Result.ok(
    payload.flat().map((comment) => ({
      ...normalizeCommentBase(comment),
      location:
        comment.path === null || comment.path === undefined
          ? null
          : {
              path: comment.path,
              line: comment.line ?? null,
              startLine: comment.start_line ?? null,
              side: normalizeCommentSide(comment.side),
              commitSha: comment.commit_id ?? null,
            },
      replyToId: normalizeIdentifier(comment.in_reply_to_id),
      reviewId: normalizeIdentifier(comment.pull_request_review_id),
    })),
  );
}

export function normalizeReviews(
  payload: GithubReviewPages,
): ResultType<readonly PullRequestReview[], ForgeOperationError> {
  return Result.ok(
    payload.flat().map((review) => ({
      id: String(review.id),
      author: normalizeUser(review.user),
      body: review.body ?? null,
      state: review.state,
      submittedAt: normalizeDate(review.submitted_at),
      commitSha: review.commit_id ?? null,
      url: review.html_url ?? null,
    })),
  );
}

export function normalizeRequestedReviewers(
  payload: GithubRequestedReviewers,
): ResultType<PullRequestReviewerRequests, ForgeOperationError> {
  return Result.ok({
    users: normalizeUsers(payload.users),
    teams: normalizeTeams(payload.teams),
  });
}

export function normalizeChecks(
  checks: readonly GithubCheck[],
): ResultType<readonly PullRequestCheck[], ForgeOperationError> {
  const normalized: PullRequestCheck[] = [];
  for (const check of checks) {
    const name = check.name ?? check.context;
    if (name === null || name === undefined || name.length === 0) {
      return incompatible(kind, "GitHub check response did not include a name");
    }
    normalized.push({
      name,
      status: check.status ?? check.state ?? "unknown",
      conclusion: check.conclusion ?? null,
      description: check.description ?? null,
      link: check.detailsUrl ?? check.targetUrl ?? check.link ?? null,
      startedAt: normalizeDate(check.startedAt),
      completedAt: normalizeDate(check.completedAt),
      workflow: check.workflowName ?? check.workflow ?? null,
    });
  }
  return Result.ok(normalized);
}

export function normalizeProjects(
  projectItems: readonly GithubProjectItem[] | null | undefined,
  projectCards: readonly GithubProjectCard[] | null | undefined,
): ResultType<readonly PullRequestProject[], ForgeOperationError> {
  const projects: PullRequestProject[] = [];
  for (const project of projectItems ?? []) {
    projects.push({
      id: project.id,
      title: project.title,
      number: project.number ?? null,
      url: project.url ?? null,
      state: project.state ?? null,
      kind: "v2",
    });
  }
  for (const card of projectCards ?? []) {
    projects.push({
      id: String(card.project.id),
      title: card.project.name,
      number: card.project.number ?? null,
      url: card.project.html_url ?? null,
      state: card.project.state ?? null,
      kind: "classic",
    });
  }
  return Result.ok(projects);
}

export function normalizeLinkedIssues(
  issues: readonly GithubLinkedIssue[],
  repository: ForgeRepository,
): ResultType<readonly PullRequestLinkedIssue[], ForgeOperationError> {
  const normalized: PullRequestLinkedIssue[] = [];
  for (const issue of issues) {
    let issueRepository = repository;
    if (issue.repository !== null && issue.repository !== undefined) {
      const normalizedRepository = normalizeRepository(
        kind,
        issue.repository.nameWithOwner,
        issue.repository.url,
      );
      if (normalizedRepository.isErr()) {
        return Result.err(normalizedRepository.error);
      }
      issueRepository = normalizedRepository.value;
    }
    normalized.push({
      repository: issueRepository,
      number: issue.number,
      title: issue.title ?? null,
      state: normalizeGithubState(issue.state),
      url: issue.url ?? null,
      relation: "closing-reference",
    });
  }
  return Result.ok(normalized);
}

function normalizeSummary(payload: GithubListItem): PullRequestSummary {
  return {
    number: payload.number,
    title: payload.title,
    state: normalizeGithubState(payload.state),
    isDraft: payload.isDraft ?? null,
    author: normalizeUser(payload.author),
    updatedAt: normalizeDate(payload.updatedAt),
    url: payload.url ?? null,
  };
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

function normalizeCommentBase(
  comment: GithubCommentPages[number][number],
): PullRequestComment {
  return {
    id: String(comment.id),
    author: normalizeUser(comment.user),
    body: comment.body ?? null,
    createdAt: normalizeDate(comment.created_at),
    updatedAt: normalizeDate(comment.updated_at),
    url: comment.html_url ?? null,
  };
}

function normalizeCommentSide(
  side: string | null | undefined,
): "additions" | "deletions" | "unknown" {
  if (side === "RIGHT") {
    return "additions";
  }
  if (side === "LEFT") {
    return "deletions";
  }
  return "unknown";
}
