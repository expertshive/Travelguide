import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cn('rounded-card bg-white p-6 shadow-card', className)}
    >
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-brand-700">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-gray-700">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'danger';
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-brand-500 text-white shadow-brand hover:bg-brand-600',
  secondary: 'bg-gray-100 text-brand-700 hover:bg-gray-200',
  danger: 'bg-red-50 text-red-600 hover:bg-red-100',
};

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

export function SmallButton({ variant = 'secondary', className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-3 py-2',
        'text-xs font-bold text-brand-700 transition-colors hover:bg-gray-50',
        'disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'danger' && 'border-red-100 text-red-600 hover:bg-red-50',
        className,
      )}
    />
  );
}

const FIELD_STYLES =
  'w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-brand-700 ' +
  'placeholder:text-gray-600 outline-none transition-colors focus:border-brand-500';

export function TextField({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-sm font-bold text-brand-700">{label}</span>
      ) : null}
      <input {...props} className={cn(FIELD_STYLES, className)} />
      {hint ? <span className="mt-1 block text-xs text-gray-700">{hint}</span> : null}
    </label>
  );
}

export function TextArea({
  label,
  hint,
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: ReactNode }) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-sm font-bold text-brand-700">{label}</span>
      ) : null}
      <textarea {...props} className={cn(FIELD_STYLES, 'resize-y', className)} />
      {hint ? <span className="mt-1 block text-right text-xs text-gray-700">{hint}</span> : null}
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: InputHTMLAttributes<HTMLSelectElement> & { label?: string; children: ReactNode }) {
  return (
    <label className="block">
      {label ? (
        <span className="mb-2 block text-sm font-bold text-brand-700">{label}</span>
      ) : null}
      <select {...props} className={cn(FIELD_STYLES, className)}>
        {children}
      </select>
    </label>
  );
}

export function Alert({ tone, children }: { tone: 'error' | 'success'; children: ReactNode }) {
  return (
    <p
      className={cn(
        'rounded-xl px-4 py-3 text-sm font-medium',
        tone === 'error' ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700',
      )}
    >
      {children}
    </p>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'ok' | 'off' | 'neutral'; children: ReactNode }) {
  const tones = {
    ok: 'bg-emerald-50 text-emerald-700',
    off: 'bg-red-50 text-red-600',
    neutral: 'bg-brand-100 text-brand-600',
  };
  return (
    <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-bold', tones[tone])}>
      {children}
    </span>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-sm font-medium text-gray-700">
      <span className="size-4 animate-spin rounded-full border-2 border-gray-200 border-t-brand-500" />
      {label}
    </div>
  );
}
