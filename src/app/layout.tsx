import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

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
      { url: "/icon-192" },
      { url: "/icon-512" },
    ],
    apple: [{ url: "/apple-icon" }],
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
