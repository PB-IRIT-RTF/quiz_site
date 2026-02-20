export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
export const API_MODE = (import.meta.env.VITE_API_MODE as string | undefined) ?? (API_BASE ? "http" : "mock");

export const APP_TZ = "Asia/Yekaterinburg";
