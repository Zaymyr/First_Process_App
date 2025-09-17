// src/app/layout.tsx
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

export const metadata = { title: "First Process App" };
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
