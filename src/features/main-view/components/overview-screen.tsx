import { For, Show, type Accessor, type JSX } from "solid-js";
import { usePullRequest } from "@/context/pull-request-context";
import { renderMutedLine } from "@/features/main-view/components/pr-view-chrome";
import {
  checkLine,
  collectionAvailability,
  commentBody,
  commentMetaLine,
  isRenderableCollection,
  isRenderableReviewerRequests,
  linkedIssueLine,
  overviewMetaLine,
  presentText,
  projectLine,
  reviewBody,
  reviewCommentMetaLine,
  reviewMetaLine,
  reviewerAvailability,
  reviewerNames,
} from "@/features/main-view/utils/pr-view-display";
import { colors } from "@/theme";

import type { Result } from "better-result";
import type {
  ForgeOperationError,
  ForgeSection,
  PullRequestCheck,
  PullRequestComment,
  PullRequestDocument,
  PullRequestLinkedIssue,
  PullRequestOverview,
  PullRequestProject,
  PullRequestReview,
  PullRequestReviewComment,
  PullRequestReviewerRequests,
  PullRequestSummary,
} from "@/services/forge/types";

function arrayItems<T>(section: ForgeSection<readonly T[]>): readonly T[] {
  return section.status === "available" ? section.value : [];
}

function sectionHeading(label: string, status: string): JSX.Element {
  return (
    <text fg={colors.foreground}>
      <strong>
        {label}: {status}
      </strong>
    </text>
  );
}

function renderStackedItem(
  meta: string | undefined,
  body: string | undefined,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderMutedLine(meta)}
      <Show when={body}>
        {(value: Accessor<string>) => (
          <text fg={colors.foreground}>{value()}</text>
        )}
      </Show>
    </box>
  );
}

function renderCollectionSection<T>(
  label: string,
  section: ForgeSection<readonly T[]>,
  renderItem: (item: T) => JSX.Element,
): JSX.Element {
  return (
    <Show when={isRenderableCollection(section)}>
      <box flexDirection="column" gap={0}>
        {sectionHeading(label, collectionAvailability(section))}
        <For each={arrayItems(section)}>{renderItem}</For>
      </box>
    </Show>
  );
}

function renderComments(
  section: ForgeSection<readonly PullRequestComment[]>,
): JSX.Element {
  return renderCollectionSection("Conversation", section, (comment) =>
    renderStackedItem(commentMetaLine(comment), commentBody(comment)),
  );
}

function renderOverview(
  summary: PullRequestSummary,
  overview: PullRequestOverview,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderMutedLine(overviewMetaLine(summary))}
      <Show when={presentText(overview.body)}>
        {(body: Accessor<string>) => (
          <box flexDirection="column" gap={1}>
            <text fg={colors.foreground}>
              <strong>Description</strong>
            </text>
            <text fg={colors.muted}>{body()}</text>
          </box>
        )}
      </Show>
      {renderComments(overview.conversationComments)}
    </box>
  );
}

function renderRequestedReviewers(
  section: ForgeSection<PullRequestReviewerRequests>,
): JSX.Element {
  return (
    <Show when={isRenderableReviewerRequests(section)}>
      <box flexDirection="column" gap={0}>
        {sectionHeading("Requested reviewers", reviewerAvailability(section))}
        {renderMutedLine(reviewerNames(section))}
      </box>
    </Show>
  );
}

function renderReviews(
  reviews: ForgeSection<readonly PullRequestReview[]>,
  reviewComments: ForgeSection<readonly PullRequestReviewComment[]>,
  requestedReviewers: ForgeSection<PullRequestReviewerRequests>,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderCollectionSection("Submitted reviews", reviews, (review) =>
        renderStackedItem(reviewMetaLine(review), reviewBody(review)),
      )}
      {renderCollectionSection("Inline comments", reviewComments, (comment) =>
        renderStackedItem(reviewCommentMetaLine(comment), commentBody(comment)),
      )}
      {renderRequestedReviewers(requestedReviewers)}
    </box>
  );
}

function renderChecks(
  section: ForgeSection<readonly PullRequestCheck[]>,
): JSX.Element {
  return renderCollectionSection("Checks", section, (check) =>
    renderMutedLine(checkLine(check)),
  );
}

function renderDevelopment(
  projects: ForgeSection<readonly PullRequestProject[]>,
  linkedIssues: ForgeSection<readonly PullRequestLinkedIssue[]>,
): JSX.Element {
  return (
    <box flexDirection="column" gap={0}>
      {renderCollectionSection("Projects", projects, (project) =>
        renderMutedLine(projectLine(project)),
      )}
      {renderCollectionSection("Closing issues", linkedIssues, (issue) =>
        renderMutedLine(linkedIssueLine(issue)),
      )}
    </box>
  );
}

function renderLoadedOverview(
  overview: Result<PullRequestOverview, ForgeOperationError>,
  summary: PullRequestSummary | undefined,
): JSX.Element | null {
  if (overview.isErr()) {
    return <text fg={colors.yellow}>{overview.error.message}</text>;
  }
  if (summary === undefined) {
    return null;
  }
  return renderOverview(summary, overview.value);
}

function OverviewBody(props: {
  readonly document: PullRequestDocument;
  readonly summary: PullRequestSummary | undefined;
}): JSX.Element {
  const reviews = props.document.reviews;
  return (
    <box flexDirection="column" gap={1} width="100%">
      {renderLoadedOverview(props.document.overview, props.summary)}
      {renderReviews(
        reviews.reviews,
        reviews.reviewComments,
        reviews.requestedReviewers,
      )}
      {renderChecks(props.document.checks)}
      {renderDevelopment(
        props.document.development.projects,
        props.document.development.linkedIssues,
      )}
    </box>
  );
}

interface OverviewScreenProps {
  readonly summary: Accessor<PullRequestSummary | undefined>;
}

export function OverviewScreen(props: OverviewScreenProps): JSX.Element {
  const pullRequest = usePullRequest();

  return (
    <Show when={pullRequest.data()}>
      {(document: Accessor<PullRequestDocument>) => (
        <OverviewBody document={document()} summary={props.summary()} />
      )}
    </Show>
  );
}
