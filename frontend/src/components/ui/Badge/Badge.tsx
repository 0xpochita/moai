import type { HTMLAttributes } from "react";
import { cn } from "@/lib";

type Tone = "neutral" | "brand" | "outline" | "success" | "warning";

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

const TONE_CLASS: Record<Tone, string> = {
  neutral: "bg-brand-soft text-brand",
  brand: "bg-brand text-white",
  outline: "bg-elevated text-muted",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
};

export function Badge({ className, tone = "neutral", ...rest }: BadgeProps) {
  return (
    <span
      {...rest}
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium tracking-tight uppercase",
        TONE_CLASS[tone],
        className,
      )}
    />
  );
}
