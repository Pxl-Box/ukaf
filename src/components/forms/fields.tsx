'use client';

import {
  useId,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { cn } from '@/lib/utils';
import { Spinner } from '../ui/primitives';

/**
 * Form field primitives.
 *
 * Each control wires its own label, hint and error message together with
 * `aria-describedby` / `aria-invalid` so screen readers announce validation
 * failures without any extra work at the call site.
 */

type FieldErrors = Record<string, string[]> | undefined;

function useFieldIds(name: string, hint?: ReactNode, error?: string) {
  const uid = useId();
  const id = `${name}-${uid}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  return { id, hintId, errorId, describedBy };
}

export function firstError(errors: FieldErrors, name: string): string | undefined {
  return errors?.[name]?.[0];
}

type BaseProps = {
  name: string;
  label: string;
  hint?: ReactNode;
  error?: string;
  required?: boolean;
  className?: string;
};

export function TextField({
  name,
  label,
  hint,
  error,
  required,
  className,
  ...props
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const { id, hintId, errorId, describedBy } = useFieldIds(name, hint, error);

  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn('input', error && 'border-red-400 focus:border-red-500 focus:ring-red-500')}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextAreaField({
  name,
  label,
  hint,
  error,
  required,
  className,
  ...props
}: BaseProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { id, hintId, errorId, describedBy } = useFieldIds(name, hint, error);

  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      <textarea
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn('textarea', error && 'border-red-400 focus:border-red-500 focus:ring-red-500')}
        {...props}
      />
      {hint ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function SelectField({
  name,
  label,
  hint,
  error,
  required,
  className,
  options,
  placeholder,
  children,
  ...props
}: BaseProps &
  SelectHTMLAttributes<HTMLSelectElement> & {
    options?: Array<{ value: string; label: string; disabled?: boolean }>;
    placeholder?: string;
  }) {
  const { id, hintId, errorId, describedBy } = useFieldIds(name, hint, error);

  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
        {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      </label>
      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={cn('select', error && 'border-red-400 focus:border-red-500 focus:ring-red-500')}
        {...props}
      >
        {placeholder ? <option value="">{placeholder}</option> : null}
        {options?.map((option) => (
          <option key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </option>
        ))}
        {children}
      </select>
      {hint ? (
        <p id={hintId} className="hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  error,
  className,
  ...props
}: Omit<BaseProps, 'label'> & { label: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const { id, hintId, errorId, describedBy } = useFieldIds(name, hint, error);

  return (
    <div className={className}>
      <div className="flex items-start gap-2.5">
        <input
          id={id}
          name={name}
          type="checkbox"
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn('checkbox mt-0.5', error && 'border-red-400')}
          {...props}
        />
        <label htmlFor={id} className="text-sm leading-relaxed text-steel-700">
          {label}
        </label>
      </div>
      {hint ? (
        <p id={hintId} className="hint ml-6.5">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="field-error ml-6.5">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Honeypot. Hidden from sight and from assistive technology, but a bot filling
 * every input will populate it — the server rejects any submission where it is
 * non-empty.
 */
export function Honeypot() {
  return (
    <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
      <label htmlFor="website-field">Leave this field empty</label>
      <input id="website-field" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
    </div>
  );
}

export function FormMessage({
  tone,
  children,
}: {
  tone: 'error' | 'success';
  children: ReactNode;
}) {
  if (!children) return null;
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'rounded-lg border p-3 text-sm',
        tone === 'error'
          ? 'border-red-200 bg-red-50 text-red-800'
          : 'border-emerald-200 bg-emerald-50 text-emerald-800',
      )}
    >
      {children}
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel = 'Please wait…',
  className,
  ...props
}: {
  pending: boolean;
  children: ReactNode;
  pendingLabel?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="submit" disabled={pending} className={cn('btn-primary', className)} {...props}>
      {pending ? (
        <>
          <Spinner /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Live password strength meter used on registration and reset. */
export function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;

  let score = 0;
  if (password.length >= 10) score += 1;
  if (password.length >= 14) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;

  const labels = ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const colours = ['bg-red-500', 'bg-red-400', 'bg-amber-400', 'bg-lime-500', 'bg-emerald-500'];

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <span
            key={index}
            className={cn('h-1 flex-1 rounded-full transition-colors', index < score ? colours[score] : 'bg-steel-200')}
          />
        ))}
      </div>
      <p className="mt-1 text-xs text-steel-500" aria-live="polite">
        Password strength: <span className="font-medium">{labels[score]}</span>
      </p>
    </div>
  );
}
