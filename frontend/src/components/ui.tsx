import { clsx } from 'clsx';
import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={clsx('rounded-lg border border-line bg-surface p-4 shadow-card', className)}>{children}</section>;
}

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={clsx(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-line bg-panel px-3 text-sm font-medium text-ink transition hover:bg-line disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
    />
  );
}

export function PrimaryButton(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Button {...props} className={clsx('border-primary bg-primary text-white hover:bg-sky-700', props.className)} />;
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={clsx('min-h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary', props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={clsx('min-h-11 rounded-md border border-line bg-surface px-3 text-sm text-ink outline-none focus:border-primary', props.className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={clsx('min-h-24 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none focus:border-primary', props.className)} />;
}

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warning' | 'danger' }) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-600',
    success: 'bg-green-50 text-green-800',
    warning: 'bg-amber-50 text-warning',
    danger: 'bg-red-50 text-danger'
  };
  return <span className={clsx('inline-flex rounded-full px-2 py-1 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-panel p-8 text-center">
      <p className="text-sm text-muted">{title}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
