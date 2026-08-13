import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  IntegrationFieldStatus,
  IntegrationSource,
  IntegrationStatus,
  IntegrationTestResult,
  IntegrationsOverview,
} from '@traveler-guide/types';
import { useAuth } from '../auth/AuthContext';
import {
  Alert,
  Badge,
  Button,
  Card,
  Modal,
  PageHeader,
  SmallButton,
  Spinner,
  TextField,
  Toggle,
  cn,
} from '../ui';
import { ExternalLinkIcon } from '../ui/icons';

const SOURCE_LABELS: Record<IntegrationSource, string> = {
  database: 'Saved here',
  environment: 'From environment file',
  missing: 'Not set',
};

const SOURCE_STYLES: Record<IntegrationSource, string> = {
  database: 'text-emerald-700',
  environment: 'text-gray-700',
  missing: 'text-amber-700',
};

export default function IntegrationsPage() {
  const { auth } = useAuth();
  const [overview, setOverview] = useState<IntegrationsOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await auth.listIntegrations());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integrations');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  // Mutations answer with the fresh status, so the card can be swapped in place.
  const replaceIntegration = useCallback((status: IntegrationStatus) => {
    setOverview((prev) =>
      prev
        ? {
            ...prev,
            integrations: prev.integrations.map((item) =>
              item.provider === status.provider ? status : item,
            ),
          }
        : prev,
    );
  }, []);

  return (
    <div className="grid gap-5">
      {overview && !overview.encryptionReady ? (
        <Alert tone="warning">
          <p className="font-bold">Secrets cannot be saved yet.</p>
          <p className="mt-1">
            SETTINGS_ENCRYPTION_KEY is not configured on the auth service, so there is nowhere safe to
            store encrypted values. Set it and restart the service. Until then, integrations that hold a
            secret are read-only here and keep using their environment variables.
          </p>
        </Alert>
      ) : null}

      <Card>
        <PageHeader
          title="Integrations"
          subtitle="API keys and credentials the platform services use to reach third parties."
          action={
            <SmallButton type="button" disabled={loading} onClick={() => void load()}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </SmallButton>
          }
        />

        {error ? <Alert tone="error">{error}</Alert> : null}
        {loading && !overview ? <Spinner label="Loading integrations…" /> : null}
        {overview && overview.integrations.length === 0 ? (
          <p className="text-sm text-gray-600">No integrations are registered for this platform.</p>
        ) : null}
      </Card>

      {overview ? (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          {overview.integrations.map((integration) => (
            <IntegrationCard
              key={integration.provider}
              integration={integration}
              encryptionReady={overview.encryptionReady}
              onChange={replaceIntegration}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StatusPill({ integration }: { integration: IntegrationStatus }) {
  if (integration.keyless) return <Badge tone="neutral">No key needed</Badge>;
  if (!integration.enabled) return <Badge tone="muted">Disabled</Badge>;
  if (integration.ready) return <Badge tone="ok">Configured</Badge>;
  return <Badge tone="warn">Not configured</Badge>;
}

function FieldHint({ field }: { field: IntegrationFieldStatus }) {
  return (
    <>
      {field.preview ? (
        <span className="block font-mono text-gray-600">
          {field.secret ? `Stored: ${field.preview}` : `Current: ${field.preview}`}
        </span>
      ) : null}
      {field.configured ? <span className="block">Leave blank to keep the stored value.</span> : null}
      {field.help ? <span className="block">{field.help}</span> : null}
    </>
  );
}

function ExternalLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-500 transition-colors hover:text-brand-600"
    >
      {children}
      <ExternalLinkIcon className="size-3.5" />
    </a>
  );
}

function IntegrationCard({
  integration,
  encryptionReady,
  onChange,
}: {
  integration: IntegrationStatus;
  encryptionReady: boolean;
  onChange: (status: IntegrationStatus) => void;
}) {
  const { auth } = useAuth();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [testing, setTesting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [testResult, setTestResult] = useState<IntegrationTestResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Untouched and blank inputs mean "leave as it is", so they are never sent.
  const entered = useMemo(
    () => Object.entries(drafts).filter(([, value]) => value.trim() !== ''),
    [drafts],
  );

  const hasSecret = integration.fields.some((field) => field.secret);
  const saveBlocked = hasSecret && !encryptionReady;
  const storedHere = integration.fields.some((field) => field.source === 'database');
  const busy = saving || toggling || clearing;

  function begin() {
    setError(null);
    setNotice(null);
  }

  async function save() {
    begin();
    setSaving(true);
    try {
      onChange(await auth.updateIntegration(integration.provider, Object.fromEntries(entered)));
      setDrafts({});
      setNotice(
        integration.scope === 'clientBuild'
          ? 'Saved. The mobile app has to be rebuilt before it picks this up.'
          : 'Saved.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save credentials');
    } finally {
      setSaving(false);
    }
  }

  async function toggle(next: boolean) {
    begin();
    setToggling(true);
    try {
      onChange(await auth.toggleIntegration(integration.provider, next));
      setNotice(next ? 'Integration enabled.' : 'Integration disabled.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change the integration');
    } finally {
      setToggling(false);
    }
  }

  async function runTest() {
    begin();
    setTestResult(null);
    setTesting(true);
    try {
      setTestResult(await auth.testIntegration(integration.provider));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reach the provider');
    } finally {
      setTesting(false);
    }
  }

  async function clear() {
    begin();
    setClearing(true);
    try {
      onChange(await auth.clearIntegration(integration.provider));
      setDrafts({});
      setConfirmClear(false);
      setTestResult(null);
      setNotice('Stored credentials removed. The service falls back to its environment variable.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear credentials');
    } finally {
      setClearing(false);
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-brand-700">{integration.label}</h3>
            <StatusPill integration={integration} />
          </div>
          <p className="mt-0.5 text-xs font-medium text-gray-700">{integration.vendor}</p>
        </div>

        <span className="flex items-center gap-2 text-xs font-bold text-gray-700">
          {integration.enabled ? 'Enabled' : 'Disabled'}
          <Toggle
            checked={integration.enabled}
            label={`${integration.enabled ? 'Disable' : 'Enable'} ${integration.label}`}
            disabled={toggling}
            onChange={(next) => void toggle(next)}
          />
        </span>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Used by</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {integration.usedBy.length ? (
            integration.usedBy.map((service) => (
              <Badge key={service} tone="muted">
                {service}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-gray-600">No service declares this integration.</span>
          )}
        </div>
      </div>

      <p className="text-sm text-gray-700">{integration.description}</p>

      <div className="flex flex-wrap items-center gap-4">
        <ExternalLink href={integration.docsUrl}>Documentation</ExternalLink>
        {integration.consoleUrl ? (
          <ExternalLink href={integration.consoleUrl}>Get a key</ExternalLink>
        ) : null}
      </div>

      {integration.scope === 'clientBuild' ? (
        <Alert tone="info">
          This key is compiled into the mobile app. Saving it here records the value for the next build —
          the installed app keeps using the key it was built with until it is rebuilt and released.
        </Alert>
      ) : null}

      {integration.fields.length ? (
        <div className="grid gap-4">
          <p className="text-xs font-medium text-gray-700">
            Only fields you type into are sent. Leave an input empty to keep what is already there.
          </p>

          {integration.fields.map((field) => (
            <TextField
              key={field.key}
              label={
                <span className="flex flex-wrap items-baseline gap-2">
                  <span>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  <span className={cn('text-xs font-medium', SOURCE_STYLES[field.source])}>
                    {SOURCE_LABELS[field.source]}
                  </span>
                </span>
              }
              type={field.secret ? 'password' : 'text'}
              autoComplete="off"
              spellCheck={false}
              placeholder={field.placeholder ?? field.key}
              value={drafts[field.key] ?? ''}
              disabled={saveBlocked || busy}
              hint={<FieldHint field={field} />}
              onChange={(event) =>
                setDrafts((prev) => ({ ...prev, [field.key]: event.target.value }))
              }
            />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-600">This integration works without credentials.</p>
      )}

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {saveBlocked ? (
        <p className="text-xs font-bold text-amber-700">
          Saving is disabled until SETTINGS_ENCRYPTION_KEY is configured.
        </p>
      ) : null}

      {testing ? <Spinner label="Testing connection…" /> : null}
      {testResult && !testing ? (
        <Alert tone={testResult.ok ? 'success' : 'warning'}>
          <p className="font-bold">{testResult.ok ? 'Connection works' : 'The provider refused the call'}</p>
          <p className="mt-1">{testResult.message}</p>
          <p className="mt-1 text-xs">
            {testResult.durationMs} ms · checked at {new Date(testResult.checkedAt).toLocaleTimeString()}
          </p>
        </Alert>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3 border-t border-gray-100 pt-4">
        {integration.fields.length ? (
          <Button
            type="button"
            disabled={saveBlocked || busy || entered.length === 0}
            onClick={() => void save()}
          >
            {saving ? 'Saving…' : 'Save'}
          </Button>
        ) : null}

        {integration.testable ? (
          <SmallButton type="button" disabled={testing || busy} onClick={() => void runTest()}>
            {testing ? 'Testing…' : 'Test connection'}
          </SmallButton>
        ) : null}

        {storedHere ? (
          <SmallButton
            type="button"
            variant="danger"
            disabled={busy}
            onClick={() => setConfirmClear(true)}
          >
            Clear stored credentials
          </SmallButton>
        ) : null}

        {integration.updatedAt ? (
          <span className="text-xs font-medium text-gray-600">
            Updated {new Date(integration.updatedAt).toLocaleString()}
            {integration.updatedBy ? ` by ${integration.updatedBy}` : ''}
          </span>
        ) : null}
      </div>

      {confirmClear ? (
        <Modal
          title={`Clear ${integration.label} credentials`}
          subtitle="The values saved in the database are deleted."
          onClose={() => setConfirmClear(false)}
          footer={
            <>
              <Button variant="secondary" type="button" onClick={() => setConfirmClear(false)}>
                Cancel
              </Button>
              <Button variant="danger" type="button" disabled={clearing} onClick={() => void clear()}>
                {clearing ? 'Clearing…' : 'Clear credentials'}
              </Button>
            </>
          }
        >
          <p className="text-sm text-gray-700">
            {integration.label} will fall back to the value in the environment file
            {integration.fields.length === 1 ? ` (${integration.fields[0]?.key})` : ''}. If there is no
            environment value either, the services that depend on it stop working until a new key is saved.
          </p>
        </Modal>
      ) : null}
    </Card>
  );
}
