export function normalizeSpaces(s: string) {
  return s.replace(/\s+/g, " ").trim();
}

export function titleCaseRu(s: string) {
  const clean = normalizeSpaces(s);
  return clean
    .split(" ")
    .map((w) => {
      const lower = w.toLowerCase();
      // поддержка дефиса: Петров-иванов -> Петров-Иванов
      return lower
        .split("-")
        .map((p) => (p ? p[0].toUpperCase() + p.slice(1) : ""))
        .join("-");
    })
    .join(" ");
}

export function normalizeGroup(s: string) {
  return normalizeSpaces(s).toUpperCase();
}

export function normalizeVkUrl(input: string): string | null {
  const raw = normalizeSpaces(input);
  if (!raw) return null;
  const withProto = raw.startsWith("http://") || raw.startsWith("https://") ? raw : `https://${raw}`;
  try {
    const u = new URL(withProto);
    if (u.hostname !== "vk.com") return null;
    const path = u.pathname.replace(/^\//, "");
    if (!path) return null;
    return `https://vk.com/${path}`;
  } catch {
    return null;
  }
}
