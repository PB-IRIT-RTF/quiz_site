import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { api } from "@/lib/api";

export function AdminLoginPage() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.adminLogin({ password });
      nav("/admin/dashboard");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-md space-y-6">
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Админка</h1>
        <p className="mt-1 text-sm text-slate-600">Минимальный вход (для демо). В реальном проекте — отдельная админ‑авторизация.</p>

        {error ? (
          <div className="mt-4">
            <Alert variant="danger">Ошибка входа: {error}</Alert>
          </div>
        ) : (
          <div className="mt-4">
            <Alert variant="info">Mock‑режим: пароль <span className="font-mono">admin</span></Alert>
          </div>
        )}

        <div className="mt-4 space-y-2">
          <label className="text-sm font-medium text-slate-900">Пароль</label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        <div className="mt-5 flex gap-2">
          <Button onClick={submit} disabled={busy || password.length === 0}>
            {busy ? "Входим…" : "Войти"}
          </Button>
          <Button variant="secondary" onClick={() => nav("/")}>Назад</Button>
        </div>
      </Card>
    </div>
  );
}
