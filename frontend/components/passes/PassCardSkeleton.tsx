export function PassCardSkeleton() {
  return (
    <div className="rounded-xl border border-border overflow-hidden">
      <div className="px-5 pt-5 pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="h-3 w-16 skeleton rounded" />
          <div className="h-5 w-20 skeleton rounded-full" />
        </div>
        <div className="h-6 w-48 skeleton rounded mt-2" />
        <div className="h-3 w-28 skeleton rounded" />
      </div>
      <div className="mx-5 border-t border-border" />
      <div className="px-5 py-4 grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-4 skeleton rounded" />
        ))}
      </div>
    </div>
  );
}
