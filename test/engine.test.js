import { describe, expect, it } from 'vitest';
import {
  parseSql,
  parsePredicate,
  detectWindowDays,
  parseDefinitionPage,
  analyzeAll,
  compareDefinitions,
  findMentions,
  adfToText,
  summarizeFamily,
} from '../src/engine/index.js';
import { buildDefinitionStorage } from '../demo/storage.js';
import { METRIC_PAGES, JIRA_REQUESTS } from '../demo/brightloop.js';

const pages = METRIC_PAGES.map((p, i) =>
  parseDefinitionPage({
    id: 100 + i,
    title: p.title,
    storage: buildDefinitionStorage(p.fields, p.sql),
    url: `https://example.atlassian.net/wiki/pages/${100 + i}`,
  }),
);

describe('sql reader', () => {
  it('detects rolling windows in several dialects', () => {
    expect(detectWindowDays("x >= current_date - INTERVAL '90 days'")).toBe(90);
    expect(detectWindowDays('x >= now() - INTERVAL 30 DAY')).toBe(30);
    expect(detectWindowDays('x >= DATEADD(day, -28, getdate())')).toBe(28);
    expect(detectWindowDays("x >= DATEADD('month', -3, current_date)")).toBe(90);
    expect(detectWindowDays('x >= current_date - 7')).toBe(7);
    expect(detectWindowDays('x = 1')).toBeNull();
  });

  it('parses predicates', () => {
    expect(parsePredicate("s.status = 'cancelled'")).toEqual({ field: 'status', op: '=', value: 'cancelled' });
    expect(parsePredicate("account_type <> 'internal'")).toEqual({ field: 'account_type', op: '!=', value: 'internal' });
    expect(parsePredicate("plan IN ('pro', 'basic')")).toEqual({ field: 'plan', op: 'in', value: 'basic,pro' });
    expect(parsePredicate('deleted_at IS NULL')).toEqual({ field: 'deleted_at', op: 'is null', value: null });
  });

  it('extracts tables, aggregation, filters and window', () => {
    const parsed = parseSql(METRIC_PAGES[0].sql);
    expect(parsed.tables).toEqual(['billing.subscriptions']);
    expect(parsed.aggregation).toEqual({ fn: 'count distinct', column: 'account_id' });
    expect(parsed.windowDays).toBe(90);
    expect(parsed.filters.map((f) => f.field)).toEqual(['status', 'is_trial', 'account_type']);
  });

  it('does not split AND inside parentheses', () => {
    const parsed = parseSql("SELECT SUM(x) FROM t WHERE (a = 1 AND b = 2) AND c = 'z'");
    expect(parsed.filters).toHaveLength(2);
  });
});

describe('definition pages', () => {
  it('reads the template table and the SQL block', () => {
    const finance = pages[0];
    expect(finance.name).toBe('Churn rate');
    expect(finance.key).toBe('churn-rate');
    expect(finance.aliases).toEqual(['customer-churn', 'logo-churn']);
    expect(finance.status).toBe('canonical');
    expect(finance.team).toBe('Finance');
    expect(finance.windowDays).toBe(90);
    expect(finance.excludes).toEqual(['trial accounts', 'internal test accounts']);
  });
});

describe('conflict engine', () => {
  const families = analyzeAll(pages);
  const byKey = Object.fromEntries(families.map((f) => [f.key, f]));

  it('groups definitions by name and alias', () => {
    expect(families).toHaveLength(3);
    expect(byKey['churn-rate'].definitions).toHaveLength(2);
    expect(byKey['net-revenue'].definitions).toHaveLength(2);
    expect(byKey['active-customers'].definitions).toHaveLength(2);
  });

  it('flags the churn conflict as high with the window and population differences', () => {
    const churn = byKey['churn-rate'];
    expect(churn.status).toBe('disputed');
    expect(churn.severity).toBe('high');
    const dims = churn.conflicts[0].differences.map((d) => d.dimension);
    expect(dims).toContain('time window');
    expect(dims).toContain('exclusions');
    expect(dims).toContain('inclusions');
  });

  it('flags net revenue for calculation and exclusions', () => {
    const rev = byKey['net-revenue'];
    const dims = rev.conflicts[0].differences.map((d) => d.dimension);
    expect(dims).toContain('calculation');
    expect(dims).toContain('exclusions');
  });

  it('marks identical definitions as trusted', () => {
    const active = byKey['active-customers'];
    expect(active.conflicts).toHaveLength(0);
    expect(active.status).toBe('trusted');
  });

  it('orders the worst families first', () => {
    expect(families[0].severity).toBe('high');
    expect(families[families.length - 1].key).toBe('active-customers');
  });

  it('reports no differences for a definition compared with itself', () => {
    expect(compareDefinitions(pages[0], pages[0])).toEqual([]);
  });

  it('summarizes families for Rovo and MCP tools', () => {
    const summary = summarizeFamily(byKey['churn-rate']);
    expect(summary.canonicalDefinition.owner).toMatch(/Priya/);
    expect(summary.conflicts[0].between).toEqual(['Finance', 'Marketing']);
    expect(summary.explanation).toMatch(/90 days vs 30 days/);
  });
});

describe('mentions', () => {
  const families = analyzeAll(pages);

  it('finds metrics named in Jira requests, including aliases', () => {
    const hits = findMentions(`${JIRA_REQUESTS[0].summary} ${JIRA_REQUESTS[0].description}`, families);
    expect(hits.map((h) => h.key)).toEqual(['churn-rate']);
    const revenue = findMentions(JIRA_REQUESTS[1].summary, families);
    expect(revenue.map((h) => h.key)).toEqual(['net-revenue']);
  });

  it('does not match partial words', () => {
    expect(findMentions('the churning butter', families)).toEqual([]);
  });

  it('flattens ADF', () => {
    const adf = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'net revenue' }] }] };
    expect(adfToText(adf).trim()).toBe('net revenue');
  });
});
