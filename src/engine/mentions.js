// Finds which known metrics a piece of text (a Jira request, a page) talks about.

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function phrasesFor(family) {
  const phrases = new Set([family.displayName.toLowerCase()]);
  for (const name of family.names) phrases.add(name.replace(/-/g, ' '));
  return [...phrases].filter((p) => p.length >= 3);
}

export function findMentions(text, families) {
  if (!text) return [];
  const haystack = text.toLowerCase().replace(/[-_]/g, ' ');
  const hits = [];
  for (const family of families) {
    const matched = phrasesFor(family).filter((phrase) =>
      new RegExp(`(^|[^a-z0-9])${escapeRegex(phrase)}([^a-z0-9]|$)`, 'i').test(haystack),
    );
    if (matched.length) hits.push({ key: family.key, matched });
  }
  return hits;
}

// Flattens Atlassian Document Format (Jira descriptions/comments) into text.
export function adfToText(node) {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (Array.isArray(node)) return node.map(adfToText).join(' ');
  if (node.type === 'text') return node.text || '';
  return adfToText(node.content || []);
}
