"use client";

import { type ReactNode, useEffect } from "react";
import { useThemeStore } from "@/store";

/// Applies the persisted theme to <html>. The pre-hydration script in
/// layout.tsx already sets the class to avoid FOUC; this just keeps it in
/// sync as the user toggles.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const theme = useThemeStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
  }, [theme]);

  return <>{children}</>;
}
