import Image from "next/image";
import { cn } from "@/lib";
import type { UniswapVersion } from "@/types";

type ProtocolIconProps = {
  protocol: UniswapVersion;
  className?: string;
  size?: "sm" | "md";
};

const SIZE = {
  sm: { wrap: "h-7 w-7", logo: 14, badge: "h-3.5 min-w-4 px-0.5 text-[7px]" },
  md: { wrap: "h-9 w-9", logo: 18, badge: "h-4 min-w-5 px-1 text-[8px]" },
};

export function ProtocolIcon({
  protocol,
  className,
  size = "sm",
}: ProtocolIconProps) {
  const dims = SIZE[size];

  return (
    <span
      className={cn(
        "bg-brand-soft relative inline-flex shrink-0 items-center justify-center rounded-full",
        dims.wrap,
        className,
      )}
    >
      <Image
        src="/Assets/Images/logo-defi/uniswap-logo.svg"
        alt="Uniswap"
        width={dims.logo}
        height={Math.round(dims.logo * 1.08)}
        className="select-none"
      />
      <span
        className={cn(
          "bg-brand absolute -right-1 -bottom-1 inline-flex items-center justify-center rounded-full font-bold tracking-tight text-white",
          dims.badge,
        )}
      >
        {protocol}
      </span>
    </span>
  );
}
