import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import type { PermissionEntity, RoleEntity } from '@traveler-guide/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Button, Card, PageHeader, SmallButton, Spinner, TextField } from '../ui';

export default function RolesPage() {
  const { auth } = useAuth();
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [permissions, setPermissions] = useState<PermissionEntity[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    if (role.name === 'super_admin') return;
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
            <table className="w-full min-w-[720px] border-collapse text-sm">
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
                      {role.name !== 'super_admin' ? (
                        <SmallButton type="button" variant="danger" onClick={() => void deleteRole(role)}>
                          Delete
                        </SmallButton>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
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
        <div className="mt-3 flex flex-wrap gap-2">
          {permissions.map((permission) => (
            <Badge key={permission.id}>{permission.name}</Badge>
          ))}
        </div>
      </Card>
    </div>
  );
}
