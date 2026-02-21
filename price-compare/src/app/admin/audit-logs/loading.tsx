export default function LoadingAuditLogs() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-8 w-20 bg-muted rounded" />
        ))}
      </div>
      <div className="border rounded overflow-hidden">
        <div className="h-10 bg-muted" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-10 border-t bg-muted/30" />
        ))}
      </div>
    </div>
  );
}
