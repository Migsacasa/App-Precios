export default function LoadingDashboard() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 rounded bg-white/10 animate-pulse" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded border bg-white/5 animate-pulse" />
        ))}
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="h-72 rounded border bg-white/5 animate-pulse" />
        <div className="h-72 rounded border bg-white/5 animate-pulse" />
      </div>
    </div>
  );
}
