'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { LeadStatusValue } from '@/lib/leads';
import { apiFetch, ApiClientError } from '@/lib/client-api';
import { formatMoney, type CurrencyInfo } from '@/lib/money';
import { relativeTime } from '@/lib/utils';

export type PipelineLead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  score: number;
  estimatedValue: number | null;
  truck: { title: string; priceNet: number } | null;
  assignedTo: { firstName: string; lastName: string } | null;
  nextActionAtISO: string | null;
};

export type PipelineColumn = {
  stage: LeadStatusValue;
  label: string;
  items: PipelineLead[];
};

/**
 * Drag-and-drop pipeline board. Desktop only by design — HTML5 drag events
 * (dragstart/dragover/drop) don't fire from touch input on phones/tablets, so
 * this degrades to the plain click-through cards there with no extra code.
 */
export function PipelineBoard({ columns: initial, base }: { columns: PipelineColumn[]; base: CurrencyInfo }) {
  const [columns, setColumns] = useState(initial);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<LeadStatusValue | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function columnValue(items: PipelineLead[]) {
    return items.reduce((sum, lead) => sum + (lead.estimatedValue ?? lead.truck?.priceNet ?? 0), 0);
  }

  async function moveLead(leadId: string, fromStage: LeadStatusValue, toStage: LeadStatusValue) {
    if (fromStage === toStage) return;

    const previous = columns;
    const moved = previous.find((column) => column.stage === fromStage)?.items.find((lead) => lead.id === leadId);
    if (!moved) return;

    setColumns((current) =>
      current.map((column) => {
        if (column.stage === fromStage) {
          return { ...column, items: column.items.filter((lead) => lead.id !== leadId) };
        }
        if (column.stage === toStage) {
          return { ...column, items: [moved, ...column.items] };
        }
        return column;
      }),
    );

    setPendingId(leadId);
    setError(null);

    try {
      await apiFetch('/api/admin/leads', { method: 'PATCH', json: { id: leadId, status: toStage } });
    } catch (caught) {
      setColumns(previous);
      setError(caught instanceof ApiClientError ? caught.message : 'Could not move that enquiry. Please try again.');
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      {error ? (
        <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto pb-4 scrollbar-thin">
        <div className="grid min-w-[64rem] grid-cols-5 gap-3">
          {columns.map((column) => (
            <section
              key={column.stage}
              aria-label={column.label}
              onDragOver={(event) => {
                event.preventDefault();
                setOverStage(column.stage);
              }}
              onDragLeave={() => setOverStage((current) => (current === column.stage ? null : current))}
              onDrop={(event) => {
                event.preventDefault();
                const leadId = event.dataTransfer.getData('text/plain');
                const fromStage = leadId ? findStage(columns, leadId) : null;
                setOverStage(null);
                setDraggingId(null);
                if (leadId && fromStage) void moveLead(leadId, fromStage, column.stage);
              }}
              className={`flex flex-col rounded-xl border bg-steel-50 transition-colors dark:bg-steel-900 ${
                overStage === column.stage
                  ? 'border-brand-400 bg-brand-50/60 dark:border-brand-600 dark:bg-brand-950/40'
                  : 'border-steel-200 dark:border-steel-800'
              }`}
            >
              <header className="border-b border-steel-200 px-3 py-2.5 dark:border-steel-800">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-steel-900 dark:text-steel-100">{column.label}</h2>
                  <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold tabular-nums text-steel-600 dark:bg-steel-800 dark:text-steel-300">
                    {column.items.length}
                  </span>
                </div>
                <p className="mt-0.5 text-xs tabular-nums text-steel-500 dark:text-steel-400">
                  {formatMoney(columnValue(column.items), base, { compact: true })}
                </p>
              </header>

              <ol className="min-h-[4rem] flex-1 space-y-2 p-2">
                {column.items.length === 0 ? (
                  <li className="py-8 text-center text-xs text-steel-400 dark:text-steel-500">Nothing here</li>
                ) : (
                  column.items.slice(0, 25).map((lead) => {
                    const overdue = lead.nextActionAtISO && new Date(lead.nextActionAtISO) < new Date();
                    const isPending = pendingId === lead.id;

                    return (
                      <li key={lead.id}>
                        <Link
                          href={`/admin/leads/${lead.id}`}
                          draggable
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', lead.id);
                            event.dataTransfer.effectAllowed = 'move';
                            setDraggingId(lead.id);
                          }}
                          onDragEnd={() => {
                            setDraggingId(null);
                            setOverStage(null);
                          }}
                          onClick={(event) => {
                            // A drag gesture ending over the same card still
                            // fires click in some browsers — swallow it.
                            if (draggingId) event.preventDefault();
                          }}
                          className={`block cursor-grab rounded-lg border border-steel-200 bg-white p-3 transition-colors hover:border-brand-300 hover:shadow-sm active:cursor-grabbing dark:border-steel-700 dark:bg-steel-800 dark:hover:border-brand-600 ${
                            isPending ? 'opacity-50' : ''
                          } ${draggingId === lead.id ? 'opacity-40' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium text-steel-900 dark:text-steel-100">
                              {lead.firstName} {lead.lastName}
                            </p>
                            <span
                              className={
                                lead.score >= 70
                                  ? 'shrink-0 text-xs font-bold text-emerald-600 dark:text-emerald-400'
                                  : lead.score >= 40
                                    ? 'shrink-0 text-xs font-medium text-amber-600 dark:text-amber-400'
                                    : 'shrink-0 text-xs text-steel-400'
                              }
                            >
                              {lead.score}
                            </span>
                          </div>

                          {lead.company ? (
                            <p className="mt-0.5 truncate text-xs text-steel-500 dark:text-steel-400">{lead.company}</p>
                          ) : null}

                          {lead.truck ? (
                            <p className="mt-1.5 truncate text-xs text-steel-600 dark:text-steel-300">{lead.truck.title}</p>
                          ) : (
                            <p className="mt-1.5 text-xs italic text-steel-400">General enquiry</p>
                          )}

                          <div className="mt-2 flex items-center justify-between gap-2 border-t border-steel-100 pt-2 dark:border-steel-700">
                            <span className="text-xs font-semibold tabular-nums text-steel-700 dark:text-steel-200">
                              {lead.estimatedValue ?? lead.truck?.priceNet
                                ? formatMoney(lead.estimatedValue ?? lead.truck?.priceNet ?? 0, base, {
                                    compact: true,
                                  })
                                : '—'}
                            </span>
                            <span
                              className={overdue ? 'text-xs font-medium text-red-600' : 'text-xs text-steel-400'}
                            >
                              {lead.nextActionAtISO ? relativeTime(new Date(lead.nextActionAtISO)) : ''}
                            </span>
                          </div>

                          <p className="mt-1.5 truncate text-[11px] text-steel-400">
                            {lead.assignedTo
                              ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName.charAt(0)}.`
                              : 'Unassigned'}
                          </p>
                        </Link>
                      </li>
                    );
                  })
                )}
              </ol>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

function findStage(columns: PipelineColumn[], leadId: string): LeadStatusValue | null {
  return columns.find((column) => column.items.some((lead) => lead.id === leadId))?.stage ?? null;
}
