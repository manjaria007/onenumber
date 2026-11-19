// Confluence event and schedule triggers keep the registry fresh without
// anyone pressing "Rescan".
import { reindexAll, reindexPage } from './indexer.js';

function pageIdFrom(event) {
  return event?.content?.id || event?.page?.id || event?.target?.id || null;
}

export async function onPageEvent(event) {
  const pageId = pageIdFrom(event);
  try {
    await reindexPage(pageId);
  } catch (err) {
    console.error(`OneNumber could not reindex page ${pageId}: ${err.message}`);
  }
}

export async function onSchedule() {
  try {
    const result = await reindexAll();
    console.log(`OneNumber scheduled reindex: ${result.indexed} definitions, ${result.errors.length} errors`);
  } catch (err) {
    console.error(`OneNumber scheduled reindex failed: ${err.message}`);
  }
}
