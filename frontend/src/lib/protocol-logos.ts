const PROTOCOL_LOGOS: Record<string, string> = {
  morpho: "/Assets/Images/logo-defi/morpho-logo.webp",
  aave: "/Assets/Images/logo-defi/aave-logo.svg",
  euler: "/Assets/Images/logo-defi/euler-finance-logo.svg",
  "euler-finance": "/Assets/Images/logo-defi/euler-finance-logo.svg",
  ethena: "/Assets/Images/logo-defi/ethena-logo.jpg",
  etherfi: "/Assets/Images/logo-defi/etherfi-logo.jpg",
  pendle: "/Assets/Images/logo-defi/pendle-logo.jpg",
  "yo-protocol": "/Assets/Images/logo-defi/yo-protocol-logo.png",
  uniswap: "/Assets/Images/logo-defi/uniswap-logo.svg",
  concrete: "/Assets/Images/logo-defi/concrete-logo.png",
  autofarm: "/Assets/Images/logo-defi/autofarm-logo.png",
  kelpdao: "/Assets/Images/logo-defi/kelpdao-logo.jpg",
  kinetiq: "/Assets/Images/logo-defi/kinetiq-logo.jpg",
  "maple-finance": "/Assets/Images/logo-defi/maple-finance-logo.jpg",
  maple: "/Assets/Images/logo-defi/maple-finance-logo.jpg",
  usdai: "/Assets/Images/logo-defi/usdai-logo.jpg",
  upshift: "/Assets/Images/logo-defi/upshift-logo.jpg",
  hyperlend: "/Assets/Images/logo-defi/hyperlend-logo.jpg",
  hypurrfi: "/Assets/Images/logo-defi/hypurrfi-logo.jpg",
  felix: "/Assets/Images/logo-defi/felix-logo.jpg",
  avon: "/Assets/Images/logo-defi/avon-logo.jpg",
  "neverland-money": "/Assets/Images/logo-defi/neverland-money-logo.jpg",
};

export function getProtocolLogoUrl(protocolName: string): string | null {
  const normalized = protocolName.toLowerCase().replace(/-v\d+$/, "");
  return PROTOCOL_LOGOS[normalized] ?? PROTOCOL_LOGOS[protocolName] ?? null;
}

const FRIENDLY_NAMES: Record<string, string> = {
  morpho: "Morpho",
  aave: "Aave",
  compound: "Compound",
  euler: "Euler",
  "euler-finance": "Euler",
  pendle: "Pendle",
  ethena: "Ethena",
  etherfi: "EtherFi",
  lido: "Lido",
  yearn: "Yearn",
  "yo-protocol": "Yo Protocol",
  uniswap: "Uniswap",
  concrete: "Concrete",
  autofarm: "Autofarm",
  kelpdao: "KelpDAO",
  kinetiq: "Kinetiq",
  "maple-finance": "Maple Finance",
  maple: "Maple Finance",
  usdai: "USDai",
  upshift: "Upshift",
  hyperlend: "HyperLend",
  hypurrfi: "HypurrFi",
  felix: "Felix",
  avon: "Avon",
  "neverland-money": "Neverland Money",
};

function titleCase(input: string): string {
  return input
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function formatProtocolName(raw: string): string {
  if (!raw) return raw;
  const lower = raw.toLowerCase();
  const stripped = lower.replace(/-v\d+$/, "");
  return (
    FRIENDLY_NAMES[stripped] ?? FRIENDLY_NAMES[lower] ?? titleCase(stripped)
  );
}
