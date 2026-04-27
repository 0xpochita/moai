"use client";

import { useState } from "react";
import { cn } from "@/lib";

type NavLink = {
  id: string;
  label: string;
};

const LINKS: NavLink[] = [
  { id: "earn", label: "Earn" },
  { id: "compare", label: "Compare" },
  { id: "portfolio", label: "Portfolio" },
];

export function NavbarLinks() {
  const [active, setActive] = useState<string>("earn");

  return (
    <nav className="hidden items-center gap-1 md:flex">
      {LINKS.map((link) => {
        const isActive = active === link.id;
        return (
          <button
            type="button"
            key={link.id}
            onClick={() => setActive(link.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-sm font-medium tracking-tight transition-colors",
              isActive ? "text-main" : "text-muted hover:text-main",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {link.label}
          </button>
        );
      })}
    </nav>
  );
}
