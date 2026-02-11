import type { Metadata } from "next";
import {
  ClerkProvider,
} from '@clerk/nextjs'
import Navbar from '@/components/Navbar';
import Providers from '@/components/Providers';
import { Oswald, Space_Grotesk } from "next/font/google";
import "./globals.css";


const heading = Oswald({
  variable: "--font-heading",
  subsets: ["latin"],
});

const body = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Wardrobe",
  description: "Closet manager and shopping companion.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${heading.variable} ${body.variable} min-h-screen flex flex-col`}>
          <Providers>
            <Navbar />
            {children}
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
