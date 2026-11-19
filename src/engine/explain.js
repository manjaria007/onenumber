// Plain-English explanations built from the rule-based findings.
// Business readers get this text; it never invents a difference that the
// engine did not find.

export function explainConflict(conflict) {
  const lines = conflict.differences.map((d) => `• ${d.summary}`);
  return [
    `${conflict.leftLabel} and ${conflict.rightLabel} define this metric differently (${conflict.severity} impact):`,
    ...lines,
  ].join('\n');
}

export function explainFamily(family) {
  const header = `${family.displayName}: ${family.definitions.length} definition(s), status ${family.status}.`;
  if (!family.conflicts.length) {
    const canonical = family.definitions.find((d) => d.status === 'canonical');
    const owner = canonical?.owner ? ` Owner: ${canonical.owner}.` : '';
    return `${header} All definitions agree.${owner}${family.warnings.length ? ` Note: ${family.warnings.join(' ')}` : ''}`;
  }
  return [header, ...family.conflicts.map(explainConflict), ...family.warnings.map((w) => `Note: ${w}`)].join('\n\n');
}

// Compact, JSON-friendly view for Rovo actions and MCP tools.
export function summarizeFamily(family) {
  const canonical = family.definitions.find((d) => d.status === 'canonical') || null;
  return {
    metric: family.displayName,
    key: family.key,
    alsoKnownAs: family.names,
    status: family.status,
    severity: family.severity,
    canonicalDefinition: canonical
      ? {
          pageTitle: canonical.title,
          url: canonical.url,
          owner: canonical.owner,
          team: canonical.team,
          description: canonical.description,
          windowDays: canonical.windowDays,
          excludes: canonical.excludes,
        }
      : null,
    definitions: family.definitions.map((d) => ({
      pageId: d.pageId,
      pageTitle: d.title,
      url: d.url,
      team: d.team,
      owner: d.owner,
      status: d.status,
      windowDays: d.windowDays,
      excludes: d.excludes,
      filters: d.filters,
      aggregation: d.aggregation,
    })),
    conflicts: family.conflicts.map((c) => ({
      between: [c.leftLabel, c.rightLabel],
      severity: c.severity,
      differences: c.differences.map((d) => d.summary),
    })),
    warnings: family.warnings,
    explanation: explainFamily(family),
  };
}
