import type { FormEvent } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PermissionEntity, RoleEntity } from '@traveler-guide/types';
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
  cn,
} from '../ui';
import { EditIcon, KeyIcon } from '../ui/icons';

const PROTECTED_ROLE = 'super_admin';

export default function RolesPage() {
  const { auth } = useAuth();
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntity[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoleEntity | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rolesResult, permissionsResult] = await Promise.all([
        auth.listRoles(),
        auth.listPermissions(),
      ]);
      setRoles(rolesResult);
      setPermissions(permissionsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, [auth]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createRole(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    try {
      await auth.createRole({ name: name.trim(), description: description.trim() || undefined });
      setName('');
      setDescription('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create role');
    }
  }

  async function deleteRole(role: RoleEntity) {
    if (role.name === PROTECTED_ROLE) return;
    if (!window.confirm(`Delete the "${role.name}" role? This cannot be undone.`)) return;
    try {
      await auth.deleteRole(role.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete role');
    }
  }

  return (
    <div className="grid gap-5">
      <Card>
        <PageHeader title="Roles & Permissions" subtitle="Manage RBAC roles for the platform." />

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form
          className="mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end"
          onSubmit={(e) => void createRole(e)}
        >
          <TextField
            label="Role name"
            placeholder="content_manager"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            label="Description"
            placeholder="What can this role do?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <Button type="submit">Create role</Button>
        </form>

        {loading ? <Spinner label="Loading roles…" /> : null}

        {!loading ? (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Name', 'Description', 'Permissions', 'Users', 'Actions'].map((heading) => (
                    <th
                      key={heading}
                      className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wide text-gray-600"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {roles.map((role) => (
                  <tr key={role.id} className="border-b border-gray-100 last:border-0">
                    <td className="px-3 py-4 font-bold text-brand-700">{role.name}</td>
                    <td className="px-3 py-4 text-gray-700">{role.description ?? '—'}</td>
                    <td className="px-3 py-4">
                      <div className="flex max-w-md flex-wrap gap-1.5">
                        {role.permissions.length ? (
                          role.permissions.map((permission) => (
                            <Badge key={permission}>{permission}</Badge>
                          ))
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-4 text-gray-700">{role.userCount}</td>
                    <td className="px-3 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <SmallButton
                          type="button"
                          className="inline-flex items-center gap-1.5"
                          onClick={() => setEditing(role)}
                        >
                          <EditIcon className="size-4" />
                          Edit
                        </SmallButton>
                        {role.name !== PROTECTED_ROLE ? (
                          <SmallButton type="button" variant="danger" onClick={() => void deleteRole(role)}>
                            Delete
                          </SmallButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Card>

      <Card>
        <h3 className="text-base font-bold text-brand-700">All permissions</h3>
        <p className="mt-1 text-sm text-gray-700">{permissions.length} permissions available to assign.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((permission) => (
            <Badge key={permission.id}>{permission.name}</Badge>
          ))}
        </div>
      </Card>

      {editing ? (
        <EditRoleModal
          role={editing}
          permissions={permissions}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
          onError={setError}
        />
      ) : null}
    </div>
  );
}

function EditRoleModal({
  role,
  permissions,
  onClose,
  onSaved,
  onError,
}: {
  role: RoleEntity;
  permissions: PermissionEntity[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const { auth } = useAuth();
  const [description, setDescription] = useState(role.description ?? '');
  const [selected, setSelected] = useState<Set<string>>(new Set(role.permissions));
  const [saving, setSaving] = useState(false);

  const isProtected = role.name === PROTECTED_ROLE;

  const changed = useMemo(() => {
    const current = new Set(role.permissions);
    const permsChanged =
      current.size !== selected.size || [...selected].some((p) => !current.has(p));
    return permsChanged || description.trim() !== (role.description ?? '').trim();
  }, [description, role.description, role.permissions, selected]);

  function toggle(permission: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(permission)) next.delete(permission);
      else next.add(permission);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      if (description.trim() !== (role.description ?? '').trim()) {
        await auth.updateRole(role.id, { description: description.trim() });
      }
      await auth.setRolePermissions(role.id, { permissions: [...selected] });
      await onSaved();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update role');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      size="lg"
      title={`Edit role · ${role.name}`}
      subtitle={
        isProtected
          ? 'This is a protected role. Permissions are locked to keep admin access safe.'
          : 'Update the description and choose which permissions this role grants.'
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" disabled={saving || isProtected || !changed} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save changes'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5">
        <TextField
          label="Description"
          value={description}
          placeholder="What can this role do?"
          disabled={isProtected}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-brand-700">
              <KeyIcon className="size-4 text-gray-600" />
              Permissions
            </span>
            <span className="text-xs font-medium text-gray-700">
              {selected.size} of {permissions.length} selected
            </span>
          </div>

          {permissions.length ? (
            <div className="grid max-h-[45vh] gap-2 overflow-y-auto rounded-xl border border-gray-100 p-3 sm:grid-cols-2">
              {permissions.map((permission) => {
                const active = selected.has(permission.name);
                return (
                  <label
                    key={permission.id}
                    className={cn(
                      'flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors',
                      active ? 'border-brand-200 bg-brand-50' : 'border-gray-100 hover:bg-gray-50',
                      isProtected && 'cursor-not-allowed opacity-70',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 accent-brand-500"
                      checked={active}
                      disabled={isProtected}
                      onChange={() => toggle(permission.name)}
                    />
                    <span>
                      <span className="block text-sm font-bold text-brand-700">{permission.name}</span>
                      {permission.description ? (
                        <span className="block text-xs text-gray-700">{permission.description}</span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-gray-600">No permissions are defined yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
