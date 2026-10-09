import type { Metadata, Viewport } from "next";
import {
  ClerkProvider,
  SignedOut,
} from '@clerk/nextjs'
import { clerkAppearance } from "@/lib/clerk-appearance";
import Navbar from '@/components/Navbar';
import Providers from '@/components/Providers';
import HomeContinuity from '@/components/HomeContinuity';
import { Oswald, Space_Grotesk } from "next/font/google";
import "./globals.css";


const heading = Oswald({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "optional",
});

const body = Space_Grotesk({
  variable: "--font-body",
  subsets: ["latin"],
  display: "optional",
});

export const metadata: Metadata = {
  title: "Lint",
  applicationName: "Lint",
  appleWebApp: { capable: true, title: "Lint", statusBarStyle: "black-translucent" },
  description: "Closet manager and shopping companion.",
  verification: {
    // Public ownership proof for the Google project owner; not an API credential.
    google: "5YRcxZSQHTvgJOw1GuRRzPL5Qj1J7jWnzGSGrhs9Er8",
  },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#241426",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <ClerkProvider
      clerkJSVersion="5.127.0"
      appearance={clerkAppearance}
    >
      <html lang="en">
        <body className={`${heading.variable} ${body.variable} min-h-screen flex flex-col`}>
          <Providers>
            <Navbar />
            <HomeContinuity>{children}</HomeContinuity>
            <SignedOut>
              <footer className="mx-auto w-full max-w-[1320px] px-4 py-6 pb-28 text-sm md:pb-6">
                <a href="/privacy" className="underline">Privacy</a>
              </footer>
            </SignedOut>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
