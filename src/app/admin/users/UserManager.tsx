'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { Role } from '@prisma/client';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { AdminCard } from '@/components/admin/shell';
import {
  CheckboxField,
  FormMessage,
  SelectField,
  SubmitButton,
  TextField,
  firstError,
} from '@/components/forms/fields';
import { PlusIcon } from '@/components/ui/Icons';

const ROLE_RANK: Record<Role, number> = {
  CUSTOMER: 0,
  SALES: 10,
  MANAGER: 20,
  ADMIN: 30,
  SUPERADMIN: 40,
};

/** Only offer roles at or below the signed-in administrator's own level. */
function roleOptions(currentRole: Role) {
  return (
    [
      { value: 'SALES', label: 'Sales executive' },
      { value: 'MANAGER', label: 'Sales manager' },
      { value: 'ADMIN', label: 'Administrator' },
      { value: 'SUPERADMIN', label: 'Owner' },
    ] as Array<{ value: Role; label: string }>
  ).filter((option) => ROLE_RANK[option.value] <= ROLE_RANK[currentRole]);
}

export function UserManager({ currentRole }: { currentRole: Role }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const form = event.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());

    try {
      const result = await apiFetch<{ invited: boolean }>('/api/admin/users', {
        method: 'POST',
        json: data,
      });
      form.reset();
      setOpen(false);
      setMessage({
        tone: 'success',
        text: result.invited
          ? 'Account created and an invitation email has been sent.'
          : 'Account created.',
      });
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setMessage({ tone: 'error', text: caught.message });
        setFieldErrors(caught.fieldErrors ?? {});
      } else {
        setMessage({ tone: 'error', text: 'Could not create the account.' });
      }
    } finally {
      setPending(false);
    }
  }

  if (!open) {
    return (
      <div className="space-y-3">
        {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}
        <button type="button" onClick={() => setOpen(true)} className="btn-primary btn-sm">
          <PlusIcon /> Add staff account
        </button>
      </div>
    );
  }

  return (
    <AdminCard title="New staff account" description="They receive an email invitation to set their own password.">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="firstName"
            label="First name"
            required
            error={firstError(fieldErrors, 'firstName')}
          />
          <TextField
            name="lastName"
            label="Last name"
            required
            error={firstError(fieldErrors, 'lastName')}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            name="email"
            type="email"
            label="Work email"
            required
            error={firstError(fieldErrors, 'email')}
          />
          <SelectField
            name="role"
            label="Role"
            required
            defaultValue="SALES"
            options={roleOptions(currentRole)}
            error={firstError(fieldErrors, 'role')}
          />
        </div>

        <TextField name="phone" type="tel" label="Phone (optional)" error={firstError(fieldErrors, 'phone')} />

        <CheckboxField
          name="sendInvite"
          value="true"
          defaultChecked
          label="Send an invitation email so they can set their own password"
        />

        <input type="hidden" name="status" value="ACTIVE" />

        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="btn-secondary">
            Cancel
          </button>
          <SubmitButton pending={pending} pendingLabel="Creating…">
            Create account
          </SubmitButton>
        </div>
      </form>
    </AdminCard>
  );
}

UserManager.RowActions = function RowActions({
  user,
  currentUserId,
  currentRole,
}: {
  user: { id: string; email: string; firstName: string; lastName: string; role: Role; status: string };
  currentUserId: string;
  currentRole: Role;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === currentUserId;
  const canManage = ROLE_RANK[currentRole] >= ROLE_RANK[user.role];

  async function update(patch: Record<string, unknown>) {
    setPending(true);
    setError(null);
    try {
      await apiFetch('/api/admin/users', { method: 'PATCH', json: { id: user.id, ...patch } });
      setEditing(false);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not update the account.');
    } finally {
      setPending(false);
    }
  }

  if (!canManage) {
    return <span className="text-xs text-steel-300">—</span>;
  }

  if (editing) {
    return (
      <div className="flex flex-col items-end gap-1.5">
        <select
          defaultValue={user.role}
          disabled={isSelf || pending}
          onChange={(event) => update({ role: event.target.value })}
          aria-label={`Role for ${user.firstName} ${user.lastName}`}
          className="select w-auto py-1 text-xs"
        >
          {roleOptions(currentRole).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="flex gap-1">
          {user.status === 'SUSPENDED' ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => update({ status: 'ACTIVE' })}
              className="btn-ghost btn-sm text-emerald-700"
            >
              Reinstate
            </button>
          ) : (
            <button
              type="button"
              disabled={pending || isSelf}
              onClick={() => {
                if (window.confirm(`Suspend ${user.email}? They will be signed out immediately.`)) {
                  update({ status: 'SUSPENDED' });
                }
              }}
              className="btn-ghost btn-sm text-red-600 disabled:opacity-40"
            >
              Suspend
            </button>
          )}
          <button type="button" onClick={() => setEditing(false)} className="btn-ghost btn-sm">
            Done
          </button>
        </div>

        {error ? <p className="text-right text-xs text-red-600">{error}</p> : null}
      </div>
    );
  }

  return (
    <button type="button" onClick={() => setEditing(true)} className="btn-ghost btn-sm">
      Manage
    </button>
  );
};
