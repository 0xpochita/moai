"use client";

import { Moon, Sun } from "lucide-react";
import { useThemeStore } from "@/store";

export function NavbarThemeToggle() {
  const theme = useThemeStore((s) => s.theme);
  const toggle = useThemeStore((s) => s.toggle);
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="bg-elevated hover:bg-brand-soft text-muted hover:text-brand flex h-9 w-9 items-center justify-center rounded-full transition-colors"
    >
      {isDark ? (
        <Sun className="h-4 w-4" aria-hidden />
      ) : (
        <Moon className="h-4 w-4" aria-hidden />
      )}
    </button>
  );
}
