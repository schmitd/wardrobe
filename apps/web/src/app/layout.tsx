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
          colorTextSecondary: "#56345C",
          colorNeutral: "#56345C",
          borderRadius: "0px",
          fontFamily: "var(--font-body)",
        },
        elements: {
          modalBackdrop: "bg-black/60",
          modalContent: "rounded-none border border-[var(--rack-line)] shadow-[3px_3px_0_var(--rack-panel-shadow)]",
          card: "rounded-none border border-[var(--rack-line)] shadow-none",
          headerTitle: "text-[#241426] font-extrabold",
          headerSubtitle: "text-[#56345C]",
          socialButtonsBlockButton: "rounded-none border border-[#241426] bg-white text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]",
          socialButtonsBlockButtonText: "text-[#241426] font-bold",
          dividerLine: "bg-[#8D7692]",
          dividerText: "text-[#56345C]",
          formFieldInput: "rounded-none border border-[#241426] bg-white text-[#241426] shadow-none placeholder:text-[#6E5A73]",
          formFieldLabel: "text-sm font-semibold text-[#241426]",
          formFieldAction: "text-sm font-semibold text-[#56345c] hover:text-[#241426]",
          formButtonPrimary:
            "rounded-none border border-[var(--rack-line)] bg-[#DCE66E] text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]",
          formButtonPrimaryIcon: "text-[#241426]",
          footerActionText: "text-[#56345C]",
          footerActionLink: "font-bold text-[#241426] hover:text-[#56345C]",
          otpCodeFieldInput: "border-[#241426] bg-white text-[#241426]",
          formResendCodeLink: "font-bold text-[#241426]",
          identityPreviewText: "text-[#241426]",
          userButtonPopoverCard: "rounded-none border border-[var(--rack-line)] shadow-[3px_3px_0_var(--rack-panel-shadow)]",
          userButtonPopoverActionButton: "rounded-none text-[#241426] hover:bg-[#f4eff6]",
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
