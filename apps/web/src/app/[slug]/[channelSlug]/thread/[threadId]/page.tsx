import { redirect } from "next/navigation";

export default async function ThreadPage({
  params,
}: {
  params: Promise<{ slug: string; channelSlug: string; threadId: string }>;
}) {
  const { slug, channelSlug, threadId } = await params;
  redirect(`/${slug}/${channelSlug}?thread=${threadId}`);
}
