import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Cash Flow Dashboard",
  description: "Actual Budget cash flow analysis",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&display=swap"/>
      </head>
      <body>{children}</body>
    </html>
  );
}
