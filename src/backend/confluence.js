// Confluence access: find pages labelled as metric definitions and read their
// storage-format bodies.
import api, { route } from '@forge/api';
import { DEFINITION_LABEL, parseDefinitionPage } from '../engine/index.js';

async function json(response, what) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${what} failed: ${response.status} ${body.slice(0, 300)}`);
  }
  return response.json();
}

function client(asUser) {
  return asUser ? api.asUser() : api.asApp();
}

export async function findDefinitionPageIds({ asUser = false } = {}) {
  const cql = `label = "${DEFINITION_LABEL}" and type = page`;
  const ids = [];
  let start = 0;
  let baseUrl = null;
  for (;;) {
    // eslint-disable-next-line no-await-in-loop
    const data = await json(
      // eslint-disable-next-line no-await-in-loop
      await client(asUser).requestConfluence(
        route`/wiki/rest/api/search?cql=${cql}&limit=50&start=${start}`,
        { headers: { Accept: 'application/json' } },
      ),
      'Confluence search',
    );
    baseUrl = baseUrl || data?._links?.base || null;
    for (const r of data.results || []) {
      if (r.content?.id) ids.push(String(r.content.id));
    }
    if (!data.results || data.results.length < 50) break;
    start += 50;
  }
  return { ids, baseUrl };
}

export async function fetchPage(pageId, { asUser = false, baseUrl = null } = {}) {
  const page = await json(
    await client(asUser).requestConfluence(route`/wiki/api/v2/pages/${pageId}?body-format=storage`, {
      headers: { Accept: 'application/json' },
    }),
    `Read page ${pageId}`,
  );
  const base = baseUrl || page?._links?.base || '';
  return {
    id: String(page.id),
    title: page.title,
    storage: page.body?.storage?.value || '',
    url: page._links?.webui ? `${base}${page._links.webui}` : null,
    spaceId: page.spaceId || null,
    version: page.version?.number ?? null,
  };
}

export async function pageHasDefinitionLabel(pageId, { asUser = false } = {}) {
  const data = await json(
    await client(asUser).requestConfluence(route`/wiki/api/v2/pages/${pageId}/labels?limit=100`, {
      headers: { Accept: 'application/json' },
    }),
    `Read labels for ${pageId}`,
  );
  return (data.results || []).some((l) => l.name === DEFINITION_LABEL);
}

export async function readDefinition(pageId, options = {}) {
  const page = await fetchPage(pageId, options);
  return parseDefinitionPage(page);
}

// Plain text of any page, used to spot metric mentions on report pages.
export async function readPageText(pageId, options = {}) {
  const page = await fetchPage(pageId, options);
  return { title: page.title, text: page.storage.replace(/<[^>]+>/g, ' ') };
}
