"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card flex flex-col items-center p-10 text-center">
      <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-rose-50">
        <svg
          className="size-7 text-rose-500"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
          />
        </svg>
      </div>
      <h2 className="text-base font-semibold text-slate-900">This page could not be loaded</h2>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        Something went wrong. Please try again. If the problem continues, contact your administrator.
      </p>
      <button
        className="btn-secondary mt-6"
        onClick={reset}
        type="button"
        id="error-retry"
      >
        <svg className="size-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Try again
      </button>
    </div>
  );
}
