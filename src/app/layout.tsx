// src/app/layout.tsx
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import Toaster from "@/components/Toaster";

export const metadata = { title: "First Process App" };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "ui-sans-serif,system-ui" }}>
        <AppHeader />
        <main style={{ padding: 16 }}>{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
