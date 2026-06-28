import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DinnerOS — AI Dinner Decisions",
  description: "Stop asking what to eat. Let AI decide.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-swiggy-light-gray min-h-screen">{children}</body>
    </html>
  );
}
