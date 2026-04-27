import { cn } from "@/lib";
import type { UniswapVersion } from "@/types";

type ProtocolIconProps = {
  protocol: UniswapVersion;
  className?: string;
};

const LABEL: Record<UniswapVersion, string> = {
  v2: "v2",
  v3: "v3",
  v4: "v4",
};

export function ProtocolIcon({ protocol, className }: ProtocolIconProps) {
  return (
    <span
      className={cn(
        "bg-brand-soft text-brand inline-flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-semibold tracking-tight",
        className,
      )}
    >
      {LABEL[protocol]}
    </span>
  );
}
