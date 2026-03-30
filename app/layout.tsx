import type { Metadata } from "next";
import { Manrope, Inter, Space_Grotesk } from "next/font/google";
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
        <TopNavBar />
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}

