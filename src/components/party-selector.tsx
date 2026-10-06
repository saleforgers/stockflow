"use client";

import { useMemo, useRef, useState } from "react";

import type { PartyOption } from "@/lib/parties/quick-create";

function PartyButton({ party, onSelect }: { party: PartyOption; onSelect: () => void }) {
  return (
    <button
      className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100"
      type="button"
      onClick={onSelect}
    >
      <span className="font-medium text-slate-900">{party.name}</span>
      {party.phone ? <span className="text-xs text-slate-500">{party.phone}</span> : null}
    </button>
  );
}

function Section({
  label,
  parties,
  onSelect,
}: {
  label: string;
  parties: PartyOption[];
  onSelect: (party: PartyOption) => void;
}) {
  if (!parties.length) return null;
  return (
    <section className="border-t border-slate-100 pt-2 first:border-0 first:pt-0">
      <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      {parties.map((party) => (
        <PartyButton key={party.id} party={party} onSelect={() => onSelect(party)} />
      ))}
    </section>
  );
}

export function PartySelector({
  id,
  value,
  parties,
  placeholder,
  recentLabel,
  allLabel,
  addLabel,
  onChange,
  onAddNew,
}: {
  id: string;
  value: string;
  parties: PartyOption[];
  placeholder: string;
  recentLabel: string;
  allLabel: string;
  addLabel: string;
  onChange: (id: string) => void;
  onAddNew?: () => void;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const [search, setSearch] = useState("");
  const selected = parties.find((party) => party.id === value);
  const matches = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return parties;
    return parties.filter(
      (party) =>
        party.name.toLowerCase().includes(query) || party.phone?.toLowerCase().includes(query),
    );
  }, [parties, search]);
  const walkIn = matches.filter((party) => party.isWalkIn);
  const recent = matches.filter((party) => party.recent && !party.isWalkIn);
  const all = matches.filter((party) => !party.isWalkIn && !party.recent);
  const select = (party: PartyOption) => {
    onChange(party.id);
    details.current?.removeAttribute("open");
    setSearch("");
  };

  return (
    <details className="group relative" ref={details}>
      <summary className="input flex cursor-pointer list-none items-center justify-between" id={id}>
        <span
          className={`min-w-0 flex-1 truncate pr-4 ${
            selected ? "text-slate-900" : "text-slate-500"
          }`}
        >
          {selected?.name ?? placeholder}
        </span>
        <svg
          aria-hidden="true"
          className="ml-2 size-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="absolute z-30 mt-2 w-full min-w-72 rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
        <input
          aria-label={`Search ${allLabel.toLowerCase()}`}
          autoComplete="off"
          className="input mb-2"
          placeholder="Search by name or phone"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="max-h-72 space-y-2 overflow-y-auto">
          <Section label="Walk-in" parties={walkIn} onSelect={select} />
          <Section label={recentLabel} parties={recent} onSelect={select} />
          <Section label={allLabel} parties={all} onSelect={select} />
          {!matches.length ? (
            <p className="px-3 py-4 text-center text-sm text-slate-500">No matching parties.</p>
          ) : null}
        </div>
        {onAddNew ? (
          <button
            className="mt-2 w-full border-t border-slate-200 px-3 pt-3 text-left text-sm font-semibold text-blue-700"
            type="button"
            onClick={() => {
              details.current?.removeAttribute("open");
              onAddNew();
            }}
          >
            + {addLabel}
          </button>
        ) : null}
      </div>
    </details>
  );
}
