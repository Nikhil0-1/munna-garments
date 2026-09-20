export function SkeletonLine({ className = '' }: { className?: string }) {
  return <div className={`shimmer rounded-lg h-4 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid rgba(201,169,110,0.12)' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="shimmer w-10 h-10 rounded-xl" />
        <div className="flex-1 space-y-2">
          <SkeletonLine className="w-3/4" />
          <SkeletonLine className="w-1/2" />
        </div>
      </div>
      <SkeletonLine className="w-1/3 h-6" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3 p-4">
      <div className="shimmer h-10 rounded-xl" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="shimmer h-12 rounded-xl" style={{ opacity: 1 - i * 0.1 }} />
      ))}
    </div>
  );
}
