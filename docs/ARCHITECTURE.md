# OneNumber architecture

```
Confluence pages (label: metric-definition)
        │  page created/updated triggers · hourly schedule · "Rescan" button
        ▼
 indexer.js ── confluence.js (CQL search + v2 page bodies, as app)
        │
        ▼
 engine/ (pure JS, no LLM)
   definition.js  storage-format table + SQL code block → metric spec
   sql.js         aggregation · tables · WHERE filters · rolling window
   compare.js     group by name/alias (union-find) → pairwise differences → severity, status
   mentions.js    which metrics a Jira request or page talks about
   explain.js     plain-English summaries for UI, Rovo and MCP
        │
        ▼
 store.js ── Forge KVS:  def:<pageId>  ·  analysis (snapshot)  ·  settings
        │
        ├── resolvers.js → UI Kit: Jira issue panel · Jira Metric Health page ·
        │                          Confluence metric card macro · Confluence byline
        ├── actions.js   → rovo:agent "Metric Steward"  +  rovo:mcp "OneNumber Metrics"
        ├── jira.js      → read requests (as user) · create + link reconcile tasks (as user)
        └── graph.js     → Teamwork Graph API (read-only, as user): page contributors
```

## Key decisions

- **One Forge app, Jira + Confluence (multi-app compatibility).** Jira is the required app and Confluence is optional. Bitbucket is left out because a Forge app can't hold Jira site scopes and Bitbucket workspace scopes together, and a second install link would complicate judging.
- **Rule-based detection.** Every conflict cites two pages and a field, which keeps it accurate without a model and works even where Forge LLM isn't available. Rovo provides the conversational layer on top.
- **Read-only Teamwork Graph.** This qualifies for the TWG bonus ("consumes data from the TWG API") without the production restriction on apps that also use a custom connector.
- **KVS snapshot.** The registry is small (one record per definition page), so the whole analysis is recomputed and stored after every change. Reads are a single `kvs.get`.
- **Human in the loop.** The agent is instructed to create reconcile tasks only after the user confirms. The action description repeats this instruction.

## Limits and next steps

- The SQL reader extracts predicates and windows. It isn't a full SQL parser, so complex CTEs fall back to the table fields.
- Stretch goals: a Bitbucket companion app that reads dbt metric YAML, numeric value checks on report pages, and Marketplace listing.
