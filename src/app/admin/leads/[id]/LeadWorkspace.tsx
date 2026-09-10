'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { cn, formatDateTime, humanise, relativeTime } from '@/lib/utils';
import { AdminCard } from '@/components/admin/shell';
import { Badge } from '@/components/ui/primitives';
import {
  FormMessage,
  SelectField,
  SubmitButton,
  TextAreaField,
  TextField,
} from '@/components/forms/fields';
import { CheckIcon, MailIcon, PhoneIcon, TrashIcon, UsersIcon } from '@/components/ui/Icons';

type ActivityRecord = {
  id: string;
  type: string;
  subject: string | null;
  body: string | null;
  dueAt: string | null;
  completedAt: string | null;
  createdAt: string;
  author: string;
};

const TYPE_ICON: Record<string, React.ReactNode> = {
  CALL: <PhoneIcon />,
  EMAIL: <MailIcon />,
  MEETING: <UsersIcon />,
  TASK: <CheckIcon />,
};

/**
 * Lead timeline plus the composer for logging contact.
 * `LeadControls` (below, in this same file) is the status/assignment panel,
 * colocated because both write to the same lead and share the refresh
 * behaviour — exported separately rather than as a static property, since a
 * property attached to a client component isn't preserved across the
 * server/client boundary when a server component (this page) imports it.
 */
export function LeadWorkspace({
  leadId,
  activities,
}: {
  leadId: string;
  activities: ActivityRecord[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState('NOTE');

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const form = event.currentTarget;
    const data = new FormData(form);

    try {
      await apiFetch('/api/admin/activities', {
        method: 'POST',
        json: {
          leadId,
          type: data.get('type'),
          subject: data.get('subject'),
          body: data.get('body'),
          dueAt: data.get('dueAt'),
        },
      });
      form.reset();
      setType('NOTE');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not save that activity.');
    } finally {
      setPending(false);
    }
  }

  async function toggleTask(id: string, completed: boolean) {
    await apiFetch('/api/admin/activities', { method: 'PATCH', json: { id, completed } }).catch(
      () => setError('Could not update that task.'),
    );
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm('Delete this timeline entry?')) return;
    await apiFetch('/api/admin/activities', { method: 'DELETE', json: { id } }).catch(() =>
      setError('Could not delete that entry.'),
    );
    router.refresh();
  }

  return (
    <>
      <AdminCard title="Log activity">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          {error ? <FormMessage tone="error">{error}</FormMessage> : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              name="type"
              label="Type"
              value={type}
              onChange={(event) => setType(event.target.value)}
              options={[
                { value: 'NOTE', label: 'Note' },
                { value: 'CALL', label: 'Call' },
                { value: 'EMAIL', label: 'Email' },
                { value: 'MEETING', label: 'Meeting' },
                { value: 'VIEWING', label: 'Viewing' },
                { value: 'TASK', label: 'Task (to do)' },
              ]}
            />
            <TextField
              name="dueAt"
              type="date"
              label={type === 'TASK' ? 'Due date' : 'Next action date'}
              hint={type === 'TASK' ? 'Appears on the dashboard when overdue.' : undefined}
            />
          </div>

          <TextField name="subject" label="Subject" placeholder="Left voicemail, sent spec sheet…" />
          <TextAreaField name="body" label="Details" required rows={4} />

          <div className="flex justify-end">
            <SubmitButton pending={pending} pendingLabel="Saving…">
              Add to timeline
            </SubmitButton>
          </div>
        </form>
      </AdminCard>

      <AdminCard title="Timeline" description={`${activities.length} entries`}>
        {activities.length === 0 ? (
          <p className="py-6 text-center text-sm text-steel-400">Nothing logged yet.</p>
        ) : (
          <ol className="space-y-4">
            {activities.map((activity) => {
              const isTask = activity.type === 'TASK';
              const isOverdue =
                isTask && !activity.completedAt && activity.dueAt && new Date(activity.dueAt) < new Date();

              return (
                <li key={activity.id} className="flex gap-3">
                  <span
                    className={cn(
                      'mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm',
                      activity.type === 'STATUS_CHANGE' || activity.type === 'SYSTEM'
                        ? 'bg-steel-100 text-steel-500'
                        : isOverdue
                          ? 'bg-red-50 text-red-600'
                          : 'bg-brand-50 text-brand-600',
                    )}
                  >
                    {TYPE_ICON[activity.type] ?? '•'}
                  </span>

                  <div className="min-w-0 flex-1 border-b border-steel-100 pb-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-steel-900">
                        {activity.subject ?? humanise(activity.type)}
                        {isTask ? (
                          <Badge tone={activity.completedAt ? 'success' : isOverdue ? 'danger' : 'warning'} className="ml-2">
                            {activity.completedAt ? 'Done' : isOverdue ? 'Overdue' : 'To do'}
                          </Badge>
                        ) : null}
                      </p>

                      <div className="flex shrink-0 items-center gap-1">
                        {isTask ? (
                          <button
                            type="button"
                            onClick={() => toggleTask(activity.id, !activity.completedAt)}
                            className="rounded p-1 text-steel-400 hover:bg-emerald-50 hover:text-emerald-600"
                            aria-label={activity.completedAt ? 'Reopen task' : 'Mark task complete'}
                          >
                            <CheckIcon />
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => remove(activity.id)}
                          className="rounded p-1 text-steel-300 hover:bg-red-50 hover:text-red-600"
                          aria-label="Delete entry"
                        >
                          <TrashIcon />
                        </button>
                      </div>
                    </div>

                    {activity.body ? (
                      <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-steel-600">
                        {activity.body}
                      </p>
                    ) : null}

                    <p className="mt-1.5 text-xs text-steel-400">
                      {activity.author} · {formatDateTime(activity.createdAt)}
                      {activity.dueAt && !activity.completedAt
                        ? ` · due ${relativeTime(activity.dueAt)}`
                        : ''}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </AdminCard>
    </>
  );
}

export function LeadControls({
  leadId,
  status,
  assignedToId,
  estimatedValue,
  nextActionAt,
  lostReason,
  staff,
  currencySymbol,
}: {
  leadId: string;
  status: string;
  assignedToId: string;
  estimatedValue: string;
  nextActionAt: string;
  lostReason: string;
  staff: Array<{ value: string; label: string }>;
  currencySymbol: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [currentStatus, setCurrentStatus] = useState(status);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);

    const data = new FormData(event.currentTarget);

    try {
      await apiFetch('/api/admin/leads', {
        method: 'PATCH',
        json: {
          id: leadId,
          status: data.get('status'),
          assignedToId: data.get('assignedToId'),
          estimatedValue: data.get('estimatedValue'),
          nextActionAt: data.get('nextActionAt'),
          lostReason: data.get('lostReason'),
        },
      });
      setMessage({ tone: 'success', text: 'Enquiry updated.' });
      router.refresh();
    } catch (caught) {
      setMessage({
        tone: 'error',
        text: caught instanceof ApiClientError ? caught.message : 'Could not update the enquiry.',
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      {message ? <FormMessage tone={message.tone}>{message.text}</FormMessage> : null}

      <SelectField
        name="status"
        label="Status"
        value={currentStatus}
        onChange={(event) => setCurrentStatus(event.target.value)}
        options={[
          { value: 'NEW', label: 'New' },
          { value: 'CONTACTED', label: 'Contacted' },
          { value: 'QUALIFIED', label: 'Qualified' },
          { value: 'QUOTED', label: 'Quoted' },
          { value: 'NEGOTIATION', label: 'Negotiation' },
          { value: 'WON', label: 'Won' },
          { value: 'LOST', label: 'Lost' },
        ]}
      />

      <SelectField
        name="assignedToId"
        label="Owner"
        defaultValue={assignedToId}
        placeholder="Unassigned"
        options={staff}
      />

      <TextField
        name="estimatedValue"
        label={`Estimated value (${currencySymbol})`}
        inputMode="decimal"
        defaultValue={estimatedValue}
      />

      <TextField name="nextActionAt" type="date" label="Next action" defaultValue={nextActionAt} />

      {currentStatus === 'LOST' ? (
        <TextAreaField
          name="lostReason"
          label="Reason lost"
          rows={3}
          defaultValue={lostReason}
          placeholder="Bought elsewhere, budget, spec mismatch…"
        />
      ) : (
        <input type="hidden" name="lostReason" value={lostReason} />
      )}

      <SubmitButton pending={pending} pendingLabel="Saving…" className="w-full">
        Save
      </SubmitButton>
    </form>
  );
};
