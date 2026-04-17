import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";

export const viewport: Viewport = {
  themeColor: "#0A0A0F",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Jarvis Mission Control",
  description: "Playfish Universal AI Agent Orchestration Platform",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Jarvis",
  },
  icons: {
    apple: "/icon-192.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Jarvis" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <link rel="manifest" href="/manifest.webmanifest" />
      </head>
      <body className="bg-[#0A0A0F] text-white antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Desktop Sidebar */}
          <Sidebar />

          {/* Main Content */}
          <main className="flex-1 overflow-y-auto">
            {children}
          </main>
        </div>

        {/* Mobile Bottom Nav */}
        <MobileNav />
      </body>
    </html>
  );
}
