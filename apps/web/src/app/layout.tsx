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
    <ClerkProvider
      clerkJSVersion="5.127.0"
      appearance={{
        variables: {
          colorPrimary: "#241426",
          colorBackground: "#D8C9DC",
          colorInputBackground: "#ffffff",
          colorText: "#241426",
          colorNeutral: "#D8C9DC",
          borderRadius: "0px",
          fontFamily: "var(--font-body)",
        },
        elements: {
          modalBackdrop: "bg-black/60",
          modalContent: "rounded-none border border-[var(--rack-line)] shadow-[3px_3px_0_var(--rack-panel-shadow)]",
          card: "rounded-none border border-[var(--rack-line)] shadow-none",
          formFieldInput: "rounded-none border border-[var(--rack-line)] shadow-none",
          formButtonPrimary:
            "rounded-none border border-[var(--rack-line)] bg-[#DCE66E] text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]",
          footer: "hidden",
        },
      }}
    >
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
