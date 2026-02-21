export default function ObservationsLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-6 w-48 bg-muted rounded" />
        <div className="flex gap-2">
          <div className="h-9 w-24 bg-muted rounded" />
          <div className="h-9 w-16 bg-muted rounded" />
        </div>
      </div>
      <div className="border rounded overflow-hidden">
        <div className="h-10 bg-muted" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 border-t bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
