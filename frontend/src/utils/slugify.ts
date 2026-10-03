export function slugify(value: string): string {
  return value
    .replace(/\*/g, " star ")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
