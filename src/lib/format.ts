export function msToHuman(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function toInitialsFio(fio: string) {
  const parts = fio.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  const last = parts[0];
  const initials = parts.slice(1).map((p) => (p[0] ? `${p[0].toUpperCase()}.` : "")).join("");
  return `${last} ${initials}`.trim();
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
