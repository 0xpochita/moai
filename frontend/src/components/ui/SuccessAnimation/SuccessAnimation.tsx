"use client";

import Lottie from "lottie-react";
import successAnimation from "../../../../public/Assets/Animation/success-animation.json";
import agentActive from "../../../../public/Assets/Animation/agent-active.json";
import agentInactive from "../../../../public/Assets/Animation/agent-unactive.json";

type LottieIconProps = {
  size?: number;
  loop?: boolean;
};

export function SuccessAnimation({ size = 80, loop = false }: LottieIconProps) {
  return (
    <Lottie
      animationData={successAnimation}
      loop={loop}
      autoplay
      style={{ height: size, width: size }}
    />
  );
}

export function AgentActiveAnimation({
  size = 56,
  loop = true,
}: LottieIconProps) {
  return (
    <Lottie
      animationData={agentActive}
      loop={loop}
      autoplay
      style={{ height: size, width: size }}
    />
  );
}

export function AgentInactiveAnimation({
  size = 56,
  loop = true,
}: LottieIconProps) {
  return (
    <Lottie
      animationData={agentInactive}
      loop={loop}
      autoplay
      style={{ height: size, width: size }}
    />
  );
}
