export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page header skeleton */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <div className="skeleton h-7 w-48 rounded-lg" />
          <div className="skeleton h-4 w-72 rounded" />
        </div>
        <div className="skeleton h-9 w-28 rounded-lg" />
      </div>
      {/* Filter bar skeleton */}
      <div className="card flex gap-3 p-4">
        <div className="skeleton h-9 flex-1 rounded-lg" />
        <div className="skeleton h-9 w-36 rounded-lg" />
        <div className="skeleton h-9 w-20 rounded-lg" />
      </div>
      {/* Table skeleton */}
      <div className="card overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
          <div className="flex gap-8">
            {[100, 80, 60, 60, 50].map((w, i) => (
              <div key={i} className={`skeleton h-3 rounded`} style={{ width: `${w}px` }} />
            ))}
          </div>
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-8 border-b border-slate-50 px-4 py-4">
            <div className="space-y-1.5">
              <div className="skeleton h-3.5 w-24 rounded" />
              <div className="skeleton h-3 w-36 rounded" />
            </div>
            <div className="skeleton h-3.5 w-20 rounded" />
            <div className="skeleton h-3.5 w-12 rounded" />
            <div className="skeleton h-3.5 w-24 rounded" />
            <div className="skeleton h-5 w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
