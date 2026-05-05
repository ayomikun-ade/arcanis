import type { Metadata, Viewport } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";

import { Providers } from "./providers";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

const SITE_URL = "https://arcaniss.vercel.app";
const TITLE = "Arcanis — End-to-end encrypted messaging";
const DESCRIPTION =
  "A zero-knowledge messenger. Your messages are encrypted on your device — the server only ever sees ciphertext.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s · Arcanis",
  },
  description: DESCRIPTION,
  applicationName: "Arcanis",
  keywords: [
    "end-to-end encryption",
    "e2ee",
    "encrypted messaging",
    "zero-knowledge",
    "web crypto",
    "RSA-OAEP",
    "AES-GCM",
    "secure chat",
  ],
  authors: [{ name: "Ayomikun" }],
  creator: "Ayomikun",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Arcanis",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f2e9" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1d22" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
