"use client";

import Image from "next/image";
import { useState } from "react";
import { getProtocolLogoUrl } from "@/lib";

type ProtocolAvatarProps = {
  protocolName: string;
  size?: number;
};

export function ProtocolAvatar({
  protocolName,
  size = 32,
}: ProtocolAvatarProps) {
  const [errored, setErrored] = useState(false);
  const url = getProtocolLogoUrl(protocolName);

  if (!url || errored) {
    return (
      <span
        style={{ height: size, width: size }}
        className="bg-brand-soft text-brand inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold tracking-tight uppercase"
      >
        {protocolName.charAt(0)}
      </span>
    );
  }

  return (
    <span
      style={{ height: size, width: size }}
      className="bg-surface ring-soft inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full"
    >
      <Image
        src={url}
        alt={protocolName}
        width={size}
        height={size}
        style={{ height: size, width: size }}
        className="object-cover"
        onError={() => setErrored(true)}
        unoptimized
      />
    </span>
  );
}
