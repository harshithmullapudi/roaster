export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");

  return slug || "team";
}

export function nextSlugCandidate(base: string, attempt: number): string {
  const suffix = `-${attempt}`;
  return `${base.slice(0, 48 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
