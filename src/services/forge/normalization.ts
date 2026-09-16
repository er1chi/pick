import { Result } from "better-result";
import {
  ForgeOperationErrorCode,
  ForgeUnsupportedReasonCode,
  PullRequestState,
} from "./types";
import type {
  ForgeKind,
  ForgeOperationError,
  ForgeRepository,
  ForgeSection,
  ForgeTeam,
  ForgeUnsupportedReason,
  ForgeUser,
  PullRequestComment,
  PullRequestLabel,
  PullRequestMilestone,
  PullRequestOverview,
  PullRequestSummary,
} from "./types";

export interface ForgeUserPayload {
  readonly id?: number | string | null;
  readonly login: string;
  readonly name?: string | null;
  readonly full_name?: string | null;
  readonly html_url?: string | null;
  readonly url?: string | null;
}

export interface ForgeTeamPayload {
  readonly id?: number | string | null;
  readonly name: string;
  readonly slug?: string | null;
  readonly html_url?: string | null;
  readonly url?: string | null;
}

export interface ForgeLabelPayload {
  readonly id?: number | string | null;
  readonly name: string;
  readonly color?: string | null;
  readonly description?: string | null;
  readonly url?: string | null;
}

export interface ForgeMilestonePayload {
  readonly id?: number | string | null;
  readonly title: string;
  readonly description?: string | null;
  readonly state?: string | null;
  readonly dueAt?: string | null;
  readonly url?: string | null;
}

export function normalizeRepository(
  kind: ForgeKind,
  fullName: string,
  url: string | null | undefined,
): Result<ForgeRepository, ForgeOperationError> {
  const parts = fullName.trim().split("/");
  if (
    parts.length !== 2 ||
    parts[0] === undefined ||
    parts[1] === undefined ||
    parts[0].length === 0 ||
    parts[1].length === 0 ||
    /\s/u.test(fullName)
  ) {
    return Result.err({
      kind,
      code: ForgeOperationErrorCode.IncompatibleResponse,
      diagnostic: `Repository identity is not owner/repo: ${fullName}`,
    });
  }

  return Result.ok({
    fullName: `${parts[0]}/${parts[1]}`,
    owner: parts[0],
    name: parts[1],
    url: url ?? null,
  });
}

export function normalizeIdentifier(
  value: number | string | null | undefined,
): string | null {
  return value === null || value === undefined ? null : String(value);
}

export function normalizeUser(
  payload: ForgeUserPayload | null | undefined,
): ForgeUser | null {
  if (payload === null || payload === undefined) {
    return null;
  }

  return {
    id: normalizeIdentifier(payload.id),
    login: payload.login,
    displayName: payload.name ?? payload.full_name ?? null,
    url: payload.html_url ?? payload.url ?? null,
  };
}

export function normalizeTeam(
  payload: ForgeTeamPayload | null | undefined,
): ForgeTeam | null {
  if (payload === null || payload === undefined) {
    return null;
  }

  return {
    id: normalizeIdentifier(payload.id),
    name: payload.name,
    slug: payload.slug ?? null,
    url: payload.html_url ?? payload.url ?? null,
  };
}

export function assemblePullRequestOverview(
  repository: ForgeRepository,
  fields: Pick<PullRequestOverview, "number" | "body">,
  conversationComments: ForgeSection<readonly PullRequestComment[]>,
): PullRequestOverview {
  return { repository, ...fields, conversationComments };
}

export function addCommentTruncation(
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

export function createPullRequestSummary(
  number: number,
  title: string,
  state: PullRequestState,
  isDraft: boolean | null,
  author: ForgeUser | null,
  updatedAt: string | null,
  url: string | null,
): PullRequestSummary {
  return { number, title, state, isDraft, author, updatedAt, url };
}

export function normalizeLabel(payload: ForgeLabelPayload): PullRequestLabel {
  return {
    id: normalizeIdentifier(payload.id),
    name: payload.name,
    color: payload.color ?? null,
    description: payload.description ?? null,
    url: payload.url ?? null,
  };
}

export function normalizeMilestone(
  payload: ForgeMilestonePayload | null | undefined,
): PullRequestMilestone | null {
  if (payload === null || payload === undefined) {
    return null;
  }
  return {
    id: normalizeIdentifier(payload.id),
    title: payload.title,
    description: payload.description ?? null,
    state: payload.state ?? null,
    dueAt: payload.dueAt ?? null,
    url: payload.url ?? null,
  };
}

export function normalizeState(
  state: string,
  merged: boolean,
): PullRequestState {
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

export function normalizeGithubState(
  state: string,
  mergedAt: string | Date | null | undefined,
): PullRequestState {
  if (
    (mergedAt !== null && mergedAt !== undefined) ||
    state.toLowerCase() === "merged"
  ) {
    return PullRequestState.Merged;
  }
  return normalizeState(state, false);
}

export function normalizeDate(
  value: Date | string | null | undefined,
): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return value instanceof Date ? value.toISOString() : value;
}

export function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

export function available<T>(value: T, truncated = false): ForgeSection<T> {
  return { status: "available", value, truncated };
}

export function unsupported<T>(
  code: ForgeUnsupportedReasonCode,
  diagnostic: string,
): ForgeSection<T> {
  const reason: ForgeUnsupportedReason = { code, diagnostic };
  return { status: "unsupported", reason };
}

export function failed<T>(error: ForgeOperationError): ForgeSection<T> {
  return { status: "failed", error };
}

export function incompatible<T>(
  kind: ForgeKind,
  diagnostic: string,
): Result<T, ForgeOperationError> {
  return Result.err({
    kind,
    code: ForgeOperationErrorCode.IncompatibleResponse,
    diagnostic,
  });
}

export function invalidRequest<T>(
  kind: ForgeKind,
  diagnostic: string,
): Result<T, ForgeOperationError> {
  return Result.err({
    kind,
    code: ForgeOperationErrorCode.InvalidRequest,
    diagnostic,
  });
}

export function validatePullRequestNumber(
  kind: ForgeKind,
  number: number,
): Result<number, ForgeOperationError> {
  if (!Number.isSafeInteger(number) || number <= 0) {
    return invalidRequest(
      kind,
      "Pull request number must be a positive safe integer",
    );
  }
  return Result.ok(number);
}
