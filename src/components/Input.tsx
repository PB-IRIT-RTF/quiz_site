import type { InputHTMLAttributes } from "react";
import { cn } from "@/utils/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-[var(--event-border)] bg-white px-3 py-2 text-sm text-[var(--event-ink)] outline-none transition focus:border-[var(--event-accent-blue)] focus:ring-2 focus:ring-[#79CBF733]",
        className
      )}
      {...props}
    />
  );
}
