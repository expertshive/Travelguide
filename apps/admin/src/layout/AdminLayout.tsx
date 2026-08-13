import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import type { DbTableMeta, ServiceCatalogEntry } from '@traveler-guide/types';
import { useAuth } from '../auth/AuthContext';
import { cn } from '../ui';
import {
  ChevronDownIcon,
  DashboardIcon,
  LayersIcon,
  LogoutIcon,
  MenuIcon,
  PlugIcon,
  ProfileIcon,
  TableIcon,
} from '../ui/icons';

/** Tables that have a richer, purpose-built screen instead of the generic grid. */
const DEDICATED_ROUTES: Record<string, string> = {
  'auth:user': '/users',
  'auth:role': '/roles',
};

const STATIC_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/profile': 'My Profile',
  '/users': 'Users',
  '/roles': 'Roles',
  '/integrations': 'Integrations',
};

/** Which service groups are open, kept for the tab's lifetime. */
const OPEN_GROUPS_KEY = 'tg_admin_open_services';

function tableRoute(segment: string, table: DbTableMeta) {
  return DEDICATED_ROUTES[`${segment}:${table.accessor}`] ?? `/db/${segment}/${table.accessor}`;
}

/** The service whose data the current route belongs to, if any. */
function routeSegment(pathname: string): string | null {
  if (pathname === '/users' || pathname === '/roles') return 'auth';
  return /^\/db\/([^/]+)\//.exec(pathname)?.[1] ?? null;
}

function readOpenGroups(): string[] {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(OPEN_GROUPS_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeOpenGroups(segments: string[]) {
  try {
    sessionStorage.setItem(OPEN_GROUPS_KEY, JSON.stringify(segments));
  } catch {
    // A sidebar preference is not worth failing a render over.
  }
}

export default function AdminLayout() {
  const { user, auth, logout } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [services, setServices] = useState<ServiceCatalogEntry[]>([]);
  const [servicesError, setServicesError] = useState<string | null>(null);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [openGroups, setOpenGroups] = useState<string[]>(readOpenGroups);
  const menuRef = useRef<HTMLDivElement>(null);

  const canReadAuth = user?.permissions.includes('admin:access') ?? false;
  const activeSegment = routeSegment(pathname);

  // One catalog call covers every service and its tables.
  useEffect(() => {
    if (!canReadAuth) return;
    let active = true;
    setServicesLoading(true);
    auth
      .listServices()
      .then((result) => {
        if (!active) return;
        setServices(result);
        setServicesError(null);
      })
      .catch((err: unknown) => {
        if (!active) return;
        setServices([]);
        setServicesError(err instanceof Error ? err.message : 'Failed to load services');
      })
      .finally(() => {
        if (active) setServicesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [auth, canReadAuth]);

  useEffect(() => {
    writeOpenGroups(openGroups);
  }, [openGroups]);

  // Reveal the group holding the current route without forcing it back open afterwards.
  useEffect(() => {
    if (!activeSegment) return;
    setOpenGroups((open) => (open.includes(activeSegment) ? open : [...open, activeSegment]));
  }, [activeSegment]);

  const toggleGroup = useCallback((segment: string) => {
    setOpenGroups((open) =>
      open.includes(segment) ? open.filter((item) => item !== segment) : [...open, segment],
    );
  }, []);

  // Close the account menu on outside click and whenever the route changes.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
    setNavOpen(false);
  }, [pathname]);

  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();
  const activeService = useMemo(
    () => services.find((service) => service.segment === activeSegment) ?? null,
    [activeSegment, services],
  );
  const activeTable = activeService?.tables.find(
    (table) => tableRoute(activeService.segment, table) === pathname,
  );
  const staticTitle = STATIC_TITLES[pathname];
  const pageTitle = staticTitle ?? activeTable?.label ?? 'Admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[290px] flex-col bg-white transition-transform duration-300',
          'xl:translate-x-0',
          navOpen ? 'translate-x-0 shadow-card' : '-translate-x-full',
        )}
      >
        <div className="px-8 py-7 text-center">
          <span className="text-2xl font-bold text-brand-700">
            TRAVELER <span className="font-normal">GUIDE</span>
          </span>
        </div>
        <div className="mx-auto mb-5 h-px w-4/5 bg-gray-100" />

        <nav className="flex-1 overflow-y-auto px-4 pb-6">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              cn(
                'relative mb-2 flex items-center gap-4 rounded-lg px-5 py-3 text-sm transition-colors',
                isActive ? 'font-bold text-brand-500' : 'font-medium text-gray-700 hover:text-brand-700',
              )
            }
          >
            {({ isActive }) => (
              <>
                <DashboardIcon className={cn('size-5 shrink-0', isActive ? 'text-brand-500' : 'text-gray-600')} />
                <span>Dashboard</span>
                {isActive ? <span className="absolute right-0 h-9 w-1 rounded-l-md bg-brand-500" /> : null}
              </>
            )}
          </NavLink>

          {canReadAuth ? (
            <>
              <NavLink
                to="/integrations"
                end
                className={({ isActive }) =>
                  cn(
                    'relative mb-2 flex items-center gap-4 rounded-lg px-5 py-3 text-sm transition-colors',
                    isActive ? 'font-bold text-brand-500' : 'font-medium text-gray-700 hover:text-brand-700',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <PlugIcon className={cn('size-5 shrink-0', isActive ? 'text-brand-500' : 'text-gray-600')} />
                    <span>Integrations</span>
                    {isActive ? <span className="absolute right-0 h-9 w-1 rounded-l-md bg-brand-500" /> : null}
                  </>
                )}
              </NavLink>

              <p className="mb-1 mt-5 px-5 text-[11px] font-bold uppercase tracking-wide text-gray-600">
                Services
              </p>

              {servicesLoading ? (
                <p className="px-5 py-2 text-xs font-medium text-gray-600">Loading services…</p>
              ) : null}

              {servicesError ? (
                <p className="px-5 py-2 text-xs font-medium text-red-600" title={servicesError}>
                  Service catalog unavailable.
                </p>
              ) : null}

              {!servicesLoading && !servicesError && services.length === 0 ? (
                <p className="px-5 py-2 text-xs font-medium text-gray-600">No services registered.</p>
              ) : null}

              {services.map((service) => (
                <ServiceGroup
                  key={service.segment}
                  service={service}
                  isActive={service.segment === activeSegment}
                  isOpen={openGroups.includes(service.segment)}
                  onToggle={toggleGroup}
                />
              ))}
            </>
          ) : null}
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
              <p className="text-xs font-medium text-gray-700">
                Pages / {!staticTitle && activeService ? `${activeService.label} / ` : ''}
                {pageTitle}
              </p>
              <h1 className="text-[28px] font-bold leading-tight text-brand-700">{pageTitle}</h1>
            </div>
          </div>

          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center gap-2 rounded-full bg-white py-1.5 pl-3 pr-2 shadow-soft transition-colors hover:bg-gray-50"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className="hidden text-sm font-medium text-brand-700 sm:block">{user?.name ?? user?.email}</span>
              <div className="grid size-9 place-items-center rounded-full bg-brand-500 text-sm font-bold text-white">
                {initial}
              </div>
              <ChevronDownIcon
                className={cn('size-4 text-gray-600 transition-transform', menuOpen && 'rotate-180')}
              />
            </button>

            {menuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-2 w-64 overflow-hidden rounded-2xl bg-white p-2 shadow-card"
              >
                <div className="border-b border-gray-100 px-3 py-3">
                  <p className="truncate text-sm font-bold text-brand-700">{user?.name}</p>
                  <p className="truncate text-xs text-gray-700">{user?.email}</p>
                </div>

                <button
                  type="button"
                  role="menuitem"
                  className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-brand-700"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('/profile');
                  }}
                >
                  <ProfileIcon className="size-5 text-gray-600" />
                  My Profile
                </button>

                <button
                  type="button"
                  role="menuitem"
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
                  onClick={() => {
                    setMenuOpen(false);
                    void logout();
                  }}
                >
                  <LogoutIcon className="size-5" />
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function ServiceGroup({
  service,
  isActive,
  isOpen,
  onToggle,
}: {
  service: ServiceCatalogEntry;
  isActive: boolean;
  isOpen: boolean;
  onToggle: (segment: string) => void;
}) {
  const unreachable = !service.online || service.tables.length === 0;

  // Offline or table-less services stay visible but have nothing to open.
  if (unreachable) {
    return (
      <div
        aria-disabled="true"
        title={service.online ? 'This service exposes no tables.' : service.error ?? 'Service unavailable'}
        className="mb-1 flex cursor-not-allowed items-center gap-4 rounded-lg px-5 py-2.5 text-sm opacity-60"
      >
        <LayersIcon className="size-5 shrink-0 text-gray-600" />
        <span className="flex-1 truncate font-medium text-gray-700">{service.label}</span>
        <span
          className={cn(
            'text-[11px] font-bold uppercase tracking-wide',
            service.online ? 'text-gray-600' : 'text-red-600',
          )}
        >
          {service.online ? 'No tables' : 'Offline'}
        </span>
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => onToggle(service.segment)}
        className={cn(
          'flex w-full items-center gap-4 rounded-lg px-5 py-2.5 text-sm transition-colors',
          isActive ? 'font-bold text-brand-500' : 'font-medium text-gray-700 hover:text-brand-700',
        )}
      >
        <LayersIcon className={cn('size-5 shrink-0', isActive ? 'text-brand-500' : 'text-gray-600')} />
        <span className="flex-1 truncate text-left">{service.label}</span>
        <span className="text-[11px] font-bold text-gray-600">{service.tables.length}</span>
        <ChevronDownIcon className={cn('size-4 text-gray-600 transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen ? (
        <div className="mt-1 ml-5 border-l border-gray-100 pl-3">
          {service.tables.map((table) => (
            <NavLink
              key={table.accessor}
              to={tableRoute(service.segment, table)}
              end
              className={({ isActive: linkActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                  linkActive
                    ? 'bg-brand-50 font-bold text-brand-500'
                    : 'font-medium text-gray-700 hover:bg-gray-50 hover:text-brand-700',
                )
              }
            >
              {({ isActive: linkActive }) => (
                <>
                  <TableIcon className={cn('size-4 shrink-0', linkActive ? 'text-brand-500' : 'text-gray-600')} />
                  <span className="flex-1 truncate">{table.label}</span>
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[11px] font-bold',
                      linkActive ? 'bg-brand-100 text-brand-600' : 'bg-gray-100 text-gray-700',
                    )}
                  >
                    {table.count}
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}
