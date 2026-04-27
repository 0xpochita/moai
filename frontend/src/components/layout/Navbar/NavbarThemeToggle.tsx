"use client";

import { Moon } from "lucide-react";
import { toast } from "sonner";

export function NavbarThemeToggle() {
  const handleClick = () => {
    toast("Theme switching coming soon", {
      description: "Light mode is currently the default experience.",
    });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="Toggle theme"
      className="bg-elevated hover:bg-brand-soft text-muted flex h-9 w-9 items-center justify-center rounded-full transition-colors"
    >
      <Moon className="h-4 w-4" aria-hidden />
    </button>
  );
}
