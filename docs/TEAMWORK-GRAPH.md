# Teamwork Graph setup (optional)

OneNumber **reads** the Teamwork Graph to show who contributes to each metric definition page. It never writes to the graph. That avoids the platform restriction that apps combining the Teamwork Graph API with a custom connector can't be deployed to production or distributed.

## 1. Scopes (already in manifest.yml)

```yaml
- read:graph:page:confluence
- read:graph:user:atlassian
```

Teamwork Graph scopes are per object type. A missing scope doesn't raise an error; the query just returns empty results.

## 2. Register the persisted Cypher query

Apps can't send raw Cypher, so register this query for your app in **TWG Labs** (the Teamwork Graph query playground, under the "Saved queries" tab), or with the Cypher query registration endpoint described in the [persisted Cypher queries docs](https://developer.atlassian.com/platform/teamwork-graph/persisted-cypher-queries/). You need contributor access on the app.

```cypher
MATCH (user:AtlassianUser)-[:atlassian_user_contributed_to_confluence_page]->(page:ConfluencePage {ari: $id})
RETURN collect(distinct user) as contributors
```

The same text is exported as `PAGE_PEOPLE_CYPHER` from `src/backend/graph.js`.

## 3. Tell the app the query key

```bash
forge variables set --environment development TWG_PAGE_PEOPLE_QUERY_KEY <your-saved-query-key>
npm run deploy
```

Allow about a minute after registering a query or changing scopes.

## How it is called

`src/backend/graph.js` calls `api.asUser().requestTeamworkGraph()` with the GraphQL `customQuery` field, passing the page ARI `ari:cloud:confluence:<cloudId>:page/<pageId>`. The Teamwork Graph API can't be called as the app, so contributor lookups only happen in user contexts: the UI resolvers and the Rovo/MCP actions. Background indexing never needs them. If the key isn't set or the call fails, OneNumber falls back to the owner written on the page.
