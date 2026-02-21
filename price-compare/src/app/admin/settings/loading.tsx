export default function LoadingSettings() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-8 w-48 rounded bg-muted" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2 rounded border p-4">
          <div className="h-5 w-32 bg-muted rounded" />
          <div className="h-10 w-full bg-muted/50 rounded" />
          <div className="h-10 w-full bg-muted/50 rounded" />
        </div>
      ))}
    </div>
  );
}
