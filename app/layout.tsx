import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "The Austin Amp — Live Music Newsletter",
  description:
    "Your weekly amalgamation of Austin music news, articles, concerts, and free shows — pulled live from the city's best sources.",
  openGraph: {
    title: "The Austin Amp — Live Music Newsletter",
    description:
      "Austin music news, concerts, and free shows in one weekly read.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
