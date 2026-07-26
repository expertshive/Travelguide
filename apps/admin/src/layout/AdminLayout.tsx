import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../ui';
import {
  DashboardIcon,
  LogoutIcon,
  MenuIcon,
  ProfileIcon,
  ShieldIcon,
  UsersIcon,
} from '../ui/icons';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: DashboardIcon, end: true },
  { to: '/profile', label: 'My Profile', icon: ProfileIcon },
  { to: '/users', label: 'Users', icon: UsersIcon, permission: 'user:read' },
  { to: '/roles', label: 'Roles', icon: ShieldIcon, permission: 'admin:access' },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/profile': 'My Profile',
  '/users': 'Users',
  '/roles': 'Roles',
};

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();
  const [navOpen, setNavOpen] = useState(false);

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.permission || user?.permissions.includes(item.permission),
  );

  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-gray-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-[290px] bg-white transition-transform duration-300',
          'xl:translate-x-0',
          navOpen ? 'translate-x-0 shadow-card' : '-translate-x-full',
        )}
      >
        <div className="px-8 py-9 text-center">
          <span className="text-2xl font-bold text-brand-700">
            TRAVELER <span className="font-normal">GUIDE</span>
          </span>
        </div>
        <div className="mx-auto mb-7 h-px w-4/5 bg-gray-100" />

        <nav className="px-4">
          {visibleItems.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={() => setNavOpen(false)}
              className={({ isActive }) =>
                cn(
                  'relative mb-2 flex items-center gap-4 rounded-lg px-5 py-3 text-sm transition-colors',
                  isActive ? 'font-bold text-brand-500' : 'font-medium text-gray-700 hover:text-brand-700',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('size-5 shrink-0', isActive ? 'text-brand-500' : 'text-gray-600')} />
                  <span>{label}</span>
                  {isActive ? (
                    <span className="absolute right-0 h-9 w-1 rounded-l-md bg-brand-500" />
                  ) : null}
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {navOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-navy-900/20 xl:hidden"
          onClick={() => setNavOpen(false)}
        />
      ) : null}

      <div className="xl:ml-[290px]">
        <header className="sticky top-4 z-20 mx-4 mb-2 flex items-center justify-between gap-4 rounded-card bg-white/70 px-6 py-4 backdrop-blur-xl md:mx-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Open navigation"
              className="text-gray-700 xl:hidden"
              onClick={() => setNavOpen(true)}
            >
              <MenuIcon />
            </button>
            <div>
              <p className="text-xs font-medium text-gray-700">Pages / {PAGE_TITLES[pathname] ?? 'Admin'}</p>
              <h1 className="text-[28px] font-bold leading-tight text-brand-700">
                {PAGE_TITLES[pathname] ?? 'Admin'}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-full bg-white px-3 py-2 shadow-soft">
            <span className="hidden text-sm font-medium text-brand-700 sm:block">{user?.email}</span>
            <div className="grid size-9 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">
              {initial}
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              className="text-gray-600 transition-colors hover:text-red-500"
              onClick={() => void logout()}
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
