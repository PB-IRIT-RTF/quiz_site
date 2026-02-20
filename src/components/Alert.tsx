import type { PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

export function Alert({
  children,
  variant = "info",
  className,
}: PropsWithChildren<{ variant?: "info" | "warning" | "danger" | "success"; className?: string }>) {
  const styles =
    variant === "info"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : variant === "success"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : variant === "warning"
          ? "border-amber-200 bg-amber-50 text-amber-900"
          : "border-rose-200 bg-rose-50 text-rose-900";

  return <div className={cn("rounded-2xl border p-4 text-sm", styles, className)}>{children}</div>;
}
