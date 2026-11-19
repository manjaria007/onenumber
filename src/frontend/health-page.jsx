import React, { useEffect, useState } from 'react';
import ForgeReconciler, {
  Badge,
  Button,
  DynamicTable,
  Form,
  FormFooter,
  Heading,
  Inline,
  Label,
  SectionMessage,
  Spinner,
  Stack,
  Text,
  Textfield,
  useForm,
} from '@forge/react';
import { invoke } from '@forge/bridge';
import { ErrorBox, SeverityLozenge, StatusLozenge } from './shared.jsx';

const HEAD = {
  cells: [
    { key: 'metric', content: 'Metric', isSortable: true },
    { key: 'status', content: 'Status' },
    { key: 'impact', content: 'Impact' },
    { key: 'defs', content: 'Definitions' },
    { key: 'teams', content: 'Teams' },
    { key: 'owner', content: 'Canonical owner' },
  ],
};

function Settings() {
  const { handleSubmit, register } = useForm();
  const [saved, setSaved] = useState(null);
  const [current, setCurrent] = useState(null);
  useEffect(() => {
    invoke('getSettings').then((res) => res.ok && setCurrent(res.data));
  }, []);
  return (
    <Form
      onSubmit={handleSubmit(async (values) => {
        const res = await invoke('saveSettings', values);
        setSaved(res.ok ? `Saved: reconcile tasks go to ${res.data.reconcileProjectKey || 'the request’s own project'}.` : res.error);
      })}
    >
      <Label labelFor="reconcileProjectKey">Jira project for data-team reconcile tasks (key)</Label>
      <Textfield
        {...register('reconcileProjectKey')}
        id="reconcileProjectKey"
        placeholder={current?.reconcileProjectKey || 'e.g. DATA'}
      />
      <FormFooter>
        <Button type="submit">Save</Button>
      </FormFooter>
      {saved ? <Text>{saved}</Text> : null}
    </Form>
  );
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [scanning, setScanning] = useState(false);

  const load = () =>
    invoke('getHealth').then((res) => (res.ok ? setData(res.data) : setError(res.error)));

  useEffect(() => {
    load();
  }, []);

  if (error) return <ErrorBox message={error} />;
  if (!data) return <Spinner label="Loading metric health" />;

  const rows = data.families.map((f) => ({
    key: f.key,
    cells: [
      { key: 'metric', content: f.displayName },
      { key: 'status', content: <StatusLozenge status={f.status} /> },
      { key: 'impact', content: f.status === 'disputed' ? <SeverityLozenge severity={f.severity} /> : '—' },
      { key: 'defs', content: String(f.definitionCount) },
      { key: 'teams', content: f.teams.join(', ') || '—' },
      { key: 'owner', content: f.canonicalOwner || 'not set' },
    ],
  }));

  return (
    <Stack space="space.300">
      <Stack space="space.100">
        <Heading size="large">OneNumber · Metric Health</Heading>
        <Text>One trusted definition per business metric. Definitions are Confluence pages labelled "metric-definition".</Text>
      </Stack>
      <Inline space="space.200" alignBlock="center">
        <Text>Disputed</Text>
        <Badge appearance="important">{data.disputed}</Badge>
        <Text>Trusted</Text>
        <Badge appearance="added">{data.trusted}</Badge>
        <Text>Unverified</Text>
        <Badge>{data.unverified}</Badge>
        <Button
          isDisabled={scanning}
          onClick={async () => {
            setScanning(true);
            const res = await invoke('rescan');
            setScanning(false);
            if (!res.ok) setError(res.error);
            else load();
          }}
        >
          {scanning ? 'Scanning…' : 'Rescan Confluence'}
        </Button>
      </Inline>
      {data.definitionCount === 0 ? (
        <SectionMessage appearance="information" title="No definitions yet">
          <Text>Add the label "metric-definition" to a Confluence page that uses the OneNumber template, then press Rescan.</Text>
        </SectionMessage>
      ) : (
        <DynamicTable head={HEAD} rows={rows} rowsPerPage={20} />
      )}
      <Text>{`Last analysed: ${data.analyzedAt ? new Date(data.analyzedAt).toLocaleString() : 'never'}`}</Text>
      <Settings />
    </Stack>
  );
}

ForgeReconciler.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
