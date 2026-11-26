import "./globals.css";
import type { Metadata, Viewport } from "next";

export const metadata: Metadata = { title: "Agendamento", description: "Agende seu horário online" };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@700;900&family=Fraunces:opsz,wght@9..144,600;9..144,900&family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;500;600&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
