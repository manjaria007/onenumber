// End-to-end backend test with mocked Atlassian APIs: Confluence search and
// page reads, Jira issue reads and task creation, and Forge KVS.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildDefinitionStorage } from '../demo/storage.js';
import { METRIC_PAGES, JIRA_REQUESTS } from '../demo/brightloop.js';

const store = new Map();
const created = [];

const PAGES = METRIC_PAGES.map((p, i) => ({
  id: String(500 + i),
  title: p.title,
  body: { storage: { value: buildDefinitionStorage(p.fields, p.sql) } },
  _links: { webui: `/spaces/MET/pages/${500 + i}` },
  version: { number: 1 },
}));

function respond(body, status = 200) {
  return { ok: status < 300, status, json: async () => body, text: async () => JSON.stringify(body) };
}

function routeToString(r) {
  return typeof r === 'string' ? r : r.value ?? String(r);
}

async function fakeRequest(r, init = {}) {
  const url = routeToString(r);
  if (url.startsWith('/wiki/rest/api/search')) {
    return respond({ results: PAGES.map((p) => ({ content: { id: p.id } })), _links: { base: 'https://brightloop.atlassian.net/wiki' } });
  }
  const labels = url.match(/^\/wiki\/api\/v2\/pages\/(\d+)\/labels/);
  if (labels) return respond({ results: [{ name: 'metric-definition' }] });
  const page = url.match(/^\/wiki\/api\/v2\/pages\/(\d+)/);
  if (page) return respond(PAGES.find((p) => p.id === page[1]));
  if (url.startsWith('/rest/api/3/issue/createmeta/')) {
    return respond({ issueTypes: [{ id: '10001', name: 'Task', subtask: false }] });
  }
  if (url.startsWith('/rest/api/3/issueLink')) return respond(null, 201);
  if (url === '/rest/api/3/issue' && init.method === 'POST') {
    const body = JSON.parse(init.body);
    created.push(body);
    return respond({ id: '20001', key: `${body.fields.project.key}-${created.length}` }, 201);
  }
  const issue = url.match(/^\/rest\/api\/3\/issue\/([A-Z]+-\d+)/);
  if (issue) {
    const idx = Number(issue[1].split('-')[1]) - 1;
    const req = JIRA_REQUESTS[idx];
    return respond({
      key: issue[1],
      fields: {
        summary: req.summary,
        project: { key: 'MKT' },
        description: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: req.description }] }] },
      },
    });
  }
  throw new Error(`Unmocked request ${url}`);
}

vi.mock('@forge/api', () => {
  const client = {
    requestConfluence: (...a) => fakeRequest(...a),
    requestJira: (...a) => fakeRequest(...a),
    requestTeamworkGraph: async () =>
      respond({
        data: {
          customQuery: {
            edges: [{ node: { columns: [{ key: 'contributors', value: { nodes: [{ id: 'u1', data: { id: 'u1', displayName: 'Priya Raman' } }] } }] } }],
          },
        },
      }),
  };
  const route = (strings, ...values) => ({
    value: strings.reduce((acc, s, i) => acc + s + (i < values.length ? encodeURIComponent(values[i]) : ''), ''),
  });
  return { default: { asApp: () => client, asUser: () => client }, route };
});

vi.mock('@forge/kvs', () => {
  const makeQuery = (prefix = '') => ({
    where: (_p, cond) => makeQuery(cond.prefix),
    limit: () => makeQuery(prefix),
    cursor: () => makeQuery(prefix),
    getMany: async () => ({
      results: [...store.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, value]) => ({ key, value })),
    }),
  });
  return {
    kvs: {
      get: async (k) => store.get(k),
      set: async (k, v) => store.set(k, structuredClone(v)),
      delete: async (k) => store.delete(k),
      query: () => makeQuery(),
    },
    WhereConditions: { beginsWith: (prefix) => ({ prefix }) },
  };
});

const { reindexAll } = await import('../src/backend/indexer.js');
const service = await import('../src/backend/service.js');
const actions = await import('../src/backend/actions.js');
const { saveSettings } = await import('../src/backend/store.js');

beforeEach(() => {
  store.clear();
  created.length = 0;
  delete process.env.TWG_PAGE_PEOPLE_QUERY_KEY;
});

describe('indexing and health', () => {
  it('indexes every labelled page and summarises health', async () => {
    const result = await reindexAll();
    expect(result.indexed).toBe(6);
    expect(result.errors).toEqual([]);
    const health = await service.healthOverview();
    expect(health.disputed).toBe(2);
    expect(health.trusted).toBe(1);
    expect(health.families[0].teams.length).toBe(2);
  });

  it('builds page links from the search base URL', async () => {
    await reindexAll();
    const details = await service.metricDetails('churn rate', 'cloud-1');
    expect(details.definitions[0].url).toBe('https://brightloop.atlassian.net/wiki/spaces/MET/pages/500');
  });
});

describe('Jira issue panel', () => {
  it('flags the disputed churn metric on the board-deck request', async () => {
    const insights = await service.issueInsights('MKT-1');
    expect(insights.metrics.map((m) => m.key)).toEqual(['churn-rate']);
    expect(insights.metrics[0].status).toBe('disputed');
  });

  it('shows a trusted metric as agreed', async () => {
    const insights = await service.issueInsights('MKT-3');
    expect(insights.metrics[0].status).toBe('trusted');
  });
});

describe('Rovo / MCP actions', () => {
  it('looks up a metric by alias, with Teamwork Graph contributors when configured', async () => {
    process.env.TWG_PAGE_PEOPLE_QUERY_KEY = 'onenumber_pagePeople';
    const res = await actions.lookupMetric({ metricName: 'customer churn', context: { cloudId: 'cloud-1' } });
    expect(res.found).toBe(true);
    expect(res.canonicalDefinition.team).toBe('Finance');
    expect(Object.values(res.contributors)[0]).toEqual(['Priya Raman']);
  });

  it('falls back gracefully without a Teamwork Graph query key', async () => {
    const res = await actions.lookupMetric({ metricName: 'net revenue', context: { cloudId: 'cloud-1' } });
    expect(res.found).toBe(true);
    expect(Object.values(res.contributors)[0]).toEqual([]);
  });

  it('lists conflicts filtered by severity', async () => {
    const res = await actions.listMetricConflicts({ minimumSeverity: 'high' });
    expect(res.disputedMetrics.map((m) => m.metric).sort()).toEqual(['Churn rate', 'Net revenue']);
    expect(res.trustedMetrics).toEqual(['Active customers']);
  });

  it('reports unknown metrics without throwing', async () => {
    const res = await actions.compareMetricDefinitions({ metricName: 'gross margin' });
    expect(res.found).toBe(false);
  });

  it('creates and links a reconcile task in the configured project', async () => {
    await saveSettings({ reconcileProjectKey: 'DATA' });
    const res = await actions.requestMetricReconciliation({ metricName: 'churn rate', sourceIssueKey: 'MKT-1' });
    expect(res.created).toBe(true);
    expect(res.key).toBe('DATA-1');
    expect(created[0].fields.summary).toBe('Reconcile metric definition: Churn rate');
    expect(JSON.stringify(created[0].fields.description)).toContain('90 days vs 30 days');
  });

  it('refuses to reconcile a metric that already agrees', async () => {
    const res = await actions.requestMetricReconciliation({ metricName: 'active customers', projectKey: 'DATA' });
    expect(res.created).toBe(false);
    expect(created).toHaveLength(0);
  });

  it('explains a missing project instead of failing', async () => {
    const res = await actions.requestMetricReconciliation({ metricName: 'churn rate' });
    expect(res.created).toBe(false);
    expect(res.message).toMatch(/No Jira project/);
  });
});
