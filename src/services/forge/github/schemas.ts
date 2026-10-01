import { type } from "arktype";
import {
  commitSchema,
  optionalNullableString,
  optionalNumber,
  optionalUser,
  safeIntegerSchema,
  teamSchema,
  userSchema,
} from "../schema-primitives";

const optionalUnknown = type("unknown").optional();

/** Checks and linked issues stay `unknown` here and are parsed separately, so
 * a mismatch in either cannot fail details. */
export const pullRequestViewSchema = type({
  repository: type({
    pullRequest: type({
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
      commits: optionalUnknown,
      closingIssuesReferences: optionalUnknown,
    }),
  }),
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

/** A status check rollup entry: a CheckRun (`name`, `status`, `detailsUrl`)
 * or a StatusContext (`context`, `state`, `targetUrl`). */
const checkSchema = type({
  name: optionalNullableString,
  context: optionalNullableString,
  status: optionalNullableString,
  state: optionalNullableString,
  conclusion: optionalNullableString,
  detailsUrl: optionalNullableString,
  targetUrl: optionalNullableString,
});

/** The checks of the head commit, the last of the pull request's commits. */
export const checksSchema = type({
  nodes: type({
    commit: type({
      statusCheckRollup: type({
        contexts: type({ nodes: checkSchema.array() }),
      }).or("null"),
    }),
  }).array(),
});

export const pullRequestProjectsSchema = type({
  repository: type({
    pullRequest: type({
      projectItems: type({
        nodes: type({
          project: type({ title: "string" }),
          fieldValueByName: type({ name: optionalNullableString }).or("null"),
        }).array(),
      }),
    }),
  }),
});

export const linkedIssuesSchema = type({
  nodes: type({
    number: safeIntegerSchema,
    repository: type({
      name: "string",
      owner: type({ login: "string" }),
    }),
  }).array(),
});

export const commitsSchema = commitSchema.array();
export const commentsSchema = commentSchema.array();
export const reviewsSchema = reviewSchema.array();

export type GithubPullRequestView =
  (typeof pullRequestViewSchema.infer)["repository"]["pullRequest"];
export type GithubComments = readonly (typeof commentSchema.infer)[];
export type GithubReviews = readonly (typeof reviewSchema.infer)[];
export type GithubRequestedReviewers = typeof requestedReviewersSchema.infer;
export type GithubChecks = typeof checksSchema.infer;
export type GithubProjects =
  (typeof pullRequestProjectsSchema.infer)["repository"]["pullRequest"];
export type GithubLinkedIssues = typeof linkedIssuesSchema.infer;
