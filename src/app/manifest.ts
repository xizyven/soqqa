import type { MetadataRoute } from "next";
import { withBase } from "@/lib/env";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: withBase("/"),
    name: "Soqqa — shaxsiy moliya",
    short_name: "Soqqa",
    description: "Shaxsiy moliya: xarajatlar, byudjet, jamg'arma va AI maslahatchi. Oflayn ishlaydi.",
    start_url: withBase("/"),
    scope: withBase("/"),
    display: "standalone",
    orientation: "portrait",
    background_color: "#05112B",
    theme_color: "#05112B",
    lang: "uz",
    categories: ["finance", "productivity"],
    icons: [
      { src: withBase("/icons/icon-192.png"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: withBase("/icons/icon-512.png"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: withBase("/icons/maskable-512.png"), sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: withBase("/icons/icon.svg"), sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Yangi xarajat", url: withBase("/?add=expense"), icons: [{ src: withBase("/icons/icon-192.png"), sizes: "192x192" }] },
      { name: "Tranzaksiyalar", url: withBase("/transactions") },
    ],
  };
}
