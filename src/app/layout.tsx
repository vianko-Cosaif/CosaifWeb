import "antd/dist/reset.css";
import "./globals.scss";
import type { Metadata, Viewport } from "next";
import { initThemeSSRScript } from "@/lib/theme";
import AdaptiveMode from "@/app/Components/layout/AdaptiveMode";
import PwaInstallPrompt from "@/app/Components/layout/PwaInstallPrompt";
import FirebaseNotificationPrompt from "@/app/Components/layout/FirebaseNotificationPrompt";
import { ClientMovementGuideProvider } from "@/app/Components/GuidedManualAtom/ClientMovementGuide";

export const metadata: Metadata = {
  title: {
    default: "Cosaif",
    template: "%s | Cosaif",
  },
  description: "Operaci�n ferroviaria sin fricci�n",
  applicationName: "Cosaif",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cosaif",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/cosaif-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/cosaif-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-title": "COSAIF",
    "apple-mobile-web-app-status-bar-style": "default",
    "msapplication-TileColor": "#0f172a",
    "msapplication-TileImage": "/icons/cosaif-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0B1220" },
    { color: "#f8fafc" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX">
      <head>
        <script dangerouslySetInnerHTML={{ __html: initThemeSSRScript() }} />
      </head>
      <body className="min-h-svh bg-white text-slate-900 antialiased selection:bg-sky-200/60 dark:bg-slate-950 dark:text-slate-100 dark:selection:bg-sky-600/40">
        <ClientMovementGuideProvider>
          <AdaptiveMode />
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow"
          >
            Saltar al contenido
          </a>

          <main id="main">{children}</main>
          <FirebaseNotificationPrompt />
          <PwaInstallPrompt />
        </ClientMovementGuideProvider>
      </body>
    </html>
  );
}