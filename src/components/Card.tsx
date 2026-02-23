import type { PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

export function Card({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn("rounded-2xl border border-[var(--event-border)] bg-white/95 p-5 shadow-sm", className)}>{children}</div>;
}
