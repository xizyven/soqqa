import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/providers/app-provider";

export const metadata: Metadata = {
  title: { default: "Soqqa — shaxsiy moliya", template: "%s · Soqqa" },
  description: "Daromad va xarajatlarni kuzatish, byudjet, jamg'arma maqsadlari va AI maslahatchi. Oflayn ishlaydi.",
  applicationName: "Soqqa",
  appleWebApp: { capable: true, title: "Soqqa", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192" }], apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#071330",
};

// Applies the stored theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem('soqqa-theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="antialiased">
        <AppProvider>{children}</AppProvider>
      </body>
    </html>
  );
}
