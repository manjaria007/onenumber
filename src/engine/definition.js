// Turns a Confluence "Metric Definition" page (storage format) into a
// structured metric spec that the conflict engine can compare.
import { parseSql } from './sql.js';

export const DEFINITION_LABEL = 'metric-definition';

const FIELD_ALIASES = {
  metric: 'name',
  'metric name': 'name',
  name: 'name',
  aliases: 'aliases',
  'also called': 'aliases',
  owner: 'owner',
  team: 'team',
  'owning team': 'team',
  definition: 'description',
  description: 'description',
  'time window': 'window',
  window: 'window',
  includes: 'includes',
  excludes: 'excludes',
  exclusions: 'excludes',
  source: 'source',
  'source tables': 'source',
  status: 'status',
};

const ENTITIES = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ',
};

export function decodeEntities(text) {
  return text.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
}

export function stripTags(html) {
  return decodeEntities(
    html
      .replace(/<ac:structured-macro[\s\S]*?<\/ac:structured-macro>/gi, ' ')
      .replace(/<br\s*\/?>(?!$)/gi, ', ')
      .replace(/<\/(p|li)>/gi, ', ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s*,\s*(,\s*)+/g, ', ')
    .replace(/\s+/g, ' ')
    .replace(/^[\s,]+|[\s,]+$/g, '')
    .trim();
}

export function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(/[,;]|\band\b/i)
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
}

// Reads every two-cell row (<th>label</th><td>value</td> or <td><td>) into a map.
export function parseDefinitionTable(storage) {
  const fields = {};
  const rows = storage.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  for (const row of rows) {
    const cells = row.match(/<t[hd][^>]*>[\s\S]*?<\/t[hd]>/gi) || [];
    if (cells.length < 2) continue;
    const label = stripTags(cells[0]).toLowerCase().replace(/[:*]/g, '').trim();
    const key = FIELD_ALIASES[label];
    if (!key) continue;
    fields[key] = stripTags(cells.slice(1).join(' '));
  }
  return fields;
}

export function extractSqlBlocks(storage) {
  const blocks = [];
  const re = /<ac:structured-macro[^>]*ac:name="code"[\s\S]*?<ac:plain-text-body><!\[CDATA\[([\s\S]*?)\]\]><\/ac:plain-text-body>/gi;
  let m;
  while ((m = re.exec(storage)) !== null) blocks.push(m[1]);
  return blocks;
}

export function parseWindowText(text) {
  if (!text) return null;
  const m = text.match(/(\d+)\s*-?\s*(day|week|month|quarter|year)s?/i);
  if (!m) return null;
  const mult = { day: 1, week: 7, month: 30, quarter: 90, year: 365 }[m[2].toLowerCase()];
  return Number(m[1]) * mult;
}

export function parseDefinitionPage({ id, title, storage, url, spaceKey, version }) {
  const fields = parseDefinitionTable(storage || '');
  const sqlBlocks = extractSqlBlocks(storage || '');
  const sql = sqlBlocks[0] || '';
  const parsedSql = parseSql(sql);

  const name = fields.name || title;
  const excludes = splitList(fields.excludes);
  const includes = splitList(fields.includes);
  const windowFromText = parseWindowText(fields.window);

  return {
    pageId: String(id),
    title,
    url: url || null,
    spaceKey: spaceKey || null,
    version: version ?? null,
    name,
    key: slugify(name),
    aliases: splitList(fields.aliases).map(slugify).filter(Boolean),
    owner: fields.owner || null,
    team: fields.team || null,
    status: (fields.status || 'draft').toLowerCase(),
    description: fields.description || null,
    windowDays: windowFromText ?? parsedSql?.windowDays ?? null,
    includes,
    excludes,
    tables: parsedSql?.tables ?? splitList(fields.source).map((s) => s.replace(/\s+/g, '_')),
    aggregation: parsedSql?.aggregation ?? null,
    filters: parsedSql?.filters ?? [],
    sql: sql || null,
  };
}
