import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Card } from "@/components/Card";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";
import { Alert } from "@/components/Alert";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api/errors";
import { normalizeVkUrl, titleCaseRu, normalizeGroup, normalizeSpaces } from "@/lib/validation";

const fioWord = "[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)*";
const fioRe = new RegExp(`^${fioWord}(?:\\s+${fioWord}){1,3}$`);

const schema = z.object({
  fio: z
    .string()
    .transform((v) => normalizeSpaces(v))
    .refine((v) => fioRe.test(v), "ФИО: 2–4 слова (кириллица), допускается дефис")
    .transform((v) => titleCaseRu(v)),
  group: z
    .string()
    .transform((v) => normalizeGroup(v))
    .refine((v) => /^[А-ЯЁA-Z]{2}-\d{6}$/.test(v), "Группа: формат РИ-150940"),
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
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await api.registerParticipant({ fio: values.fio, group: values.group, vk_url: values.vk_url });
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

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card>
        <h1 className="text-xl font-semibold text-slate-900">Регистрация участника</h1>
        <p className="mt-1 text-sm text-slate-600">Данные сохраняются на сервере. Прохождение квиза — только один раз.</p>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit(onSubmit)}>
          {submitError ? <Alert variant="danger">{submitError}</Alert> : null}

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-900">ФИО</label>
            <Input placeholder="Иванов Иван Иванович" autoComplete="name" {...register("fio")} />
            {errors.fio ? <div className="text-xs text-rose-600">{errors.fio.message}</div> : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-900">Академическая группа</label>
            <Input placeholder="РИ-150940" autoComplete="off" {...register("group")} />
            {errors.group ? <div className="text-xs text-rose-600">{errors.group.message}</div> : null}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-900">Ссылка VK</label>
            <Input placeholder="https://vk.com/id123" autoComplete="off" {...register("vk_url")} />
            {errors.vk_url ? <div className="text-xs text-rose-600">{errors.vk_url.message}</div> : null}
          </div>

          <Alert variant="info">
            VK‑ссылка обязательна и хранится для организаторов, но не отображается участникам и не попадает в публичный лидерборд.
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
