import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Renova",
  description: "A private, local-first personal workspace.",
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
      </head>
      <body>{children}</body>
    </html>
  );
}
