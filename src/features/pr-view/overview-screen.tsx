import { For, Show, type Accessor, type JSX } from "solid-js";
import {
  visibleError,
  visibleValue,
  type LoadState,
} from "@/features/pr-view/load-state";
import { renderMutedLine } from "@/features/pr-view/pr-view-chrome";
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
} from "@/features/pr-view/pr-view-display";
import { colors } from "@/theme";

import type { PrViewContent } from "@/features/pr-view/use-pr-view-content";
import type {
  ForgeSection,
  PullRequestCheck,
  PullRequestComment,
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

interface ResourceSectionProps<T> {
  readonly label: string;
  readonly state: LoadState<T>;
  readonly render: (value: T) => JSX.Element;
}

/**
 * Renders one independent PR section. Loading and query-level errors are shown
 * here; per-collection failure/unsupported states are handled by the section
 * renderers through their ForgeSection values.
 */
function ResourceSection<T>(props: ResourceSectionProps<T>): JSX.Element {
  const error = (): string | undefined => visibleError(props.state)?.message;

  return (
    <box flexDirection="column" gap={0}>
      <Show when={props.state.status === "loading"}>
        <text fg={colors.muted}>Loading {props.label}…</text>
      </Show>
      <Show when={error()}>
        {(text: Accessor<string>) => (
          <box flexDirection="column">
            <text fg={colors.yellow}>Could not load {props.label}.</text>
            <text fg={colors.dim}>{text()}</text>
            <text fg={colors.muted}>Press r to retry.</text>
          </box>
        )}
      </Show>
      <Show keyed when={visibleValue(props.state)}>
        {(value: T) => props.render(value)}
      </Show>
    </box>
  );
}

interface OverviewScreenProps {
  readonly content: PrViewContent;
  readonly summary: Accessor<PullRequestSummary | undefined>;
}

export function OverviewScreen(props: OverviewScreenProps): JSX.Element {
  return (
    <box flexDirection="column" gap={1} width="100%">
      <ResourceSection
        label="pull request overview"
        state={props.content.overview()}
        render={(overview) => (
          <Show keyed when={props.summary()}>
            {(item: PullRequestSummary) => renderOverview(item, overview)}
          </Show>
        )}
      />
      <ResourceSection
        label="reviews"
        state={props.content.reviews()}
        render={(resource) =>
          renderReviews(
            resource.reviews,
            resource.reviewComments,
            resource.requestedReviewers,
          )
        }
      />
      <ResourceSection
        label="checks"
        state={props.content.checks()}
        render={(section) => renderChecks(section)}
      />
      <ResourceSection
        label="development"
        state={props.content.development()}
        render={(development) =>
          renderDevelopment(development.projects, development.linkedIssues)
        }
      />
    </box>
  );
}
