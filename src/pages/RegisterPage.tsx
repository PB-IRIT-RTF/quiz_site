import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { normalizeVkUrl, normalizeSpaces } from "@/lib/validation";

const schema = z.object({
  nickname: z
    .string()
    .transform((v) => normalizeSpaces(v))
    .refine((v) => v.length > 0, "Ник обязателен")
    .refine((v) => v.length <= 64, "Ник слишком длинный"),
  vk_url: z
    .string()
    .transform((v) => normalizeSpaces(v))
    .refine((v) => normalizeVkUrl(v) !== null, "VK: только домен vk.com")
    .transform((v) => normalizeVkUrl(v) as string),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const nav = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  useEffect(() => {
    let mounted = true;
    api
      .me()
      .then((me) => {
        if (!mounted) return;
        if (me.role === "participant") {
          nav("/start", { replace: true });
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (mounted) setCheckingSession(false);
      });

    return () => {
      mounted = false;
    };
  }, [nav]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await api.registerParticipant({ nickname: values.nickname, vk_url: values.vk_url });
      nav("/start", { replace: true });
    } catch (e) {
      if (e instanceof ApiError) {
        const detail = (e.body as any)?.detail;
        setSubmitError(typeof detail === "string" ? detail : `Ошибка регистрации (HTTP ${e.status})`);
      } else {
        setSubmitError(e instanceof Error ? e.message : String(e));
      }
    }
  };

  if (checkingSession) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <Card>Проверяем сессию…</Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Регистрация участника</h1>
        <p className="mt-1 text-sm text-slate-600"></p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {submitError ? <Alert variant="danger">{submitError}</Alert> : null}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-900">Ник</label>
            <Input placeholder="Например: CosmosCat" autoComplete="nickname" {...register("nickname")} />
            {errors.nickname ? <div className="text-xs text-rose-600">{errors.nickname.message}</div> : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-900">Ссылка VK</label>
            <Input placeholder="https://vk.com/id123" autoComplete="off" {...register("vk_url")} />
            {errors.vk_url ? <div className="text-xs text-rose-600">{errors.vk_url.message}</div> : null}
          </div>

          <Alert variant="info">
            Нажимая на кнопку  "Зарегистрироваться", вы соглашаетесь на обработку персональных данных
          </Alert>

          <div className="flex gap-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Сохраняем…" : "Зарегистрироваться"}
            </Button>
            <Button type="button" variant="secondary" onClick={() => nav("/")}>Назад</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
