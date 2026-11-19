// Resolver functions for the UI Kit frontends (invoked via @forge/bridge).
import Resolver from '@forge/resolver';
import { summarizeFamily } from '../engine/index.js';
import { reindexAll } from './indexer.js';
import {
  healthOverview,
  issueInsights,
  metricDetails,
  pageInsights,
  requestReconciliation,
} from './service.js';
import { getSettings, saveSettings } from './store.js';

const resolver = new Resolver();

function safe(fn) {
  return async (req) => {
    try {
      return { ok: true, data: await fn(req) };
    } catch (err) {
      console.error(err);
      return { ok: false, error: err.message };
    }
  };
}

resolver.define('getHealth', safe(() => healthOverview()));

resolver.define(
  'getMetric',
  safe(async ({ payload, context }) => {
    const family = await metricDetails(payload.metric, context.cloudId);
    if (!family) return null;
    return {
      ...summarizeFamily(family),
      people: Object.fromEntries(family.definitions.map((d) => [d.pageId, d.graph])),
    };
  }),
);

resolver.define(
  'getIssueInsights',
  safe(({ context }) => issueInsights(context.extension.issue.key)),
);

resolver.define(
  'getPageInsights',
  safe(({ context }) => pageInsights(context.extension.content.id)),
);

resolver.define(
  'requestReconciliation',
  safe(({ payload, context }) =>
    requestReconciliation({
      metric: payload.metric,
      projectKey: payload.projectKey || context.extension?.issue?.key?.split('-')[0] || null,
      sourceIssueKey: payload.sourceIssueKey || context.extension?.issue?.key || null,
      note: payload.note || null,
    }),
  ),
);

resolver.define('rescan', safe(() => reindexAll({ asUser: true })));

resolver.define('getSettings', safe(() => getSettings()));

resolver.define(
  'saveSettings',
  safe(({ payload }) => saveSettings({ reconcileProjectKey: (payload.reconcileProjectKey || '').trim().toUpperCase() || null })),
);

export const handler = resolver.getDefinitions();
