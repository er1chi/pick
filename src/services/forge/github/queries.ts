const pullRequest = (fields: string) => `
  query ($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) { ${fields} }
    }
  }
`;

export const pullRequestViewQuery = pullRequest(`
  body createdAt updatedAt mergedAt
  baseRefName baseRefOid headRefName headRefOid
  additions deletions mergeable mergeStateStatus reviewDecision
  commits(last: 1) {
    nodes {
      commit {
        statusCheckRollup {
          contexts(first: 100) {
            nodes {
              ... on CheckRun { name status conclusion detailsUrl }
              ... on StatusContext { context state targetUrl }
            }
          }
        }
      }
    }
  }
  closingIssuesReferences(first: 50) {
    nodes { number repository { name owner { login } } }
  }
`);

/** Kept apart from the view because reading project items needs the
 * `read:project` token scope, which must not fail the rest of the view. */
export const pullRequestProjectsQuery = pullRequest(`
  projectItems(first: 50) {
    nodes {
      project { title }
      fieldValueByName(name: "Status") {
        ... on ProjectV2ItemFieldSingleSelectValue { name }
      }
    }
  }
`);
