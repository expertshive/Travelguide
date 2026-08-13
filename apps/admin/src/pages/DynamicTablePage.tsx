import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import type { DbColumnMeta, DbRowsResult } from '@traveler-guide/types';
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
} from '../ui';
import { EditIcon } from '../ui/icons';

const PAGE_SIZE = 25;

function humanize(name: string) {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/^\w/, (c) => c.toUpperCase());
}

function whereFor(primaryKey: string[], row: Record<string, unknown>): Record<string, string> {
  const where: Record<string, string> = {};
  for (const key of primaryKey) where[key] = String(row[key]);
  return where;
}

function formatCell(field: DbColumnMeta, value: unknown) {
  if (value === null || value === undefined) return <span className="text-gray-600">—</span>;
  if (field.sensitive) return <span className="font-mono text-gray-600">{String(value)}</span>;
  if (field.type === 'Boolean') {
    return <Badge tone={value ? 'ok' : 'off'}>{value ? 'Yes' : 'No'}</Badge>;
  }
  if (field.type === 'DateTime') {
    const date = new Date(String(value));
    return <span className="whitespace-nowrap text-gray-700">{Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString()}</span>;
  }
  if (typeof value === 'object') {
    return <span className="font-mono text-xs text-gray-700">{JSON.stringify(value)}</span>;
  }
  const text = String(value);
  return (
    <span className="block max-w-[280px] truncate text-gray-700" title={text}>
      {text}
    </span>
  );
}

export default function DynamicTablePage() {
  const { segment = '', model = '' } = useParams();
  const { auth } = useAuth();
  const [data, setData] = useState<DbRowsResult | null>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [creating, setCreating] = useState(false);

  // Reset paging/search whenever the selected table changes.
  useEffect(() => {
    setPage(1);
    setSearchInput('');
    setSearch('');
    setNotice(null);
    setError(null);
  }, [segment, model]);

  // Debounce the search box.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await auth.getDbRows(segment, model, { page, pageSize: PAGE_SIZE, search }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load table');
    } finally {
      setLoading(false);
    }
  }, [auth, segment, model, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const columns = data?.fields.filter((f) => !f.isList) ?? [];
  const hasEditable = columns.some((f) => f.editable);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  async function onDelete(row: Record<string, unknown>) {
    if (!data) return;
    if (!window.confirm('Delete this row? This cannot be undone.')) return;
    setError(null);
    setNotice(null);
    try {
      await auth.deleteDbRow(segment, model, whereFor(data.primaryKey, row));
      setNotice('Row deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete row');
    }
  }

  async function onSubmit(values: Record<string, unknown>) {
    if (!data) return;
    setError(null);
    setNotice(null);
    if (creating) {
      await auth.createDbRow(segment, model, values);
      setNotice('Row created.');
    } else if (editing) {
      await auth.updateDbRow(segment, model, whereFor(data.primaryKey, editing), values);
      setNotice('Row updated.');
    }
    setEditing(null);
    setCreating(false);
    await load();
  }

  return (
    <Card>
      <PageHeader
        title={data?.label ?? humanize(model)}
        subtitle={
          data
            ? `${humanize(segment)} service · ${data.total} row${data.total === 1 ? '' : 's'} in ${data.model}`
            : `${humanize(segment)} service · Loading…`
        }
        action={
          data?.creatable ? (
            <Button type="button" onClick={() => setCreating(true)}>
              New row
            </Button>
          ) : undefined
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {notice ? <Alert tone="success">{notice}</Alert> : null}

      <div className="mb-4 mt-2 max-w-sm">
        <TextField
          placeholder="Search…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
      </div>

      {loading && !data ? <Spinner label="Loading rows…" /> : null}

      {data ? (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {columns.map((field) => (
                  <th
                    key={field.name}
                    className="whitespace-nowrap px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600"
                  >
                    {humanize(field.name)}
                    {field.isPrimaryKey ? <span className="ml-1 text-brand-400">•</span> : null}
                  </th>
                ))}
                <th className="px-3 py-3 text-right text-xs font-bold uppercase tracking-wide text-gray-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={data.primaryKey.map((k) => row[k]).join(':') || index} className="border-b border-gray-100 last:border-0">
                  {columns.map((field) => (
                    <td key={field.name} className="px-3 py-3 align-top">
                      {formatCell(field, row[field.name])}
                    </td>
                  ))}
                  <td className="px-3 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {hasEditable ? (
                        <SmallButton
                          type="button"
                          className="inline-flex items-center gap-1.5"
                          onClick={() => setEditing(row)}
                        >
                          <EditIcon className="size-4" />
                          Edit
                        </SmallButton>
                      ) : null}
                      <SmallButton type="button" variant="danger" onClick={() => void onDelete(row)}>
                        Delete
                      </SmallButton>
                    </div>
                  </td>
                </tr>
              ))}
              {data.rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + 1} className="px-3 py-10 text-center text-sm text-gray-600">
                    No rows found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {data && data.total > data.pageSize ? (
        <div className="mt-6 flex items-center justify-between text-sm font-medium text-gray-700">
          <SmallButton type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </SmallButton>
          <span>
            Page {page} of {totalPages}
          </span>
          <SmallButton type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
            Next
          </SmallButton>
        </div>
      ) : null}

      {editing || creating ? (
        <RowFormModal
          mode={creating ? 'create' : 'edit'}
          label={data?.label ?? humanize(model)}
          fields={columns}
          row={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSubmit={onSubmit}
        />
      ) : null}
    </Card>
  );
}

function RowFormModal({
  mode,
  label,
  fields,
  row,
  onClose,
  onSubmit,
}: {
  mode: 'create' | 'edit';
  label: string;
  fields: DbColumnMeta[];
  row: Record<string, unknown> | null;
  onClose: () => void;
  onSubmit: (values: Record<string, unknown>) => Promise<void>;
}) {
  const editable = useMemo(() => fields.filter((f) => f.editable), [fields]);
  const identifiers = useMemo(
    () => (mode === 'edit' ? fields.filter((f) => f.isPrimaryKey) : []),
    [fields, mode],
  );

  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const initial: Record<string, unknown> = {};
    for (const field of editable) {
      const current = row?.[field.name];
      initial[field.name] = field.type === 'Boolean' ? Boolean(current) : current ?? '';
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setField(name: string, value: unknown) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      setSaving(false);
    }
  }

  return (
    <Modal
      size="lg"
      title={mode === 'create' ? `New ${label} row` : `Edit ${label} row`}
      subtitle={
        editable.length
          ? 'Only editable columns are shown. Primary keys and generated or sensitive fields are locked.'
          : 'This table has no editable columns.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || editable.length === 0} onClick={() => void save()}>
            {saving ? 'Saving…' : mode === 'create' ? 'Create' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        {error ? <Alert tone="error">{error}</Alert> : null}

        {identifiers.length ? (
          <div className="rounded-xl bg-gray-50 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Identifier</p>
            <div className="mt-1 grid gap-1">
              {identifiers.map((field) => (
                <p key={field.name} className="font-mono text-xs text-gray-700">
                  {field.name}: {String(row?.[field.name])}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        {editable.map((field) => {
          if (field.type === 'Boolean') {
            return (
              <label key={field.name} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="size-4 accent-brand-500"
                  checked={Boolean(values[field.name])}
                  onChange={(e) => setField(field.name, e.target.checked)}
                />
                <span className="text-sm font-bold text-brand-700">{humanize(field.name)}</span>
              </label>
            );
          }

          const isNumber = ['Int', 'BigInt', 'Float', 'Decimal'].includes(field.type);
          return (
            <TextField
              key={field.name}
              label={`${humanize(field.name)}${field.isRequired ? ' *' : ''}`}
              type={isNumber ? 'number' : 'text'}
              value={String(values[field.name] ?? '')}
              hint={field.type === 'DateTime' ? 'ISO date, e.g. 2026-08-02T12:00:00Z' : undefined}
              onChange={(e) => setField(field.name, e.target.value)}
            />
          );
        })}

        {editable.length === 0 ? (
          <p className="text-sm text-gray-600">Nothing to edit on this table.</p>
        ) : null}
      </div>
    </Modal>
  );
}
