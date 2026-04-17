import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Jarvis Mission Control",
    short_name: "Jarvis",
    description: "Playfish Universal AI Agent Orchestration Platform",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0A0A0F",
    theme_color: "#0A0A0F",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
