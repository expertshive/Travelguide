import type { ReactNode } from 'react';

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-500">
            Traveler Guide
          </p>
          <h1 className="mt-3 text-4xl font-bold text-brand-700">{title}</h1>
          <p className="mt-2 text-base text-gray-700">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer ? <div className="mt-6 text-sm text-gray-700">{footer}</div> : null}
        </div>
      </div>

      <div className="relative hidden overflow-hidden bg-brand-500 lg:block">
        <div className="absolute -left-24 -top-24 size-[420px] rounded-full bg-brand-400/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-16 size-[380px] rounded-full bg-brand-900/50 blur-3xl" />
        <div className="relative flex h-full flex-col justify-end p-14 text-white">
          <div className="mb-auto pt-6 text-2xl font-bold">Admin Portal</div>
          <h2 className="max-w-sm text-3xl font-bold leading-snug">
            Manage travelers, guides and trips in one place.
          </h2>
          <p className="mt-4 max-w-sm text-white/70">
            Role-based access keeps the platform secure. Traveler accounts are created in the mobile
            app.
          </p>
        </div>
      </div>
    </div>
  );
}
