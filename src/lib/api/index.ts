import { API_MODE } from "@/lib/env";
import type { Api } from "@/lib/api/api";
import { mockApi } from "@/lib/api/mockApi";
import { httpApi } from "@/lib/api/httpApi";

export const api: Api = API_MODE === "http" ? httpApi : mockApi;
