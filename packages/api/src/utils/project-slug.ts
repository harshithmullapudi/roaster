export function slugifyProject(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");

  return slug || "project";
}

export function uniqueProjectSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;

  for (let attempt = 2; attempt < 1000; attempt++) {
    const suffix = `-${attempt}`;
    const candidate = `${base.slice(0, 32 - suffix.length).replace(/-+$/g, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }

  throw new Error(`Could not find a free channel name for "${base}".`);
}
