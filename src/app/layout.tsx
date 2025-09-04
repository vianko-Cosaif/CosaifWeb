// src/app/layout.tsx
import "./globals.css";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { initThemeSSRScript } from "@/lib/theme";

export const metadata: Metadata = {
  title: "Cosaif Logistics",
  description: "Operación ferroviaria sin fricción",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
    { color: "#ffffff" },
  ],
};

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        {/* Evita FOUC de tema antes de hidratar */}
        <script dangerouslySetInnerHTML={{ __html: initThemeSSRScript() }} />
      </head>
      <body className="min-h-svh bg-white text-slate-900 antialiased selection:bg-sky-200/60 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-sky-600/40">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
        >
          Saltar al contenido
        </a>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
