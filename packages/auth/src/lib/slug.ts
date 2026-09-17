/**
 * Turns a team name into a URL slug.
 *
 * The slug is load-bearing: every authenticated route is `/{slug}/…`, and the
 * server re-checks membership against it on each request. So it has to be
 * stable, lowercase, and free of anything that would need escaping.
 */
export function slugify(name: string): string {
  const slug = name
    .normalize("NFKD")
    // Strip combining marks so "Tegón" becomes "tegon" rather than "tegn".
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    // Slicing can leave a trailing hyphen behind.
    .replace(/-+$/g, "");

  // A name of only punctuation or non-Latin script leaves nothing usable.
  // Callers resolve the collision, so a shared constant is fine here.
  return slug || "team";
}

/**
 * Next candidate when `slugify`'s result is already taken. Callers loop:
 * try `slugify(name)`, then `nextSlugCandidate(base, 2)`, `(base, 3)`, …
 * until `organization.checkSlug` reports the slug free.
 */
export function nextSlugCandidate(base: string, attempt: number): string {
  const suffix = `-${attempt}`;
  return `${base.slice(0, 48 - suffix.length).replace(/-+$/g, "")}${suffix}`;
}
