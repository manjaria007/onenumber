// Keeps the metric registry in sync with Confluence.
import { findDefinitionPageIds, pageHasDefinitionLabel, readDefinition } from './confluence.js';
import { deleteDefinition, listDefinitions, rebuildAnalysis, saveDefinition } from './store.js';

export async function reindexAll(options = {}) {
  const { ids, baseUrl } = await findDefinitionPageIds(options);
  const wanted = new Set(ids);
  const existing = await listDefinitions();
  await Promise.all(existing.filter((d) => !wanted.has(d.pageId)).map((d) => deleteDefinition(d.pageId)));
  const errors = [];
  for (const id of ids) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await saveDefinition(await readDefinition(id, { ...options, baseUrl }));
    } catch (err) {
      errors.push({ pageId: id, message: err.message });
    }
  }
  const snapshot = await rebuildAnalysis();
  return { indexed: ids.length - errors.length, errors, analyzedAt: snapshot.analyzedAt };
}

export async function reindexPage(pageId) {
  if (!pageId) return null;
  const labelled = await pageHasDefinitionLabel(pageId);
  if (labelled) {
    await saveDefinition(await readDefinition(pageId));
  } else {
    await deleteDefinition(pageId);
  }
  return rebuildAnalysis();
}
