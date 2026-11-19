// Shared use cases, called by both the UI resolvers and the Rovo/MCP actions.
import { findMentions, summarizeFamily } from '../engine/index.js';
import { readPageText } from './confluence.js';
import { enrichFamilyWithPeople } from './graph.js';
import { createReconcileTask, getIssueText } from './jira.js';
import { reindexAll } from './indexer.js';
import { getAnalysis, getFamily, getSettings } from './store.js';

export async function ensureIndexed() {
  const analysis = await getAnalysis();
  if (analysis.analyzedAt) return analysis;
  await reindexAll();
  return getAnalysis();
}

export async function metricDetails(metric, cloudId) {
  await ensureIndexed();
  const family = await getFamily(metric);
  if (!family) return null;
  return enrichFamilyWithPeople(family, cloudId);
}

export async function healthOverview() {
  const analysis = await ensureIndexed();
  const families = analysis.families.map((f) => ({
    key: f.key,
    displayName: f.displayName,
    status: f.status,
    severity: f.severity,
    definitionCount: f.definitions.length,
    conflictCount: f.conflicts.length,
    teams: [...new Set(f.definitions.map((d) => d.team).filter(Boolean))],
    canonicalOwner: f.definitions.find((d) => d.status === 'canonical')?.owner || null,
    warnings: f.warnings,
  }));
  return {
    analyzedAt: analysis.analyzedAt,
    definitionCount: analysis.definitionCount,
    disputed: families.filter((f) => f.status === 'disputed').length,
    trusted: families.filter((f) => f.status === 'trusted').length,
    unverified: families.filter((f) => f.status === 'unverified').length,
    families,
  };
}

export async function insightsForText(text) {
  const analysis = await ensureIndexed();
  const hits = findMentions(text, analysis.families);
  const byKey = new Map(analysis.families.map((f) => [f.key, f]));
  return hits.map((h) => ({ ...summarizeFamily(byKey.get(h.key)), matched: h.matched }));
}

export async function issueInsights(issueKey) {
  const issue = await getIssueText(issueKey);
  return { issue: { key: issue.key, projectKey: issue.projectKey, summary: issue.summary }, metrics: await insightsForText(issue.text) };
}

export async function pageInsights(pageId) {
  const analysis = await ensureIndexed();
  const own = analysis.families.filter((f) => f.definitions.some((d) => d.pageId === String(pageId)));
  if (own.length) {
    return { role: 'definition', metrics: own.map(summarizeFamily) };
  }
  const page = await readPageText(pageId, { asUser: true });
  return { role: 'report', metrics: await insightsForText(`${page.title} ${page.text}`) };
}

export async function requestReconciliation({ metric, projectKey, sourceIssueKey, note }) {
  await ensureIndexed();
  const family = await getFamily(metric);
  if (!family) throw new Error(`OneNumber has no definition for "${metric}".`);
  if (!family.conflicts.length) {
    return { created: false, message: `${family.displayName} has no conflicting definitions, so there is nothing to reconcile.` };
  }
  const settings = await getSettings();
  const target = projectKey || settings.reconcileProjectKey;
  if (!target) {
    throw new Error('No Jira project to create the task in. Pass projectKey or set one on the OneNumber Metric Health page.');
  }
  const task = await createReconcileTask({ projectKey: target, family, sourceIssueKey, note });
  return { created: true, key: task.key, message: `Created ${task.key} for the data team to reconcile ${family.displayName}.` };
}
