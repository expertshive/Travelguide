import type { ReactNode } from 'react';
import { useAuth } from '../auth/AuthContext';
import { Badge, Card } from '../ui';
import { DashboardIcon, ProfileIcon, ShieldIcon, UsersIcon } from '../ui/icons';

function StatCard({ icon, label, value }: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <Card className="flex items-center gap-4 !p-5">
      <div className="grid size-14 shrink-0 place-items-center rounded-full bg-gray-50 text-brand-500">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="truncate text-xl font-bold text-brand-700">{value}</p>
      </div>
    </Card>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-b border-gray-100 py-4 last:border-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-gray-700">{label}</dt>
      <dd className="mt-1 text-sm font-bold text-brand-700">{children}</dd>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<ProfileIcon />} label="Signed in as" value={user.name} />
        <StatCard
          icon={<ShieldIcon />}
          label="Roles"
          value={user.roles.length ? user.roles.join(', ') : 'None'}
        />
        <StatCard icon={<DashboardIcon />} label="Permissions" value={user.permissions.length} />
        <StatCard
          icon={<UsersIcon />}
          label="Status"
          value={<Badge tone={user.isActive ? 'ok' : 'off'}>{user.isActive ? 'Active' : 'Inactive'}</Badge>}
        />
      </div>

      <Card>
        <h2 className="text-xl font-bold text-brand-700">Welcome back, {user.name}</h2>
        <p className="mt-1 text-sm text-gray-700">
          You are authenticated through the API gateway with admin access.
        </p>

        <dl className="mt-4 grid gap-x-8 md:grid-cols-2">
          <DetailRow label="Name">{user.name}</DetailRow>
          <DetailRow label="Email">{user.email}</DetailRow>
          <DetailRow label="Mobile">{user.mobile}</DetailRow>
          <DetailRow label="User ID">
            <span className="font-mono text-xs">{user.id}</span>
          </DetailRow>
          <DetailRow label="Roles">
            <div className="flex flex-wrap gap-2">
              {user.roles.length ? (
                user.roles.map((role) => <Badge key={role}>{role}</Badge>)
              ) : (
                <span>None</span>
              )}
            </div>
          </DetailRow>
          <DetailRow label="Permissions">
            <div className="flex flex-wrap gap-2">
              {user.permissions.length ? (
                user.permissions.map((permission) => <Badge key={permission}>{permission}</Badge>)
              ) : (
                <span>None</span>
              )}
            </div>
          </DetailRow>
        </dl>
      </Card>
    </div>
  );
}
