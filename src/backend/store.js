// Forge KVS persistence. Definitions are stored one per Confluence page; the
// analysis snapshot is recomputed from them whenever a definition changes.
import { kvs, WhereConditions } from '@forge/kvs';
import { analyzeAll } from '../engine/index.js';

const DEF_PREFIX = 'def:';
const ANALYSIS_KEY = 'analysis';
const SETTINGS_KEY = 'settings';

export async function saveDefinition(definition) {
  await kvs.set(`${DEF_PREFIX}${definition.pageId}`, definition);
}

export async function deleteDefinition(pageId) {
  await kvs.delete(`${DEF_PREFIX}${pageId}`);
}

export async function listDefinitions() {
  const results = [];
  let cursor;
  do {
    let query = kvs.query().where('key', WhereConditions.beginsWith(DEF_PREFIX)).limit(100);
    if (cursor) query = query.cursor(cursor);
    // eslint-disable-next-line no-await-in-loop
    const page = await query.getMany();
    results.push(...page.results.map((r) => r.value));
    cursor = page.nextCursor;
  } while (cursor);
  return results;
}

export async function rebuildAnalysis() {
  const definitions = await listDefinitions();
  const families = analyzeAll(definitions);
  const snapshot = { families, analyzedAt: new Date().toISOString(), definitionCount: definitions.length };
  await kvs.set(ANALYSIS_KEY, snapshot);
  return snapshot;
}

export async function getAnalysis() {
  return (await kvs.get(ANALYSIS_KEY)) || { families: [], analyzedAt: null, definitionCount: 0 };
}

export async function getFamily(metric) {
  const { families } = await getAnalysis();
  const needle = String(metric || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (
    families.find((f) => f.key === needle || f.names.includes(needle)) ||
    families.find((f) => f.displayName.toLowerCase() === String(metric).toLowerCase().trim()) ||
    null
  );
}

export async function getSettings() {
  return (await kvs.get(SETTINGS_KEY)) || { reconcileProjectKey: null };
}

export async function saveSettings(settings) {
  const current = await getSettings();
  const next = { ...current, ...settings };
  await kvs.set(SETTINGS_KEY, next);
  return next;
}
