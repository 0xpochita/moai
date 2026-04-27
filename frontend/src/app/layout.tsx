import type { Metadata } from "next";
import { Toaster } from "sonner";
import { Navbar } from "@/components/layout";
import { Web3Provider } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moai",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="bg-main text-main flex min-h-full flex-col">
        <Web3Provider>
          <Navbar />
          {children}
        </Web3Provider>
        <Toaster
          position="top-center"
          theme="light"
          richColors={false}
          toastOptions={{
            style: {
              borderRadius: "16px",
              border: "1px solid var(--color-border-soft)",
              background: "var(--color-surface)",
              color: "var(--color-foreground)",
              boxShadow: "0 8px 24px rgba(255, 0, 122, 0.06)",
            },
          }}
        />
      </body>
    </html>
  );
}
