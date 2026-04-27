import type { HTMLAttributes } from "react";
import { cn } from "@/lib";

type SkeletonProps = HTMLAttributes<HTMLDivElement>;

export function Skeleton({ className, ...rest }: SkeletonProps) {
  return (
    <div
      {...rest}
      className={cn("bg-brand-soft animate-pulse rounded-xl", className)}
    />
  );
}
