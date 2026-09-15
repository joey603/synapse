import type { Metadata, Viewport } from "next";
import { Heebo } from "next/font/google";
import { cookies } from "next/headers";

import { assertNoPublicSecrets } from "@/lib/env";
import { directionFor, resolveLocale } from "@/lib/i18n/locale";

import "./globals.css";

const heebo = Heebo({
  subsets: ["latin", "hebrew"],
  variable: "--font-heebo",
});

export const metadata: Metadata = {
  title: "Synapse",
  description: "Documentation infirmière — hospitalisation à domicile psychiatrique",
  applicationName: "Synapse",
  appleWebApp: {
    capable: true,
    title: "Synapse",
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ef" },
    { media: "(prefers-color-scheme: dark)", color: "#1e4d6b" },
  ],
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  assertNoPublicSecrets();

  const store = await cookies();
  const locale = resolveLocale(store.get("synapse_locale")?.value);

  return (
    <html lang={locale} dir={directionFor(locale)} className={`${heebo.variable} h-full`}>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}
