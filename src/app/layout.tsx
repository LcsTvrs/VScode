import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Uniformes | Gestão de loja",
  description: "Gestão de estoque e solicitações de uniformes da loja.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
