import type { Metadata, Viewport } from "next";
import PwaClient from './pwa-client';

export const metadata: Metadata = {
  title: "Renova",
  description: "A private, local-first personal workspace.",
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'Renova' },
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, viewportFit: 'cover',
  themeColor: '#fbf7fa',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="/styles.css" />
        <link rel="stylesheet" href="/mobile.css" />
        <link rel="stylesheet" href="/light-theme.css" />
        <link rel="stylesheet" href="/workspace-features.css" />
        <link rel="stylesheet" href="/design.css" />
        <link rel="stylesheet" href="/soft-ui.css" />
        <link rel="stylesheet" href="/mobile-ui.css" />
        <link rel="stylesheet" href="/assistant-menu.css" />
        <link rel="stylesheet" href="/dark-theme.css" />
      </head>
      <body>{children}<PwaClient /></body>
    </html>
  );
}
