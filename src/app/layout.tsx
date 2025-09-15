// src/app/layout.tsx
import "./globals.css";
import AppHeader from "@/components/AppHeader";
import Toaster from "@/components/Toaster";

export const metadata = { title: "First Process App" };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <div className="site-header">
          <div className="container inner"><AppHeader /></div>
        </div>
        <main>
          <div className="container">{children}</div>
        </main>
        <Toaster />
      </body>
    </html>
  );
}
