import React, { useEffect, useState } from 'react';
import ForgeReconciler, { Button, SectionMessage, Spinner, Stack, Text } from '@forge/react';
import { invoke } from '@forge/bridge';
import { ErrorBox, MetricBlock } from './shared.jsx';

function ReconcileButton({ metric }) {
  const [state, setState] = useState({ busy: false, result: null, error: null });
  if (metric.status !== 'disputed') return null;
  if (state.result) return <Text>{state.result}</Text>;
  return (
    <Stack space="space.050">
      <Button
        appearance="primary"
        isDisabled={state.busy}
        onClick={async () => {
          setState({ busy: true, result: null, error: null });
          const res = await invoke('requestReconciliation', { metric: metric.key });
          if (res.ok) setState({ busy: false, result: res.data.message, error: null });
          else setState({ busy: false, result: null, error: res.error });
        }}
      >
        Ask the data team to reconcile
      </Button>
      {state.error ? <Text>{state.error}</Text> : null}
    </Stack>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    invoke('getIssueInsights').then((res) => (res.ok ? setData(res.data) : setError(res.error)));
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner label="Checking metric definitions" />;
  if (!data.metrics.length) {
    return <Text>This request doesn't mention any metric OneNumber tracks.</Text>;
  }

  const disputed = data.metrics.filter((m) => m.status === 'disputed');
  return (
    <Stack space="space.200">
      {disputed.length ? (
        <SectionMessage appearance="warning" title="Conflicting metric definitions">
          <Text>
            {`This request mentions ${disputed.map((m) => m.metric).join(', ')}, which different teams define differently. The numbers being compared may not be measuring the same thing.`}
          </Text>
        </SectionMessage>
      ) : (
        <SectionMessage appearance="success" title="Metric definitions agree">
          <Text>Every metric mentioned here has a single, agreed definition.</Text>
        </SectionMessage>
      )}
      {data.metrics.map((m) => (
        <MetricBlock key={m.key} metric={m}>
          <ReconcileButton metric={m} />
        </MetricBlock>
      ))}
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
