"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card p-8">
      <h2 className="font-semibold text-rose-800">This page could not be loaded.</h2>
      <p className="mt-2 text-sm text-slate-600">
        Please try again. If the problem continues, contact the administrator.
      </p>
      <button className="btn-secondary mt-4" onClick={reset} type="button">
        Try again
      </button>
    </div>
  );
}
