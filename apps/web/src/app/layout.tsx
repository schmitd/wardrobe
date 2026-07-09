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
          colorPrimary: "#310A31",
          colorBackground: "#B5CEDE",
          colorInputBackground: "#ffffff",
          colorText: "#310A31",
          colorNeutral: "#96CFB7",
          borderRadius: "0px",
          fontFamily: "var(--font-body)",
        },
        elements: {
          modalBackdrop: "bg-black/60",
          modalContent: "rounded-none border-2 border-black shadow-[5px_5px_0_rgb(0_0_0_/_0.18)]",
          card: "rounded-none border-2 border-black shadow-none",
          formFieldInput: "rounded-none border-2 border-black shadow-none",
          formButtonPrimary:
            "rounded-none border-2 border-black bg-[#EAC99A] text-[#310A31] shadow-[3px_3px_0_rgb(0_0_0_/_0.18)]",
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
