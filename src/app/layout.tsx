import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ClipForge — AI Short-Form Clip Generator",
  description: "Extract viral highlight clips from YouTube long-form videos using AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-bg text-text min-h-screen`}
      >
        <header className="border-b border-border px-6 py-3 flex items-center gap-4">
          <a href="/" className="text-primary font-bold text-xl tracking-tight hover:text-primary-hover transition-colors">
            ClipForge
          </a>
          <span className="text-text-muted text-sm hidden sm:inline">AI Short-Form Generator</span>
          <div className="flex-1" />
          <a href="/projects" className="text-sm text-text-muted hover:text-primary transition-colors">
            Projects
          </a>
        </header>
        <main className="max-w-6xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
