import type { PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

export function Alert({
  children,
  variant = "info",
  className,
}: PropsWithChildren<{ variant?: "info" | "warning" | "danger" | "success"; className?: string }>) {
  const styles =
    variant === "info"
      ? "border-[#79CBF7] bg-[#EAF8FF] text-[#2E607A]"
      : variant === "success"
        ? "border-[#8CCFAD] bg-[#EEF9F2] text-[#1D5B3B]"
        : variant === "warning"
          ? "border-[#D7A6EF] bg-[#F8EEFD] text-[#60426F]"
          : "border-rose-200 bg-rose-50 text-rose-900";

  return <div className={cn("rounded-2xl border p-4 text-sm", styles, className)}>{children}</div>;
}
