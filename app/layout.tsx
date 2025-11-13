import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Zahnarzt Voice Agent",
  description: "Sprachassistent f?r Zahnarztpraxis ? Termine, Fragen, Weiterleitung"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de">
      <body style={{ fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif', color: '#0f172a' }}>
        {children}
      </body>
    </html>
  );
}
