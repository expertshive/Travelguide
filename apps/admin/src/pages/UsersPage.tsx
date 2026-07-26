import { useCallback, useEffect, useState } from 'react';
import type { RoleEntity, UserSummary } from '@traveler-guide/types';
import { useAuth } from '../auth/AuthContext';
import { Alert, Badge, Card, PageHeader, SmallButton, Spinner } from '../ui';

export default function UsersPage() {
  const { auth } = useAuth();
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [roles, setRoles] = useState<RoleEntity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResult, rolesResult] = await Promise.all([
        auth.listUsers(page, pageSize),
        auth.listRoles().catch(() => [] as RoleEntity[]),
      ]);
      setUsers(usersResult.items);
      setTotal(usersResult.total);
      setRoles(rolesResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [auth, page]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleActive(user: UserSummary) {
    try {
      await auth.updateUser(user.id, { isActive: !user.isActive });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
    }
  }

  async function assignRole(userId: string, roleName: string) {
    if (!roleName) return;
    try {
      await auth.assignUserRole(userId, { roleName });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign role');
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <Card>
      <PageHeader title="Users" subtitle={`${total} registered accounts`} />

      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading ? <Spinner label="Loading users…" /> : null}

      {!loading ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                {['Name', 'Email', 'Mobile', 'Roles', 'Status', 'Created', 'Actions'].map((heading) => (
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
              {users.map((user) => (
                <tr key={user.id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-4 font-bold text-brand-700">{user.name}</td>
                  <td className="px-3 py-4 text-gray-700">{user.email}</td>
                  <td className="px-3 py-4 text-gray-700">{user.mobile}</td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap gap-1.5">
                      {user.roles.length ? (
                        user.roles.map((role) => <Badge key={role}>{role}</Badge>)
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <Badge tone={user.isActive ? 'ok' : 'off'}>
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-3 py-4 text-gray-700">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <SmallButton
                        type="button"
                        variant={user.isActive ? 'danger' : 'secondary'}
                        onClick={() => void toggleActive(user)}
                      >
                        {user.isActive ? 'Deactivate' : 'Activate'}
                      </SmallButton>
                      <select
                        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-bold text-brand-700 outline-none"
                        defaultValue=""
                        onChange={(e) => void assignRole(user.id, e.target.value)}
                      >
                        <option value="" disabled>
                          Assign role
                        </option>
                        {roles.map((role) => (
                          <option key={role.id} value={role.name}>
                            {role.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-6 flex items-center justify-between text-sm font-medium text-gray-700">
        <SmallButton type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          Previous
        </SmallButton>
        <span>
          Page {page} of {totalPages}
        </span>
        <SmallButton
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </SmallButton>
      </div>
    </Card>
  );
}
