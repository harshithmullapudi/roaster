export interface HostOfflineNoticeProps {
  hostName: string;
  wakeCommand: string | null;
}

export function HostOfflineNotice({
  hostName,
  wakeCommand,
}: HostOfflineNoticeProps) {
  return (
    <div className="border-border rounded border p-3">
      <p className="text-sm">
        <span className="font-medium">{hostName}</span>{" "}
        <span className="text-muted-foreground">is asleep</span>
      </p>
      <code className="bg-grayAlpha-100 mt-2 block rounded px-2 py-1 font-mono text-xs">
        {wakeCommand ?? `superset hosts wake ${hostName}`}
      </code>
    </div>
  );
}
