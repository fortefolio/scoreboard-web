import type { Metadata } from "next";
import { Manrope, Inter, Space_Grotesk } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "@/components/AuthProvider";
import TopNavBar from "@/components/TopNavBar";
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
  metadataBase: new URL('https://score-board.net.com'),
  title: {
    default: 'ScoreBoard',
    template: '%s | ScoreBoard',
  },
  description: "DON'T JUST FOLLOW. BE PART OF THE GAME.",
  openGraph: {
    type: 'website',
    siteName: 'ScoreBoard',
    images: [{
      url: '/og-default.png',
      width: 1200,
      height: 630,
      alt: 'ScoreBoard - Social live scoring platform',
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ScoreBoard',
    description: "DON'T JUST FOLLOW. BE PART OF THE GAME.",
  },
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
        <AuthProvider initialUser={null}>
          <Suspense fallback={<nav className="fixed top-0 w-full h-20 bg-slate-950/40 backdrop-blur-xl z-50 border-b border-white/5" />}>
            <TopNavBar />
          </Suspense>
          {children}
          <Toaster richColors position="bottom-right" closeButton />
        </AuthProvider>
      </body>
    </html>
  );
}
