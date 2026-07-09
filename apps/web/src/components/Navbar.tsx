'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { Shirt, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const navClass = (active: boolean) =>
  cn(
    'h-9 rounded-none border-2 border-black px-3 text-[11px] font-black uppercase tracking-[0.14em] shadow-[3px_3px_0_rgb(0_0_0_/_0.18)]',
    active ? 'bg-[#241426] text-white hover:bg-[#241426]/95' : 'bg-white text-[#241426] hover:bg-[#DCE66E]'
  );

export default function Navbar() {
  const pathname = usePathname();
  return (
    <nav className="border-b-2 border-black bg-[#CBB7CF]">
      <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-4 px-4 py-4 lg:px-8">
        <Link href="/" className="inline-flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center border-2 border-black bg-[#DCE66E] text-[#241426] shadow-[3px_3px_0_rgb(0_0_0_/_0.18)]">
            <Shirt className="h-4 w-4" />
          </span>
          <span className="text-sm font-black uppercase tracking-[0.18em] text-[#241426]">Wardrobe</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className={navClass(pathname === '/')}>
            <Link href="/">
              <Shirt className="h-3.5 w-3.5" />
              <span>Rack</span>
            </Link>
          </Button>
          <SignedIn>
            <Button asChild variant="outline" className={navClass(pathname === '/profile')}>
              <Link href="/profile">
                <UserRound className="h-3.5 w-3.5" />
                <span>Profile</span>
              </Link>
            </Button>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" className={navClass(false)}>
                Sign in
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}
