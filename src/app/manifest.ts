import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Soqqa — shaxsiy moliya",
    short_name: "Soqqa",
    description: "Shaxsiy moliya: xarajatlar, byudjet, jamg'arma va AI maslahatchi. Oflayn ishlaydi.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#05112B",
    theme_color: "#05112B",
    lang: "uz",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [
      { name: "Yangi xarajat", url: "/?add=expense", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Tranzaksiyalar", url: "/transactions" },
    ],
  };
}
