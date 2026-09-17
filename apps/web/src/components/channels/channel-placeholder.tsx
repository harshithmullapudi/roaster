export interface ChannelPlaceholderProps {
  title: string;
  description: string;
}

export function ChannelPlaceholder({
  title,
  description,
}: ChannelPlaceholderProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-10">
      <p className="text-base font-medium">{title}</p>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  );
}
