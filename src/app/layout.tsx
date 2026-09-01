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
      appearance={{
        variables: {
          colorPrimary: "#310A31",
          colorBackground: "#f6f1f8",
          colorInputBackground: "#ffffff",
          colorText: "#1A1020",
          colorTextSecondary: "#4E1E51",
          colorNeutral: "#4E1E51",
          borderRadius: "0px",
          fontFamily: "var(--font-body)",
        },
        elements: {
          modalBackdrop: "bg-black/60",
          modalContent: "rounded-none border-4 border-black shadow-[10px_10px_0_#000]",
          card: "rounded-none border-2 border-black shadow-none",
          headerTitle: "text-[#1A1020]",
          headerSubtitle: "text-[#4E1E51]",
          socialButtonsBlockButton:
            "rounded-none border-2 border-black bg-white text-[#1A1020] shadow-[3px_3px_0_#000] hover:bg-[#f1e9f5]",
          socialButtonsBlockButtonText: "text-[#1A1020] font-bold",
          dividerLine: "bg-[#4E1E51]",
          dividerText: "text-[#4E1E51] font-medium",
          formFieldLabel: "text-[#1A1020] font-bold",
          formFieldInput:
            "rounded-none border-2 border-black bg-white text-[#1A1020] shadow-none placeholder:text-[#5F5268]",
          formButtonPrimary:
            "rounded-none border-2 border-black bg-[#310A31] text-white shadow-[3px_3px_0_#000]",
          formButtonPrimaryIcon: "text-white",
          footerActionText: "text-[#4E1E51]",
          footerActionLink: "text-[#1A1020] font-bold",
          otpCodeFieldInput: "border-2 border-black text-[#1A1020]",
          formResendCodeLink: "text-[#1A1020] font-bold",
          identityPreviewText: "text-[#1A1020]",
          formFieldAction: "text-[#1A1020] font-bold",
          developmentModeText: "text-[#8A2E00] font-bold",
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
