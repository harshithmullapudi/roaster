import { Hash } from "lucide-react";

export interface ChannelListItem {
  id: string;
  name: string;
  slug: string;
  repoOwner: string | null;
  repoName: string | null;
  repoPath: string | null;
}

export interface ChannelListProps {
  projects: ChannelListItem[];
}

export function ChannelList({ projects }: ChannelListProps) {
  return (
    <ul className="border-border divide-y rounded-lg border">
      {projects.map((project) => (
        <li
          key={project.id}
          className="bg-background-3 flex items-center gap-2.5 px-3 py-2.5 first:rounded-t-lg last:rounded-b-lg"
        >
          <Hash className="text-muted-foreground size-3.5 shrink-0" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm">{project.slug}</span>
            <span className="text-muted-foreground block truncate text-xs">
              {project.repoOwner && project.repoName
                ? `${project.repoOwner}/${project.repoName}`
                : project.repoPath}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
