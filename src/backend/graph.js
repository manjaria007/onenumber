// Teamwork Graph (read-only): who actually works on each definition page.
//
// Uses a persisted Cypher query registered for this app in TWG Labs (see
// docs/TEAMWORK-GRAPH.md). Set its key with:
//   forge variables set TWG_PAGE_PEOPLE_QUERY_KEY <key>
// If the key is not set or the graph returns nothing, callers fall back to the
// owner written on the page, so the app still works without the graph.
import api from '@forge/api';

export const PAGE_PEOPLE_CYPHER = `MATCH (user:AtlassianUser)-[:atlassian_user_contributed_to_confluence_page]->(page:ConfluencePage {ari: $id})
RETURN collect(distinct user) as contributors`;

const QUERY = `query onenumber_pagePeople($queryKey: String!, $queryParams: CypherRequestParams) {
  customQuery(queryKey: $queryKey, queryParams: $queryParams, first: 10) {
    edges {
      node {
        columns {
          key
          value {
            __typename
            ... on CypherQueryResultListNode {
              nodes {
                id
                data {
                  __typename
                  ... on AtlassianUser {
                    id
                    displayName
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}`;

export function pageAri(cloudId, pageId) {
  return `ari:cloud:confluence:${cloudId}:page/${pageId}`;
}

export function extractPeople(body) {
  const people = [];
  for (const edge of body?.data?.customQuery?.edges || []) {
    for (const column of edge?.node?.columns || []) {
      for (const n of column?.value?.nodes || []) {
        if (n?.data?.displayName) people.push({ id: n.data.id || n.id, displayName: n.data.displayName });
      }
    }
  }
  const seen = new Set();
  return people.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
}

// Must run in a user context (UI resolver or Rovo action): the Teamwork Graph
// API cannot be called as the app.
export async function getPagePeople(cloudId, pageId) {
  const queryKey = process.env.TWG_PAGE_PEOPLE_QUERY_KEY;
  if (!queryKey || !cloudId) return { source: 'page', people: [] };
  try {
    const response = await api.asUser().requestTeamworkGraph(QUERY, {
      queryKey,
      queryParams: { id: pageAri(cloudId, pageId) },
    });
    const body = await response.json();
    if (body.errors?.length) console.warn('Teamwork Graph errors', JSON.stringify(body.errors).slice(0, 500));
    return { source: 'teamwork-graph', people: extractPeople(body) };
  } catch (err) {
    console.warn(`Teamwork Graph lookup failed for page ${pageId}: ${err.message}`);
    return { source: 'page', people: [] };
  }
}

export async function enrichFamilyWithPeople(family, cloudId) {
  const definitions = await Promise.all(
    family.definitions.map(async (d) => ({ ...d, graph: await getPagePeople(cloudId, d.pageId) })),
  );
  return { ...family, definitions };
}
