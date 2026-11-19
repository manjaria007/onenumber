import React from 'react';
import { Inline, Link, List, ListItem, Lozenge, Stack, Text, Heading, SectionMessage } from '@forge/react';

export const STATUS_APPEARANCE = { disputed: 'removed', trusted: 'success', unverified: 'moved' };
export const SEVERITY_APPEARANCE = { high: 'removed', medium: 'moved', low: 'default', none: 'success' };

export function StatusLozenge({ status }) {
  return <Lozenge appearance={STATUS_APPEARANCE[status] || 'default'}>{status}</Lozenge>;
}

export function SeverityLozenge({ severity }) {
  return <Lozenge appearance={SEVERITY_APPEARANCE[severity] || 'default'}>{`${severity} impact`}</Lozenge>;
}

export function ErrorBox({ message }) {
  return (
    <SectionMessage appearance="error" title="OneNumber hit a problem">
      <Text>{message}</Text>
    </SectionMessage>
  );
}

export function CanonicalLine({ metric }) {
  const c = metric.canonicalDefinition;
  if (!c) return <Text>No page is marked as the canonical definition yet.</Text>;
  return (
    <Stack space="space.050">
      <Text>
        <Link href={c.url || '#'} openNewTab>{c.pageTitle}</Link>
        {` · owner ${c.owner || 'not set'}`}
      </Text>
      {c.description ? <Text>{c.description}</Text> : null}
    </Stack>
  );
}

export function ConflictList({ metric }) {
  if (!metric.conflicts.length) {
    return <Text>All definitions of this metric agree.</Text>;
  }
  return (
    <Stack space="space.100">
      {metric.conflicts.map((c) => (
        <Stack key={c.between.join('-')} space="space.050">
          <Inline space="space.100" alignBlock="center">
            <Text weight="bold">{`${c.between[0]} vs ${c.between[1]}`}</Text>
            <SeverityLozenge severity={c.severity} />
          </Inline>
          <List type="unordered">
            {c.differences.map((d) => (
              <ListItem key={d}>{d}</ListItem>
            ))}
          </List>
        </Stack>
      ))}
    </Stack>
  );
}

export function MetricBlock({ metric, children }) {
  return (
    <Stack space="space.100">
      <Inline space="space.100" alignBlock="center">
        <Heading size="small">{metric.metric}</Heading>
        <StatusLozenge status={metric.status} />
      </Inline>
      <CanonicalLine metric={metric} />
      <ConflictList metric={metric} />
      {children}
    </Stack>
  );
}
