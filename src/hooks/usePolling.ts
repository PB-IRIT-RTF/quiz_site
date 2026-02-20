import { useCallback, useEffect, useState } from "react";
import { useInterval } from "@/hooks/useInterval";

export function usePolling<T>(loader: () => Promise<T>, intervalMs: number, immediate = true) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const v = await loader();
      setData(v);
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    if (immediate) void load();
  }, [immediate, load]);

  useInterval(() => {
    void load();
  }, intervalMs);

  return { data, error, loading, reload: load };
}
