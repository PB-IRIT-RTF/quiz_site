export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

// Режим API:
// - если явно задан VITE_API_MODE — используем его
// - иначе если задан VITE_API_BASE — считаем что есть backend и работаем по HTTP
// - иначе в PROD (когда фронт обычно раздаётся самим backend) используем HTTP с относительными URL
// - иначе (dev без backend) — mock
export const API_MODE =
  (import.meta.env.VITE_API_MODE as string | undefined) ??
  (API_BASE
    ? "http"
    : import.meta.env.PROD
      ? "http"
      : "mock");

export const APP_TZ = "Asia/Yekaterinburg";
