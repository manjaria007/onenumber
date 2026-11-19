// Rule-based conflict engine. No LLM involved: every finding is traceable to
// a specific field on two specific Confluence pages.

const SEVERITY_RANK = { none: 0, low: 1, medium: 2, high: 3 };

export function maxSeverity(list) {
  return list.reduce(
    (worst, s) => (SEVERITY_RANK[s] > SEVERITY_RANK[worst] ? s : worst),
    'none',
  );
}

function filterKey(f) {
  return f.field ?? `raw:${f.value}`;
}

function describeFilter(f) {
  if (!f) return 'no filter';
  if (f.op === 'raw') return f.value;
  if (f.value === null) return `${f.field} ${f.op}`;
  return `${f.field} ${f.op} ${f.value}`;
}

function setDiff(a, b) {
  const sb = new Set(b);
  return a.filter((x) => !sb.has(x));
}

// Compare two metric specs. Returns a list of differences.
export function compareDefinitions(a, b) {
  const diffs = [];

  if (a.windowDays !== null && b.windowDays !== null && a.windowDays !== b.windowDays) {
    diffs.push({
      dimension: 'time window',
      severity: 'high',
      left: `${a.windowDays} days`,
      right: `${b.windowDays} days`,
      summary: `Time window differs: ${a.windowDays} days vs ${b.windowDays} days.`,
    });
  } else if ((a.windowDays === null) !== (b.windowDays === null)) {
    diffs.push({
      dimension: 'time window',
      severity: 'medium',
      left: a.windowDays === null ? 'not stated' : `${a.windowDays} days`,
      right: b.windowDays === null ? 'not stated' : `${b.windowDays} days`,
      summary: 'Only one definition states a time window.',
    });
  }

  if (a.aggregation && b.aggregation) {
    const sameFn = a.aggregation.fn === b.aggregation.fn;
    const sameCol = a.aggregation.column === b.aggregation.column;
    if (!sameFn || !sameCol) {
      const fmt = (agg) => `${agg.fn}(${agg.column ?? '*'})`;
      diffs.push({
        dimension: 'calculation',
        severity: 'high',
        left: fmt(a.aggregation),
        right: fmt(b.aggregation),
        summary: `Calculated differently: ${fmt(a.aggregation)} vs ${fmt(b.aggregation)}.`,
      });
    }
  }

  const exclOnlyA = setDiff(a.excludes, b.excludes);
  const exclOnlyB = setDiff(b.excludes, a.excludes);
  if (exclOnlyA.length || exclOnlyB.length) {
    diffs.push({
      dimension: 'exclusions',
      severity: 'medium',
      left: a.excludes.join(', ') || 'none',
      right: b.excludes.join(', ') || 'none',
      summary: [
        exclOnlyA.length ? `Only the first excludes ${exclOnlyA.join(', ')}.` : '',
        exclOnlyB.length ? `Only the second excludes ${exclOnlyB.join(', ')}.` : '',
      ].filter(Boolean).join(' '),
    });
  }

  const inclOnlyA = setDiff(a.includes, b.includes);
  const inclOnlyB = setDiff(b.includes, a.includes);
  if (inclOnlyA.length || inclOnlyB.length) {
    diffs.push({
      dimension: 'inclusions',
      severity: 'medium',
      left: a.includes.join(', ') || 'none',
      right: b.includes.join(', ') || 'none',
      summary: 'The definitions include different populations.',
    });
  }

  const byFieldA = new Map(a.filters.map((f) => [filterKey(f), f]));
  const byFieldB = new Map(b.filters.map((f) => [filterKey(f), f]));
  const fields = new Set([...byFieldA.keys(), ...byFieldB.keys()]);
  for (const field of fields) {
    const fa = byFieldA.get(field);
    const fb = byFieldB.get(field);
    if (fa && fb) {
      if (fa.op !== fb.op || fa.value !== fb.value) {
        diffs.push({
          dimension: 'filter',
          severity: 'high',
          left: describeFilter(fa),
          right: describeFilter(fb),
          summary: `Same field filtered differently: "${describeFilter(fa)}" vs "${describeFilter(fb)}".`,
        });
      }
    } else {
      const only = fa || fb;
      diffs.push({
        dimension: 'filter',
        severity: 'medium',
        left: describeFilter(fa),
        right: describeFilter(fb),
        summary: `Only the ${fa ? 'first' : 'second'} definition filters on "${describeFilter(only)}".`,
      });
    }
  }

  if (a.tables.length && b.tables.length) {
    const tOnlyA = setDiff(a.tables, b.tables);
    const tOnlyB = setDiff(b.tables, a.tables);
    if (tOnlyA.length || tOnlyB.length) {
      diffs.push({
        dimension: 'source',
        severity: 'low',
        left: a.tables.join(', '),
        right: b.tables.join(', '),
        summary: 'The definitions read from different source tables.',
      });
    }
  }

  return diffs;
}

// Group definitions that describe the same metric (same key or a shared alias).
export function groupIntoFamilies(definitions) {
  const parent = new Map();
  const find = (x) => {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    parent.set(x, root);
    return root;
  };
  const union = (x, y) => parent.set(find(x), find(y));

  for (const d of definitions) {
    find(d.key);
    for (const alias of d.aliases) union(alias, d.key);
  }

  const families = new Map();
  for (const d of definitions) {
    const root = find(d.key);
    if (!families.has(root)) families.set(root, []);
    families.get(root).push(d);
  }

  return [...families.values()].map((defs) => {
    const canonical = defs.filter((d) => d.status === 'canonical');
    const primary = canonical[0] || defs[0];
    const names = new Set();
    for (const d of defs) {
      names.add(d.key);
      d.aliases.forEach((a) => names.add(a));
    }
    return {
      key: primary.key,
      displayName: primary.name,
      names: [...names].sort(),
      definitions: defs,
      canonicalPageIds: canonical.map((d) => d.pageId),
    };
  });
}

export function analyzeFamily(family) {
  const conflicts = [];
  const defs = family.definitions;
  for (let i = 0; i < defs.length; i += 1) {
    for (let j = i + 1; j < defs.length; j += 1) {
      const differences = compareDefinitions(defs[i], defs[j]);
      if (differences.length) {
        conflicts.push({
          leftPageId: defs[i].pageId,
          rightPageId: defs[j].pageId,
          leftLabel: defs[i].team || defs[i].title,
          rightLabel: defs[j].team || defs[j].title,
          severity: maxSeverity(differences.map((d) => d.severity)),
          differences,
        });
      }
    }
  }

  const warnings = [];
  if (family.canonicalPageIds.length > 1) {
    warnings.push('More than one page claims to be the canonical definition.');
  }
  if (family.canonicalPageIds.length === 0) {
    warnings.push('No page is marked as the canonical definition yet.');
  }
  if (defs.some((d) => !d.owner)) {
    warnings.push('At least one definition has no named owner.');
  }

  return {
    ...family,
    conflicts,
    warnings,
    severity: maxSeverity(conflicts.map((c) => c.severity)),
    status: conflicts.length ? 'disputed' : family.canonicalPageIds.length === 1 ? 'trusted' : 'unverified',
  };
}

export function analyzeAll(definitions) {
  return groupIntoFamilies(definitions)
    .map(analyzeFamily)
    .sort((x, y) => SEVERITY_RANK[y.severity] - SEVERITY_RANK[x.severity] || x.displayName.localeCompare(y.displayName));
}
