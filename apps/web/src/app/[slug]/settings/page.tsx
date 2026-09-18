import { redirect } from "next/navigation";

export default async function SettingsIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}/settings/preferences`);
}
