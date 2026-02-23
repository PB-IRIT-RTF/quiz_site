import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: PropsWithChildren<
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }
>) {
  const styles =
    variant === "primary"
      ? "bg-[#79CBF7] text-[#1f3340] hover:bg-[#67bde9]"
      : variant === "secondary"
        ? "border border-[var(--event-border)] bg-[var(--event-bg)] text-[var(--event-ink)] hover:bg-[#dff2fd]"
        : variant === "danger"
          ? "bg-rose-600 text-white hover:bg-rose-700"
          : "bg-transparent text-[var(--event-ink)] hover:bg-[#f0e4f8]";

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        styles,
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
