// Lightweight, dependency-free SQL reader for metric definitions.
// It does not try to be a full SQL parser. It extracts the parts that make
// two "same name" metrics disagree: aggregation, source tables, filters and
// the time window.

const TIME_UNITS = {
  day: 1, days: 1, d: 1,
  week: 7, weeks: 7, w: 7,
  month: 30, months: 30, mon: 30,
  quarter: 90, quarters: 90,
  year: 365, years: 365, y: 365,
};

function stripComments(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');
}

function squash(text) {
  return text.replace(/\s+/g, ' ').trim();
}

// Split on a keyword only at parenthesis depth 0.
function splitTopLevel(text, separatorRegex) {
  const parts = [];
  let depth = 0;
  let current = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '(') depth += 1;
    if (ch === ')') depth -= 1;
    if (depth === 0) {
      const rest = text.slice(i);
      const match = rest.match(separatorRegex);
      if (match && match.index === 0) {
        parts.push(current);
        current = '';
        i += match[0].length;
        continue;
      }
    }
    current += ch;
    i += 1;
  }
  parts.push(current);
  return parts.map((p) => p.trim()).filter(Boolean);
}

// Return the text of a clause (e.g. WHERE ...) up to the next major keyword.
function clause(sql, keyword, terminators) {
  const re = new RegExp(`\\b${keyword}\\b`, 'i');
  const start = sql.search(re);
  if (start === -1) return '';
  const after = sql.slice(start).replace(re, '');
  let end = after.length;
  for (const t of terminators) {
    const idx = after.search(new RegExp(`\\b${t}\\b`, 'i'));
    if (idx !== -1 && idx < end) end = idx;
  }
  return after.slice(0, end).trim();
}

export function extractTables(sql) {
  const tables = new Set();
  const re = /\b(?:from|join)\s+([a-zA-Z_][\w.]*)/gi;
  let m;
  while ((m = re.exec(sql)) !== null) {
    const name = m[1].toLowerCase();
    if (name !== 'select') tables.add(name);
  }
  return [...tables].sort();
}

export function extractAggregation(sql) {
  const select = clause(sql, 'select', ['from']);
  const distinct = select.match(/\bcount\s*\(\s*distinct\s+([\w.]+)/i);
  if (distinct) {
    return { fn: 'count distinct', column: distinct[1].toLowerCase().replace(/^\w+\./, '') };
  }
  const agg = select.match(/\b(count|sum|avg|min|max)\s*\(\s*([\w.*]+)/i);
  if (!agg) return null;
  return { fn: agg[1].toLowerCase(), column: agg[2].toLowerCase().replace(/^\w+\./, '') };
}

// Detect a rolling time window and return its length in days.
export function detectWindowDays(text) {
  const patterns = [
    // INTERVAL '30 days' / INTERVAL '3 month'
    /interval\s*'\s*(\d+)\s*([a-z]+)\s*'/i,
    // INTERVAL 30 DAY
    /interval\s+(\d+)\s+([a-z]+)/i,
    // DATEADD(day, -30, ...) / DATE_ADD / DATEADD('day', -30
    /date_?add\s*\(\s*'?([a-z]+)'?\s*,\s*-?\s*(\d+)/i,
    // current_date - 30
    /current_date\s*-\s*(\d+)\b/i,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    if (re.source.startsWith('date_?add')) {
      const unit = TIME_UNITS[m[1].toLowerCase()] ?? 1;
      return Number(m[2]) * unit;
    }
    if (re.source.startsWith('current_date')) return Number(m[1]);
    const unit = TIME_UNITS[m[2].toLowerCase()] ?? 1;
    return Number(m[1]) * unit;
  }
  return null;
}

// Removes parentheses only when they wrap the whole predicate: "(a = 1)".
function unwrapParens(text) {
  let current = text;
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0;
    let wrapsAll = true;
    for (let i = 0; i < current.length; i += 1) {
      if (current[i] === '(') depth += 1;
      if (current[i] === ')') depth -= 1;
      if (depth === 0 && i < current.length - 1) {
        wrapsAll = false;
        break;
      }
    }
    if (!wrapsAll) break;
    current = current.slice(1, -1).trim();
  }
  return current;
}

function normalizeValue(raw) {
  return raw.trim().replace(/^['"]|['"]$/g, '').toLowerCase();
}

// Turn one WHERE predicate into { field, op, value }.
export function parsePredicate(predicate) {
  const text = unwrapParens(squash(predicate));
  const patterns = [
    [/^([\w.]+)\s+is\s+not\s+null$/i, (m) => ({ field: m[1], op: 'is not null', value: null })],
    [/^([\w.]+)\s+is\s+null$/i, (m) => ({ field: m[1], op: 'is null', value: null })],
    [/^([\w.]+)\s+not\s+in\s*\((.+)\)$/i, (m) => ({ field: m[1], op: 'not in', value: m[2].split(',').map(normalizeValue).sort().join(',') })],
    [/^([\w.]+)\s+in\s*\((.+)\)$/i, (m) => ({ field: m[1], op: 'in', value: m[2].split(',').map(normalizeValue).sort().join(',') })],
    [/^([\w.]+)\s*(<>|!=)\s*(.+)$/i, (m) => ({ field: m[1], op: '!=', value: normalizeValue(m[3]) })],
    [/^([\w.]+)\s*(>=|<=|=|<|>)\s*(.+)$/i, (m) => ({ field: m[1], op: m[2], value: normalizeValue(m[3]) })],
  ];
  for (const [re, build] of patterns) {
    const m = text.match(re);
    if (m) {
      const p = build(m);
      return { field: p.field.toLowerCase().replace(/^\w+\./, ''), op: p.op, value: p.value };
    }
  }
  return { field: null, op: 'raw', value: text.toLowerCase() };
}

export function parseSql(rawSql) {
  if (!rawSql || !rawSql.trim()) return null;
  const sql = squash(stripComments(rawSql));
  const where = clause(sql, 'where', ['group by', 'order by', 'having', 'limit', 'qualify']);
  const predicates = where ? splitTopLevel(where, /^\s+and\s+/i) : [];
  const filters = [];
  let windowDays = null;
  for (const p of predicates) {
    const days = detectWindowDays(p);
    if (days !== null) {
      windowDays = days;
      continue;
    }
    filters.push(parsePredicate(p));
  }
  const groupBy = clause(sql, 'group by', ['order by', 'having', 'limit', 'qualify']);
  return {
    tables: extractTables(sql),
    aggregation: extractAggregation(sql),
    filters,
    windowDays: windowDays ?? detectWindowDays(sql),
    groupBy: groupBy ? groupBy.split(',').map((g) => g.trim().toLowerCase()) : [],
  };
}
