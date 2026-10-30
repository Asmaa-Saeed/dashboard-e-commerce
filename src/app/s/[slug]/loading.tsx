export default function Loading() {
  return (
    <div role="status" aria-label="جاري التحميل" className="flex flex-col gap-5">
      <div className="h-8 w-48 animate-pulse rounded-full bg-line" />
      <div className="grid gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-card border border-line bg-surface p-4">
            <div className="h-5 w-24 animate-pulse rounded bg-line" />
            <div className="h-9 w-2/3 animate-pulse rounded bg-surface-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-surface-muted" />
            <div className="h-10 w-full animate-pulse rounded-control bg-line" />
          </div>
        ))}
      </div>
    </div>
  );
}
