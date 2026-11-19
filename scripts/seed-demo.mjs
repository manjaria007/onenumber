#!/usr/bin/env node
// Seeds a developer site with the fictional "Brightloop" demo:
//   - six labelled metric-definition pages in a Confluence space
//   - one report page that mentions the metrics (for the byline warning)
//   - three business requests in a Jira project
//
// Usage (values from .env or your shell):
//   ATLASSIAN_SITE=yoursite.atlassian.net ATLASSIAN_EMAIL=you@example.com \
//   ATLASSIAN_API_TOKEN=... CONFLUENCE_SPACE_KEY=MET JIRA_PROJECT_KEY=MKT \
//   npm run seed            # add --dry-run to print without writing
//
// Safe to re-run: pages and issues that already exist (same title/summary) are skipped.
import { readFileSync, existsSync } from 'node:fs';
import { buildDefinitionStorage } from '../demo/storage.js';
import { COMPANY, METRIC_PAGES, JIRA_REQUESTS } from '../demo/brightloop.js';

function loadDotEnv() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
}

loadDotEnv();
const DRY_RUN = process.argv.includes('--dry-run');
const required = ['ATLASSIAN_SITE', 'ATLASSIAN_EMAIL', 'ATLASSIAN_API_TOKEN', 'CONFLUENCE_SPACE_KEY', 'JIRA_PROJECT_KEY'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length && !DRY_RUN) {
  console.error(`Missing environment variables: ${missing.join(', ')}. Copy .env.example to .env and fill it in.`);
  process.exit(1);
}

const site = (process.env.ATLASSIAN_SITE || 'example.atlassian.net').replace(/^https?:\/\//, '').replace(/\/$/, '');
const auth = `Basic ${Buffer.from(`${process.env.ATLASSIAN_EMAIL}:${process.env.ATLASSIAN_API_TOKEN}`).toString('base64')}`;
const spaceKey = process.env.CONFLUENCE_SPACE_KEY || 'MET';
const projectKey = process.env.JIRA_PROJECT_KEY || 'MKT';

async function call(path, { method = 'GET', body } = {}) {
  const res = await fetch(`https://${site}${path}`, {
    method,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}: ${text.slice(0, 400)}`);
  return text ? JSON.parse(text) : null;
}

async function pageExists(title) {
  const data = await call(`/wiki/rest/api/content?spaceKey=${encodeURIComponent(spaceKey)}&title=${encodeURIComponent(title)}&type=page`);
  return (data.results || []).length > 0;
}

async function createPage(title, storage, labels) {
  if (DRY_RUN) {
    console.log(`[dry-run] page "${title}" (${storage.length} chars, labels: ${labels.join(', ') || 'none'})`);
    return;
  }
  if (await pageExists(title)) {
    console.log(`skip  page "${title}" (already exists)`);
    return;
  }
  const page = await call('/wiki/rest/api/content', {
    method: 'POST',
    body: {
      type: 'page',
      title,
      space: { key: spaceKey },
      body: { storage: { value: storage, representation: 'storage' } },
      metadata: { labels: labels.map((name) => ({ prefix: 'global', name })) },
    },
  });
  console.log(`added page "${title}" (id ${page.id})`);
}

const REPORT_TITLE = 'Q4 board deck — KPI summary (draft)';
const REPORT_STORAGE = `<p>Draft KPI summary for the Q4 board meeting at ${COMPANY}.</p>
<table><tbody>
<tr><th><p>KPI</p></th><th><p>Q4 value</p></th><th><p>Source</p></th></tr>
<tr><td><p>Customer churn</p></td><td><p>4.1%</p></td><td><p>Growth dashboard</p></td></tr>
<tr><td><p>Net revenue</p></td><td><p>$12.4M</p></td><td><p>Sales pipeline report</p></td></tr>
<tr><td><p>Active customers</p></td><td><p>18,240</p></td><td><p>Product analytics</p></td></tr>
</tbody></table>
<p>Insert the "OneNumber metric card" macro below each KPI to show its agreed definition.</p>`;

async function issueExists(summary) {
  const jql = `project = "${projectKey}" AND summary ~ "\\"${summary.replace(/["\\]/g, ' ').slice(0, 60)}\\""`;
  const data = await call(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1&fields=summary`);
  return (data.issues || []).some((i) => i.fields?.summary === summary);
}

async function taskTypeId() {
  const data = await call(`/rest/api/3/issue/createmeta/${encodeURIComponent(projectKey)}/issuetypes`);
  const types = (data.issueTypes || data.values || []).filter((t) => !t.subtask);
  const task = types.find((t) => t.name.toLowerCase() === 'task') || types[0];
  if (!task) throw new Error(`No usable issue type in ${projectKey}`);
  return task.id;
}

async function createIssues() {
  if (DRY_RUN) {
    for (const r of JIRA_REQUESTS) console.log(`[dry-run] issue "${r.summary}"`);
    return;
  }
  const typeId = await taskTypeId();
  for (const r of JIRA_REQUESTS) {
    // eslint-disable-next-line no-await-in-loop
    if (await issueExists(r.summary)) {
      console.log(`skip  issue "${r.summary}" (already exists)`);
      continue;
    }
    // eslint-disable-next-line no-await-in-loop
    const issue = await call('/rest/api/3/issue', {
      method: 'POST',
      body: {
        fields: {
          project: { key: projectKey },
          issuetype: { id: typeId },
          summary: r.summary,
          description: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: r.description }] }] },
        },
      },
    });
    console.log(`added issue ${issue.key} "${r.summary}"`);
  }
}

console.log(`Seeding ${COMPANY} demo into ${site} (space ${spaceKey}, project ${projectKey})${DRY_RUN ? ' [dry run]' : ''}`);
for (const p of METRIC_PAGES) {
  // eslint-disable-next-line no-await-in-loop
  await createPage(p.title, buildDefinitionStorage(p.fields, p.sql), ['metric-definition']);
}
await createPage(REPORT_TITLE, REPORT_STORAGE, []);
await createIssues();
console.log('Done. Open Jira > Apps > OneNumber Metric Health and press "Rescan Confluence".');
