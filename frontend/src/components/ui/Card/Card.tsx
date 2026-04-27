import type { HTMLAttributes } from "react";
import { cn } from "@/lib";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

export function Card({ className, padded = true, ...rest }: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "bg-surface ring-card rounded-2xl",
        padded && "p-4",
        className,
      )}
    />
  );
}
