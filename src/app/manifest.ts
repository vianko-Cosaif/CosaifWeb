import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "COSAIF Logistics",
    short_name: "COSAIF",
    description: "Operacion ferroviaria para movimientos, incidentes, rondas y reporteria.",
    id: "/?source=pwa",
    start_url: "/login?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "minimal-ui", "browser"],
    background_color: "#f8fafc",
    theme_color: "#0f172a",
    lang: "es-MX",
    dir: "ltr",
    orientation: "any",
    categories: ["business", "productivity"],
    prefer_related_applications: false,
    launch_handler: {
      client_mode: ["focus-existing", "navigate-existing"],
    },
    icons: [
      {
        src: "/icons/cosaif-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/cosaif-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/cosaif-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/cosaif-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
