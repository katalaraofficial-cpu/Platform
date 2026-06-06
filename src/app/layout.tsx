import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });
const ICON_VERSION = "20260606";

export const metadata: Metadata = {
  title: "POS Workshop",
  description: "Sistem POS dan Manajemen Bengkel",
  manifest: "/manifest.webmanifest",
  applicationName: "Katalara POS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Katalara POS",
  },
  icons: {
    icon: [
      { url: `/icon-192?v=${ICON_VERSION}` },
      { url: `/icon-512?v=${ICON_VERSION}` },
    ],
    shortcut: [{ url: `/icon-192?v=${ICON_VERSION}` }],
    apple: [{ url: `/apple-icon?v=${ICON_VERSION}` }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0f172a",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={inter.className}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  );
}
