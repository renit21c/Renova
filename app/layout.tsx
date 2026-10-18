import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Renova",
  description: "A private, local-first personal workspace.",
  icons: {
    icon: "/favicon.png",
    shortcut: "/favicon.png",
    apple: "/favicon.png",
  },
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
      </head>
      <body>{children}</body>
    </html>
  );
}
