import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-hover",
  secondary: "bg-brand-soft text-brand hover:bg-brand-hover hover:text-white",
  ghost: "bg-transparent text-main hover:bg-brand-soft",
};

const SIZE_CLASS: Record<Size, string> = {
  sm: "h-8 px-3 text-xs rounded-lg",
  md: "h-10 px-3.5 text-sm rounded-xl",
  lg: "h-11 px-5 text-sm rounded-xl",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium tracking-tight",
        "transition-all duration-150 ease-in-out active:scale-[0.98]",
        "disabled:opacity-50 disabled:active:scale-100",
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        className,
      )}
    />
  );
}
