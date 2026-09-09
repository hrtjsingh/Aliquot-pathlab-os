import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Aliquot",
    short_name: "Aliquot",
    description: "Generate, authorize, and release diagnostic lab reports.",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#F4F6F7",
    theme_color: "#1C3F52",
    lang: "en",
    orientation: "any",
    icons: [
      {
        src: "/icon.svg",
        type: "image/svg+xml",
        sizes: "any",
        purpose: "any",
      },
      {
        src: "/pwa-icon/192",
        type: "image/png",
        sizes: "192x192",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        type: "image/png",
        sizes: "512x512",
        purpose: "any",
      },
      {
        src: "/pwa-icon/512",
        type: "image/png",
        sizes: "512x512",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      { name: "Worklist", short_name: "Worklist", url: "/worklist" },
      { name: "New order", short_name: "Order", url: "/orders/new" },
      { name: "Patients", short_name: "Patients", url: "/patients" },
    ],
  };
}
