import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Synapse",
    short_name: "Synapse",
    description: "Documentation infirmière — hospitalisation à domicile psychiatrique",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f3f0",
    theme_color: "#1e4d6b",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
