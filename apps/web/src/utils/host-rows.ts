import type { HostProjects, SelectedProject } from "@roster/api";

export type HostStatus = "online" | "asleep" | "unreachable";

export interface ProjectRow {
  id: string;
  name: string;
  repo: string | null;
  added: boolean;
}

export interface HostRow {
  id: string;
  name: string;
  status: HostStatus;
  wakeCommand: string | null;
  error: string | null;
  projects: ProjectRow[];
}

function status(entry: HostProjects): HostStatus {
  if (!entry.host.online) return "asleep";
  return entry.error ? "unreachable" : "online";
}

export function hostRows(hosts: HostProjects[]): HostRow[] {
  return hosts.map((entry) => ({
    id: entry.host.id,
    name: entry.host.name,
    status: status(entry),
    wakeCommand: entry.host.wakeCommand,
    error: entry.error,
    projects: entry.projects
      .map((project) => ({
        id: project.id,
        name: project.name,
        repo:
          project.repoOwner && project.repoName
            ? `${project.repoOwner}/${project.repoName}`
            : null,
        added: project.added,
      }))
      .sort((a, b) => {
        if (a.added !== b.added) return a.added ? 1 : -1;
        return a.name.localeCompare(b.name);
      }),
  }));
}

export function selectedProjects(
  hosts: HostProjects[],
  selected: Set<string>,
): SelectedProject[] {
  return hosts.flatMap((entry) =>
    entry.projects
      .filter((project) => !project.added && selected.has(project.id))
      .map((project) => ({
        supersetProjectId: project.id,
        supersetHostId: entry.host.id,
        name: project.name,
        repoOwner: project.repoOwner,
        repoName: project.repoName,
        repoUrl: project.repoUrl,
        repoPath: project.repoPath,
      })),
  );
}

export function addableCount(hosts: HostProjects[]): number {
  return hosts.reduce(
    (total, entry) =>
      total + entry.projects.filter((project) => !project.added).length,
    0,
  );
}
