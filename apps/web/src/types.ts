export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface UserSummary {
  id: string;
  name: string;
  email: string;
}

export type SidebarSection = "channels" | "members";
