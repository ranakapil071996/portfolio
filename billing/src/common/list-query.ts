export function escapeRegex(query: string): string {
  return query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mongoSort(
  allowed: Record<string, string>,
  sort?: string,
  dir?: string,
): Record<string, 1 | -1> {
  const field = (sort && allowed[sort]) || "createdAt";
  const order: 1 | -1 = dir === "asc" ? 1 : -1;
  const spec: Record<string, 1 | -1> = { [field]: order };
  if (field !== "createdAt") spec.createdAt = -1;
  return spec;
}
