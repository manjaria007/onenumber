// Jira access: read a business request and create reconcile tasks for the data team.
import api, { route } from '@forge/api';
import { adfToText } from '../engine/index.js';

async function json(response, what) {
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${what} failed: ${response.status} ${body.slice(0, 300)}`);
  }
  return response.status === 204 ? null : response.json();
}

export async function getIssueText(issueKey) {
  const issue = await json(
    await api.asUser().requestJira(route`/rest/api/3/issue/${issueKey}?fields=summary,description,project`, {
      headers: { Accept: 'application/json' },
    }),
    `Read issue ${issueKey}`,
  );
  return {
    key: issue.key,
    projectKey: issue.fields?.project?.key || null,
    summary: issue.fields?.summary || '',
    text: `${issue.fields?.summary || ''}\n${adfToText(issue.fields?.description)}`,
  };
}

async function pickIssueTypeId(projectKey) {
  const data = await json(
    await api.asUser().requestJira(route`/rest/api/3/issue/createmeta/${projectKey}/issuetypes`, {
      headers: { Accept: 'application/json' },
    }),
    `Read issue types for ${projectKey}`,
  );
  const types = (data.issueTypes || data.values || []).filter((t) => !t.subtask);
  const task = types.find((t) => t.name.toLowerCase() === 'task') || types[0];
  if (!task) throw new Error(`Project ${projectKey} has no usable issue type.`);
  return task.id;
}

function paragraph(text) {
  return { type: 'paragraph', content: [{ type: 'text', text }] };
}

function link(text, href) {
  return { type: 'paragraph', content: [{ type: 'text', text, marks: [{ type: 'link', attrs: { href } }] }] };
}

export function buildReconcileDescription(family, note) {
  const content = [
    paragraph(`OneNumber found ${family.conflicts.length} conflicting definition pair(s) for "${family.displayName}". Please agree one canonical definition, mark it Canonical on its Confluence page, and update or retire the others.`),
  ];
  if (note) content.push(paragraph(`Requested context: ${note}`));
  for (const conflict of family.conflicts) {
    content.push(paragraph(`${conflict.leftLabel} vs ${conflict.rightLabel} (${conflict.severity} impact):`));
    content.push({
      type: 'bulletList',
      content: conflict.differences.map((d) => ({ type: 'listItem', content: [paragraph(d.summary)] })),
    });
  }
  for (const d of family.definitions) {
    if (d.url) content.push(link(`${d.title} (${d.team || 'unknown team'}, owner: ${d.owner || 'none'})`, d.url));
  }
  return { type: 'doc', version: 1, content };
}

export async function createReconcileTask({ projectKey, family, sourceIssueKey, note }) {
  const issueTypeId = await pickIssueTypeId(projectKey);
  const created = await json(
    await api.asUser().requestJira(route`/rest/api/3/issue`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: {
          project: { key: projectKey },
          issuetype: { id: issueTypeId },
          summary: `Reconcile metric definition: ${family.displayName}`,
          labels: ['onenumber', `metric-${family.key}`],
          description: buildReconcileDescription(family, note),
        },
      }),
    }),
    'Create reconcile task',
  );
  if (sourceIssueKey) {
    await json(
      await api.asUser().requestJira(route`/rest/api/3/issueLink`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: { name: 'Relates' },
          inwardIssue: { key: created.key },
          outwardIssue: { key: sourceIssueKey },
        }),
      }),
      'Link reconcile task',
    ).catch((err) => console.warn(`Could not link ${created.key} to ${sourceIssueKey}: ${err.message}`));
  }
  return { key: created.key, id: created.id };
}
