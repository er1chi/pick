import { type } from "arktype";
import * as schemaPrimitives from "./schema-primitives";

const userSchema = type({
  login: "string",
  id: schemaPrimitives.optionalIdentifier,
  name: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const teamSchema = type({
  name: "string",
  id: schemaPrimitives.optionalIdentifier,
  slug: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
export const repositorySchema = type({
  nameWithOwner: "string",
  url: schemaPrimitives.optionalNullableString,
});
const labelSchema = type({
  name: "string",
  id: schemaPrimitives.optionalIdentifier,
  color: schemaPrimitives.optionalNullableString,
  description: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const milestoneSchema = type({
  title: "string",
  id: schemaPrimitives.optionalIdentifier,
  description: schemaPrimitives.optionalNullableString,
  state: schemaPrimitives.optionalNullableString,
  dueOn: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const mergeCommitSchema = type({ oid: "string" });

export const overviewSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  body: schemaPrimitives.optionalNullableString,
});
const optionalUnknown = type("unknown").optional();

export const detailsSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  createdAt: schemaPrimitives.optionalDate,
  updatedAt: schemaPrimitives.optionalDate,
  closedAt: schemaPrimitives.optionalDate,
  mergedAt: schemaPrimitives.optionalDate,
  mergedBy: userSchema.or("null").optional(),
  baseRefName: schemaPrimitives.optionalNullableString,
  baseRefOid: schemaPrimitives.optionalNullableString,
  headRefName: schemaPrimitives.optionalNullableString,
  headRefOid: schemaPrimitives.optionalNullableString,
  headRepository: repositorySchema.or("null").optional(),
  additions: schemaPrimitives.optionalNumber,
  deletions: schemaPrimitives.optionalNumber,
  changedFiles: schemaPrimitives.optionalNumber,
  labels: labelSchema.array(),
  assignees: userSchema.array(),
  milestone: milestoneSchema.or("null"),
  maintainerCanModify: type("boolean | null").optional(),
  mergeable: schemaPrimitives.optionalNullableString,
  mergeStateStatus: schemaPrimitives.optionalNullableString,
  reviewDecision: schemaPrimitives.optionalNullableString,
  mergeCommit: mergeCommitSchema.or("null").optional(),
});

/** One `gh pr view --json` payload. Optional sections stay `unknown` so a
 * checks or projects mismatch cannot fail details. */
export const pullRequestViewSchema = type.and(
  detailsSchema,
  overviewSchema,
  type({
    statusCheckRollup: optionalUnknown,
    projectItems: optionalUnknown,
    projectCards: optionalUnknown,
    closingIssuesReferences: optionalUnknown,
  }),
);

export const listItemSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  title: "string",
  state: "string",
  isDraft: type("boolean | null").optional(),
  author: userSchema.or("null").optional(),
  url: schemaPrimitives.optionalNullableString,
  updatedAt: schemaPrimitives.optionalDate,
});

const gitIdentitySchema = type({
  name: schemaPrimitives.optionalNullableString,
  email: schemaPrimitives.optionalNullableString,
  date: schemaPrimitives.optionalDate,
});
const commitSchema = type({
  sha: "string",
  commit: type({
    message: "string",
    author: gitIdentitySchema.or("null").optional(),
    committer: gitIdentitySchema.or("null").optional(),
  }),
  author: userSchema.or("null").optional(),
  committer: userSchema.or("null").optional(),
  html_url: schemaPrimitives.optionalNullableString,
  url: schemaPrimitives.optionalNullableString,
});
const commentSchema = type({
  id: type("number | string"),
  user: userSchema.or("null").optional(),
  body: schemaPrimitives.optionalNullableString,
  created_at: schemaPrimitives.optionalDate,
  updated_at: schemaPrimitives.optionalDate,
  html_url: schemaPrimitives.optionalNullableString,
  path: schemaPrimitives.optionalNullableString,
  line: schemaPrimitives.optionalNumber,
  start_line: schemaPrimitives.optionalNumber,
  side: schemaPrimitives.optionalNullableString,
  commit_id: schemaPrimitives.optionalNullableString,
  in_reply_to_id: schemaPrimitives.optionalIdentifier,
  pull_request_review_id: schemaPrimitives.optionalIdentifier,
});
const reviewSchema = type({
  id: type("number | string"),
  user: userSchema.or("null").optional(),
  body: schemaPrimitives.optionalNullableString,
  state: "string",
  submitted_at: schemaPrimitives.optionalDate,
  commit_id: schemaPrimitives.optionalNullableString,
  html_url: schemaPrimitives.optionalNullableString,
});
export const requestedReviewersSchema = type({
  users: userSchema.array(),
  teams: teamSchema.array(),
});
const checkSchema = type({
  name: schemaPrimitives.optionalNullableString,
  context: schemaPrimitives.optionalNullableString,
  status: schemaPrimitives.optionalNullableString,
  state: schemaPrimitives.optionalNullableString,
  conclusion: schemaPrimitives.optionalNullableString,
  description: schemaPrimitives.optionalNullableString,
  detailsUrl: schemaPrimitives.optionalNullableString,
  targetUrl: schemaPrimitives.optionalNullableString,
  link: schemaPrimitives.optionalNullableString,
  startedAt: schemaPrimitives.optionalDate,
  completedAt: schemaPrimitives.optionalDate,
  workflowName: schemaPrimitives.optionalNullableString,
  workflow: schemaPrimitives.optionalNullableString,
});
const projectItemSchema = type({
  id: "string",
  title: "string",
  number: schemaPrimitives.optionalNumber,
  url: schemaPrimitives.optionalNullableString,
  state: schemaPrimitives.optionalNullableString,
});
const projectCardSchema = type({
  id: type("number | string"),
  project: type({
    id: type("number | string"),
    name: "string",
    number: schemaPrimitives.optionalNumber,
    html_url: schemaPrimitives.optionalNullableString,
    state: schemaPrimitives.optionalNullableString,
  }),
});
const linkedIssueSchema = type({
  number: schemaPrimitives.safeIntegerSchema,
  title: schemaPrimitives.optionalNullableString,
  state: "string",
  url: schemaPrimitives.optionalNullableString,
  repository: repositorySchema.or("null").optional(),
});

export const commitPagesSchema = commitSchema.array().array();
export const commentPagesSchema = commentSchema.array().array();
export const reviewPagesSchema = reviewSchema.array().array();
export const checksResponseSchema = type({
  statusCheckRollup: checkSchema.array(),
});
export const projectsResponseSchema = type({
  projectItems: projectItemSchema.array().or("null").optional(),
  projectCards: projectCardSchema.array().or("null").optional(),
});
export const linkedIssuesResponseSchema = type({
  closingIssuesReferences: linkedIssueSchema.array(),
});

export type GithubRepositoryPayload = typeof repositorySchema.infer;
export type GithubOverviewPayload = typeof overviewSchema.infer;
export type GithubDetailsPayload = typeof detailsSchema.infer;
export type GithubPullRequestView = typeof pullRequestViewSchema.infer;
export type GithubListItem = typeof listItemSchema.infer;
export type GithubCommitPages = typeof commitPagesSchema.infer;
export type GithubCommentPages = typeof commentPagesSchema.infer;
export type GithubReviewPages = typeof reviewPagesSchema.infer;
export type GithubRequestedReviewers = typeof requestedReviewersSchema.infer;
export type GithubChecksResponse = typeof checksResponseSchema.infer;
export type GithubProjectsResponse = typeof projectsResponseSchema.infer;
export type GithubLinkedIssuesResponse =
  typeof linkedIssuesResponseSchema.infer;
