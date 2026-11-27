import type { Metadata } from "next";
import localFont from "next/font/local";
import type { ReactNode } from "react";
import "./globals.css";

const inter = localFont({
  src: "../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: { default: "SiteGate", template: "%s | SiteGate" },
  description: "Manage workers, site access, and audit activity.",
  icons: { icon: { url: "/sitegate-shield.png", type: "image/png" } },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
