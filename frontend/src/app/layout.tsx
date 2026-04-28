import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Navbar } from "@/components/layout";
import { ThemeProvider, Web3Provider } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moai",
};

// Runs before hydration to prevent FOUC when the user has dark mode persisted.
const themeBootstrap = `
(function () {
  try {
    var raw = localStorage.getItem('moai-theme');
    var theme = raw ? JSON.parse(raw)?.state?.theme : null;
    if (theme === 'dark') document.documentElement.classList.add('dark');
  } catch (_) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="bg-main text-main flex min-h-full flex-col">
        <ThemeProvider>
          <Web3Provider>
            <Navbar />
            {children}
          </Web3Provider>
        </ThemeProvider>
        <Toaster
          position="top-center"
          richColors={false}
          toastOptions={{
            style: {
              borderRadius: "16px",
              border: "1px solid var(--color-border-soft)",
              background: "var(--color-surface)",
              color: "var(--color-foreground)",
              boxShadow: "0 8px 24px rgba(255, 0, 122, 0.06)",
            },
            classNames: {
              title: "moai-toast-title",
              description: "moai-toast-description",
              actionButton: "moai-toast-action",
            },
          }}
        />
      </body>
    </html>
  );
}
