import type { Metadata } from "next";
import {
  ClerkProvider,
} from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server';
import { ZepService } from '@/services/ZepService';
import { Effect } from 'effect';
import Navbar from '@/components/Navbar';
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
  title: "Virtual Wardrobe Stylist",
  description: "Wardrobe stylist and compatibility checker.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await currentUser();

  if (user) {
    // Ensure Zep user exists (fire and forget pattern or await if critical)
    // We await it to ensure it's done before rendering might rely on it, 
    // but we catch errors to not break the app.
    const name = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    const email = user.emailAddresses[0]?.emailAddress;

    // We can run this without awaiting to speed up response, 
    // but 'ensure' implies we want it there. 
    // Given the ZepService swallows errors, this is safe.
    await Effect.runPromise(
      ZepService.createUser(user.id, email, name)
    );
  }

  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col`}>
          <Navbar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
