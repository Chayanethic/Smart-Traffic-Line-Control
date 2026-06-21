import type { Metadata } from "next";
import "./globals.css";
import { TrafficProvider } from "@/components/traffic-provider";
import { AppShell } from "@/components/app-shell";

export const metadata: Metadata = {
  title: "STCS — Smart Traffic Control",
  description: "Real-time intelligent traffic signal management platform",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <TrafficProvider><AppShell>{children}</AppShell></TrafficProvider>
      </body>
    </html>
  );
}
