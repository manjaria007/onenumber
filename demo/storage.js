// Builds a Confluence storage-format "Metric Definition" page body.
// Used by the seed script and by the unit tests, so both see the same markup.

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export const TEMPLATE_FIELDS = [
  'Metric',
  'Aliases',
  'Owner',
  'Team',
  'Status',
  'Definition',
  'Time window',
  'Includes',
  'Excludes',
  'Source tables',
];

export function buildDefinitionStorage(fields, sql) {
  const rows = TEMPLATE_FIELDS.filter((label) => fields[label] !== undefined)
    .map((label) => `<tr><th><p><strong>${label}</strong></p></th><td><p>${escapeHtml(fields[label])}</p></td></tr>`)
    .join('');
  const table = `<table data-layout="default"><tbody>${rows}</tbody></table>`;
  const code = sql
    ? `<h2>Calculation</h2><ac:structured-macro ac:name="code" ac:schema-version="1"><ac:parameter ac:name="language">sql</ac:parameter><ac:plain-text-body><![CDATA[${sql}]]></ac:plain-text-body></ac:structured-macro>`
    : '';
  return `<p>This page is a OneNumber metric definition. Keep the table up to date; OneNumber compares it with every other definition of the same metric.</p>${table}${code}`;
}
