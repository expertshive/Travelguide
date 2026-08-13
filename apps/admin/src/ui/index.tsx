import { useEffect } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';
import { CloseIcon } from './icons';

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
}: InputHTMLAttributes<HTMLInputElement> & { label?: ReactNode; hint?: ReactNode }) {
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

type AlertTone = 'error' | 'success' | 'warning' | 'info';

const ALERT_TONES: Record<AlertTone, string> = {
  error: 'bg-red-50 text-red-600',
  success: 'bg-emerald-50 text-emerald-700',
  warning: 'bg-amber-50 text-amber-700',
  info: 'bg-gray-50 text-gray-700',
};

export function Alert({ tone, children }: { tone: AlertTone; children: ReactNode }) {
  return (
    <div className={cn('rounded-xl px-4 py-3 text-sm font-medium', ALERT_TONES[tone])}>{children}</div>
  );
}

type BadgeTone = 'ok' | 'off' | 'warn' | 'muted' | 'neutral';

const BADGE_TONES: Record<BadgeTone, string> = {
  ok: 'bg-emerald-50 text-emerald-700',
  off: 'bg-red-50 text-red-600',
  warn: 'bg-amber-50 text-amber-700',
  muted: 'bg-gray-100 text-gray-700',
  neutral: 'bg-brand-100 text-brand-600',
};

export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return (
    <span className={cn('inline-block rounded-full px-3 py-1 text-xs font-bold', BADGE_TONES[tone])}>
      {children}
    </span>
  );
}

export function Toggle({
  checked,
  label,
  disabled,
  onChange,
}: {
  checked: boolean;
  label: string;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors',
        'disabled:cursor-not-allowed disabled:opacity-60',
        checked ? 'bg-brand-500' : 'bg-gray-200',
      )}
    >
      <span
        className={cn(
          'size-5 rounded-full bg-white shadow-soft transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'md' | 'lg';
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-navy-900/40 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col overflow-hidden rounded-card bg-white shadow-card',
          size === 'lg' ? 'max-w-2xl' : 'max-w-lg',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-bold text-brand-700">{title}</h3>
            {subtitle ? <p className="mt-1 text-sm text-gray-700">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-lg p-1 text-gray-600 transition-colors hover:bg-gray-100 hover:text-brand-700"
            onClick={onClose}
          >
            <CloseIcon className="size-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
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
