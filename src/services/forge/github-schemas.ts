import { type } from "arktype";
import {
  commitSchema,
  optionalNullableString,
  optionalNumber,
  optionalUser,
  safeIntegerSchema,
  teamSchema,
  userSchema,
} from "./schema-primitives";

export const repositorySchema = type({
  nameWithOwner: "string",
  url: optionalNullableString,
});

const optionalUnknown = type("unknown").optional();

/** The `gh pr view --json` fields read from the payload. */
export const pullRequestViewFields = [
  "number",
  "body",
  "createdAt",
  "updatedAt",
  "mergedAt",
  "baseRefName",
  "baseRefOid",
  "headRefName",
  "headRefOid",
  "additions",
  "deletions",
  "mergeable",
  "mergeStateStatus",
  "reviewDecision",
  "statusCheckRollup",
  "projectItems",
  "closingIssuesReferences",
].join(",");

/** Optional sections stay `unknown` here and are parsed separately, so a
 * checks or projects mismatch cannot fail details. */
export const pullRequestViewSchema = type({
  number: safeIntegerSchema,
  body: optionalNullableString,
  createdAt: optionalNullableString,
  updatedAt: optionalNullableString,
  mergedAt: optionalNullableString,
  baseRefName: optionalNullableString,
  baseRefOid: optionalNullableString,
  headRefName: optionalNullableString,
  headRefOid: optionalNullableString,
  additions: optionalNumber,
  deletions: optionalNumber,
  mergeable: optionalNullableString,
  mergeStateStatus: optionalNullableString,
  reviewDecision: optionalNullableString,
  statusCheckRollup: optionalUnknown,
  projectItems: optionalUnknown,
  closingIssuesReferences: optionalUnknown,
});

export const listItemSchema = type({
  number: safeIntegerSchema,
  title: "string",
  state: "string",
  isDraft: type("boolean | null").optional(),
  author: optionalUser,
});

const commentSchema = type({
  user: optionalUser,
  body: optionalNullableString,
  created_at: optionalNullableString,
  path: optionalNullableString,
});
const reviewSchema = type({
  user: optionalUser,
  body: optionalNullableString,
  state: "string",
  submitted_at: optionalNullableString,
});
export const requestedReviewersSchema = type({
  users: userSchema.array(),
  teams: teamSchema.array(),
});

/** A `statusCheckRollup` entry: a CheckRun (`name`, `status`, `detailsUrl`)
 * or a StatusContext (`context`, `state`, `targetUrl`). */
export const checkSchema = type({
  name: optionalNullableString,
  context: optionalNullableString,
  status: optionalNullableString,
  state: optionalNullableString,
  conclusion: optionalNullableString,
  detailsUrl: optionalNullableString,
  targetUrl: optionalNullableString,
});

/** `gh` exports a project item as only its project title and Status field. */
export const projectItemSchema = type({
  title: "string",
  status: type({ name: optionalNullableString }).or("null").optional(),
});

/** `gh` exports a closing issue reference without its title or state. */
export const linkedIssueSchema = type({
  number: safeIntegerSchema,
  repository: type({
    name: "string",
    owner: type({ login: "string" }),
  }),
});

export const commitPagesSchema = commitSchema.array().array();
export const commentPagesSchema = commentSchema.array().array();
export const reviewPagesSchema = reviewSchema.array().array();

export type GithubRepositoryPayload = typeof repositorySchema.infer;
export type GithubPullRequestView = typeof pullRequestViewSchema.infer;
export type GithubListItem = typeof listItemSchema.infer;
export type GithubCommitPages = typeof commitPagesSchema.infer;
export type GithubCommentPages = typeof commentPagesSchema.infer;
export type GithubReviewPages = typeof reviewPagesSchema.infer;
export type GithubRequestedReviewers = typeof requestedReviewersSchema.infer;
export type GithubCheck = typeof checkSchema.infer;
export type GithubProjectItem = typeof projectItemSchema.infer;
export type GithubLinkedIssue = typeof linkedIssueSchema.infer;
