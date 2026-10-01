import { Result } from "better-result";
import { ForgeIncompatibleResponseError, PullRequestState } from "./types";

import type {
  CommitPayload,
  PullSummaryPayload,
  TeamPayload,
  UserPayload,
} from "./schema-primitives";
import type {
  ForgeKind,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  ForgeTeam,
  ForgeUser,
  PullRequestComment,
  PullRequestCommit,
  PullRequestSummary,
} from "./types";

export function normalizeRepository(
  kind: ForgeKind,
  fullName: string,
  url: string | null | undefined,
): Result<ForgeRepository, ForgeOperationError> {
  const [owner, name, ...rest] = fullName.split("/");
  if (
    owner === undefined ||
    name === undefined ||
    rest.length > 0 ||
    owner.length === 0 ||
    name.length === 0 ||
    /\s/u.test(fullName)
  ) {
    return incompatible(
      kind,
      `Repository identity is not owner/repo: ${fullName}`,
    );
  }

  return Result.ok({ fullName, owner, name, url: url ?? null });
}

export function normalizeSummary(
  payload: PullSummaryPayload,
): PullRequestSummary {
  return {
    number: payload.number,
    title: payload.title,
    state: normalizeState(payload.state, (payload.merged_at ?? null) !== null),
    isDraft: payload.draft ?? null,
    author: normalizeUser(payload.user),
  };
}

export function normalizeUser(
  payload: UserPayload | null | undefined,
): ForgeUser | null {
  return payload === null || payload === undefined
    ? null
    : { login: payload.login };
}

export function normalizeUsers(
  payloads: readonly UserPayload[] | null | undefined,
): readonly ForgeUser[] {
  return (payloads ?? []).map((payload) => ({ login: payload.login }));
}

export function normalizeTeams(
  payloads: readonly TeamPayload[] | null | undefined,
): readonly ForgeTeam[] {
  return (payloads ?? []).map((payload) => ({ name: payload.name }));
}

export function normalizeCommit(payload: CommitPayload): PullRequestCommit {
  return {
    sha: payload.sha,
    message: payload.commit.message,
    author: normalizeUser(payload.author),
    committer: normalizeUser(payload.committer),
    authoredAt: payload.commit.author?.date ?? null,
    committedAt: payload.commit.committer?.date ?? null,
    url: payload.html_url ?? null,
  };
}

/** Marks comments as truncated when the forge reports more than it returned. */
export function withExpectedCommentCount(
  section: ForgeSection<readonly PullRequestComment[]>,
  expectedCount: number | null,
): ForgeSection<readonly PullRequestComment[]> {
  if (section.status !== "available" || expectedCount === null) {
    return section;
  }
  return {
    ...section,
    truncated: section.value.length < expectedCount,
  };
}

function normalizeState(state: string, merged: boolean): PullRequestState {
  if (merged) {
    return PullRequestState.Merged;
  }
  if (state.toLowerCase() === "open") {
    return PullRequestState.Open;
  }
  if (state.toLowerCase() === "closed") {
    return PullRequestState.Closed;
  }
  return PullRequestState.Unknown;
}

function incompatible<T>(
  kind: ForgeKind,
  message: string,
): Result<T, ForgeOperationError> {
  return Result.err(new ForgeIncompatibleResponseError({ kind, message }));
}
