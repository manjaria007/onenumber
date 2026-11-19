// Forge actions. The Rovo agent "Metric Steward" uses them, and the rovo:mcp
// module exposes the same actions as MCP tools for any Rovo Studio agent.
import { summarizeFamily } from '../engine/index.js';
import { healthOverview, metricDetails, requestReconciliation } from './service.js';

function cloudIdFrom(payload) {
  return payload?.context?.cloudId || null;
}

function notFound(metric) {
  return {
    found: false,
    message: `OneNumber has no definition page for "${metric}". Definitions are Confluence pages labelled "metric-definition".`,
  };
}

export async function lookupMetric(payload) {
  const metric = payload?.metricName;
  if (!metric) return { found: false, message: 'Please give a metric name.' };
  const family = await metricDetails(metric, cloudIdFrom(payload));
  if (!family) return notFound(metric);
  const summary = summarizeFamily(family);
  return {
    found: true,
    metric: summary.metric,
    status: summary.status,
    canonicalDefinition: summary.canonicalDefinition,
    otherNames: summary.alsoKnownAs,
    conflictCount: summary.conflicts.length,
    contributors: Object.fromEntries(family.definitions.map((d) => [d.title, d.graph?.people?.map((p) => p.displayName) || []])),
    explanation: summary.explanation,
  };
}

export async function compareMetricDefinitions(payload) {
  const metric = payload?.metricName;
  if (!metric) return { found: false, message: 'Please give a metric name.' };
  const family = await metricDetails(metric, cloudIdFrom(payload));
  if (!family) return notFound(metric);
  const summary = summarizeFamily(family);
  return { found: true, ...summary };
}

export async function listMetricConflicts(payload) {
  const overview = await healthOverview();
  const minimum = (payload?.minimumSeverity || 'low').toLowerCase();
  const rank = { low: 1, medium: 2, high: 3 };
  const disputed = overview.families.filter(
    (f) => f.status === 'disputed' && (rank[f.severity] || 0) >= (rank[minimum] || 1),
  );
  return {
    analyzedAt: overview.analyzedAt,
    totalMetrics: overview.families.length,
    disputedMetrics: disputed.map((f) => ({
      metric: f.displayName,
      severity: f.severity,
      conflictCount: f.conflictCount,
      teams: f.teams,
      canonicalOwner: f.canonicalOwner,
    })),
    trustedMetrics: overview.families.filter((f) => f.status === 'trusted').map((f) => f.displayName),
  };
}

export async function requestMetricReconciliation(payload) {
  try {
    return await requestReconciliation({
      metric: payload?.metricName,
      projectKey: payload?.projectKey ? String(payload.projectKey).toUpperCase() : null,
      sourceIssueKey: payload?.sourceIssueKey || null,
      note: payload?.note || null,
    });
  } catch (err) {
    return { created: false, message: err.message };
  }
}
