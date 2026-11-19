# OneNumber

**One trusted definition for every business metric.** OneNumber is an Atlassian Forge app for Jira and Confluence. It catches the moment two teams mean different things by the same metric, before conflicting numbers reach leadership.

Built for **Codegeist 2026: Build with context. Ship with confidence.** Category: **Apps for Business Teams**.

> Marketing's board slide says churn is 4.1%. Finance says 6.3%. Both are "right": one counts trial accounts over 30 days, the other excludes them over 90 days. OneNumber shows that difference where the question is asked, names the owner of the agreed definition, and sends a reconcile task to the data team in one click.

## What it does

| Where | What the user sees |
|---|---|
| **Jira issue panel** | Detects metrics named in a business request, warns when their definitions conflict, lists the exact differences, and offers **Ask the data team to reconcile**. |
| **Jira global page: Metric Health** | Every tracked metric with its status (disputed / trusted / unverified), impact, teams and canonical owner; rescan button; reconcile-project setting. |
| **Confluence macro: OneNumber metric card** | Drop onto any report page: the canonical definition, its owner, conflicts, and the people who work on each definition (Teamwork Graph). |
| **Confluence byline** | On any page, flags disputed metrics the page relies on. |
| **Rovo agent: Metric Steward** | Answers "Which churn definition should I use?" or "Why do Finance and Marketing differ?", with citations to the definition pages. |
| **MCP tools (rovo:mcp)** | `lookup-metric`, `compare-metric-definitions`, `list-metric-conflicts`, `request-metric-reconciliation`, reusable by any Rovo Studio agent. |

### How detection works

Definitions are Confluence pages labelled **`metric-definition`** that use a simple template table (see [docs/metric-definition-template.md](docs/metric-definition-template.md)) plus an optional SQL code block. A **rule-based engine** (`src/engine/`, no LLM) parses each page into a structured spec covering time window, calculation, filters, inclusions/exclusions and source tables. It then groups definitions by name and alias and reports every concrete difference with a severity. Each finding traces to two specific pages, so it can't hallucinate. The Rovo agent only explains what the engine found.

## Repository layout

```
manifest.yml               Forge modules, functions, scopes (Jira + Confluence multi-app)
src/engine/                Pure JS: SQL reader, page parser, conflict engine, mentions, explanations
src/backend/               Forge functions: Confluence/Jira/Teamwork Graph clients, KVS store, indexer,
                           resolvers (UI), actions (Rovo + MCP), triggers (page events, hourly)
src/frontend/              UI Kit: issue panel, Metric Health page, metric card macro, page byline
resources/agent/prompt.txt Metric Steward instructions
demo/                      Fictional "Brightloop" demo content (pages + Jira requests)
scripts/seed-demo.mjs      Seeds your developer site with the demo content
scripts/check-setup.mjs    Pre-flight check before deploying
test/                      Vitest unit + backend flow tests (mocked Atlassian APIs)
docs/                      Architecture, judge setup, Teamwork Graph setup, demo script, template
```

## Build and run

Prerequisites: Node.js 22+ and an [Atlassian API token](https://id.atlassian.com/manage-profile/security/api-tokens). Codegeist 2026 participants get a free pre-configured dev site (Jira, Confluence, JSM, Rovo Enterprise, Studio) for 90 days via `forge site provision`. Only one provisioned site is allowed per participant.

```bash
npm install
npm test                      # 26 tests: engine + backend flow

npm run forge:install-cli     # installs @forge/cli globally
npm run forge:login           # email + API token (stored in your OS keychain)
npm run site:provision        # Codegeist dev site; Ctrl+C is fine, rerun to check status / get the URL
npm run register              # creates the app in your account and writes app.id into manifest.yml
npm run setup                 # pre-flight check
npm run lint                  # forge lint
npm run deploy                # deploy to the development environment
npm run install:demo          # install on your provisioned Codegeist site

cp .env.example .env          # fill in site URL, email, token, space key, project key
npm run seed                  # create the Brightloop demo pages and Jira requests
```

Using your own site instead? Run `export $(grep -v '^#' .env | xargs)`, then `npm run install:jira` and `npm run install:confluence`.

Then open **Jira → Apps → OneNumber Metric Health**, press **Rescan Confluence**, and set the reconcile project (for example `DATA`).

Day-to-day: `npm run tunnel` for live reload with logs, `npm run logs` for deployed logs, and `npm run install:upgrade` after any scope change.

### Optional: Teamwork Graph contributors

The metric card and the agent can show who works on each definition page, read from the Teamwork Graph API. This needs a persisted Cypher query registered for your app. See [docs/TEAMWORK-GRAPH.md](docs/TEAMWORK-GRAPH.md). Without it, OneNumber falls back to the owner written on the page.

## Codegeist 2026 notes

- **Category:** Apps for Business Teams.
- **Technology requirement:** Forge app (manifest + UI Kit, resolvers, actions, triggers) integrating Jira, Confluence, Rovo and the Teamwork Graph API.
- **Bonus prizes targeted:** Best app with Atlassian MCP (`rovo:mcp`), Best Agents (`rovo:agent` + reusable actions), Best Teamwork Graph integration (reads the TWG API).
- **Demo data:** entirely fictional. See [docs/DEMO-SCRIPT.md](docs/DEMO-SCRIPT.md) and [docs/JUDGE-SETUP.md](docs/JUDGE-SETUP.md).

## License

MIT. See [LICENSE](LICENSE).
