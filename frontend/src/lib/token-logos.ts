const BASE_TOKEN_LOGOS: Record<string, string> = {
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913":
    "/Assets/Images/logo-coin/usdc-logo.svg",
};

export function getLocalTokenLogo(address: string): string | null {
  const normalized = address.toLowerCase();
  return BASE_TOKEN_LOGOS[normalized] ?? null;
}
