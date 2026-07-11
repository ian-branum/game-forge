import type { Metadata } from "next";
import { Orbitron } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "700", "900"],
});

export const metadata: Metadata = {
  title: "Game Forge",
  description: "Describe a battle. Play it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${orbitron.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#05071a] text-white">
        <Providers>
          <Nav />
          {children}
        </Providers>
      </body>
    </html>
  );
}
