import type { Metadata } from "next";
import { Manrope, Inter, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import AuthListener from "@/components/AuthListener";
import TopNavBar from "@/components/TopNavBar";
import { Toaster } from "sonner";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-headline",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-label",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SCORE:BOARD | Don't just play. Be heard.",
  description: "The first tournament platform where every point is a post.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${inter.variable} ${spaceGrotesk.variable} h-full antialiased dark`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col bg-background text-on-background pt-20">
        <AuthListener />
        <Suspense fallback={<nav className="fixed top-0 w-full h-20 bg-slate-950/40 backdrop-blur-xl z-50 border-b border-white/5" />}>
          <TopNavBar />
        </Suspense>
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
