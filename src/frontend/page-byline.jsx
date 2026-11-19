// Confluence byline item: warns readers when a page relies on a disputed metric.
import React, { useEffect, useState } from 'react';
import ForgeReconciler, { SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { ErrorBox, MetricBlock } from './shared.jsx';

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    invoke('getPageInsights').then((res) => (res.ok ? setData(res.data) : setError(res.error)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner label="Checking metrics on this page" />;
  if (!data.metrics.length) return <Text>No tracked metrics on this page.</Text>;

  const disputed = data.metrics.filter((m) => m.status === 'disputed');
  return (
    <Stack space="space.200">
      {disputed.length ? (
        <SectionMessage appearance="warning" title={data.role === 'definition' ? 'This definition conflicts with others' : 'This page uses disputed metrics'}>
          <Text>{disputed.map((m) => m.metric).join(', ')}</Text>
        </SectionMessage>
      ) : null}
      {data.metrics.map((m) => (
        <MetricBlock key={m.key} metric={m} />
      ))}
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
