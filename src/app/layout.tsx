import type { Metadata } from "next";
import {
  ClerkProvider,
} from '@clerk/nextjs'
import { currentUser } from '@clerk/nextjs/server';
import { ZepService } from '@/services/ZepService';
import { DatabaseService } from '@/services/DatabaseService';
import { AppLive } from '@/services';
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
    const program = Effect.gen(function* () {
      const dbService = yield* DatabaseService;
      const profile = yield* dbService.getProfile(user.id);

      // Only create Zep user if not already synced
      if (!profile?.zepSynced) {
        const name = `${user.firstName || ""} ${user.lastName || ""}`.trim();
        const email = user.emailAddresses[0]?.emailAddress;

        yield* ZepService.createUser(user.id, email, name);
        yield* dbService.markZepSynced(user.id);
        yield* Effect.logInfo(`Zep user initialized for ${user.id}`);
      }
    });

    await Effect.runPromise(
      program.pipe(
        Effect.provide(AppLive),
        Effect.catchAll((e) => Effect.logError(`Layout Zep Error: ${String(e)}`))
      )
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
