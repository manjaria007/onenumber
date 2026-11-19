// Confluence macro: drop a "OneNumber metric card" on any report page.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Label, List, ListItem, Spinner, Stack, Text, Textfield, useConfig } from '@forge/react';
import { invoke } from '@forge/bridge';
import { ErrorBox, MetricBlock } from './shared.jsx';

function People({ people, metric }) {
  const lines = metric.definitions
    .map((d) => {
      const names = people?.[d.pageId]?.people?.map((p) => p.displayName) || [];
      return names.length ? `${d.team || d.pageTitle}: ${names.join(', ')} (from Teamwork Graph)` : null;
    })
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <Stack space="space.050">
      <Text weight="bold">Who works on these definitions</Text>
      <List type="unordered">
        {lines.map((l) => (
          <ListItem key={l}>{l}</ListItem>
        ))}
      </List>
    </Stack>
  );
}

function App() {
  const config = useConfig();
  const metricName = config?.metric;
  const [data, setData] = useState(undefined);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!metricName) return;
    invoke('getMetric', { metric: metricName }).then((res) => (res.ok ? setData(res.data) : setError(res.error)));
  }, [metricName]);

  if (!metricName) return <Text>Edit this macro and enter a metric name, for example "Churn rate".</Text>;
  if (error) return <ErrorBox message={error} />;
  if (data === undefined) return <Spinner label="Loading metric" />;
  if (data === null) return <Text>{`OneNumber has no definition for "${metricName}" yet.`}</Text>;

  return (
    <MetricBlock metric={data}>
      <People people={data.people} metric={data} />
    </MetricBlock>
  );
}

function Config() {
  return (
    <>
      <Label labelFor="metric">Metric name</Label>
      <Textfield name="metric" id="metric" placeholder="Churn rate" />
    </>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
ForgeReconciler.addConfig(<Config />);
