'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SignInButton, SignedIn, SignedOut } from '@clerk/nextjs';
import { Layers3, Sparkles, Shirt, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UnifiedCaptureController, UnifiedCaptureTrigger } from '@/components/UnifiedCapture';
import { cn } from '@/lib/utils';

const navClass = (active: boolean) =>
  cn(
    'min-h-11 rounded-none border border-[var(--rack-line)] px-3 text-xs font-semibold shadow-[2px_2px_0_var(--rack-panel-shadow)]',
    active ? 'bg-[#241426] text-white hover:bg-[#241426]/95' : 'bg-white text-[#241426] hover:bg-[#DCE66E]'
  );

const mobileNavClass = (active: boolean) =>
  cn(
    'flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 px-1 text-[0.68rem] font-bold transition-colors',
    active ? 'bg-[var(--rack-action)] text-[var(--rack-ink)]' : 'text-[var(--rack-ink-soft)] hover:bg-white'
  );

const signedInLinks = [
  { href: '/', label: 'Rack', icon: Shirt },
  { href: '/fits', label: 'Fits', icon: Sparkles },
  { href: '/wardrobes', label: 'Wardrobes', icon: Layers3 },
  { href: '/profile', label: 'Profile', icon: UserRound },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  return (
    <>
      <UnifiedCaptureController />
      <nav className="sticky top-0 z-40 border-b border-[var(--rack-line)] bg-[#D8C9DC]/95 backdrop-blur-sm">
        <div className="mx-auto flex min-h-16 w-full max-w-[1320px] items-center justify-between gap-4 px-4 py-2 lg:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center gap-2" aria-label="Wardrobe home">
            <span className="grid h-10 w-10 place-items-center border border-[var(--rack-line)] bg-[#DCE66E] text-[#241426] shadow-[2px_2px_0_var(--rack-panel-shadow)]">
              <Shirt className="h-4 w-4" />
            </span>
            <span className="text-sm font-extrabold text-[#241426]">Wardrobe</span>
          </Link>

          <div className="hidden items-center justify-end gap-2 md:flex">
            <Button asChild variant="outline" className={navClass(pathname === '/')}>
              <Link href="/">
                <Shirt className="h-3.5 w-3.5" />
                <span>Rack</span>
              </Link>
            </Button>
            <SignedIn>
              <UnifiedCaptureTrigger variant="desktop" />
              {signedInLinks.slice(1).map(({ href, label, icon: Icon }) => (
                <Button key={href} asChild variant="outline" className={navClass(pathname === href)}>
                  <Link href={href}>
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span>
                  </Link>
                </Button>
              ))}
            </SignedIn>
          </div>

          <SignedOut>
            <SignInButton mode="modal">
              <Button variant="outline" className={navClass(false)}>
                Sign in
              </Button>
            </SignInButton>
          </SignedOut>
        </div>
      </nav>

      <SignedIn>
        <nav
          className="rack-mobile-tabs fixed inset-x-0 bottom-0 z-50 border-t border-[var(--rack-line)] bg-[var(--rack-paper)]/95 backdrop-blur-sm md:hidden"
          aria-label="Primary navigation"
        >
          <div className="rack-mobile-tabs-inner mx-auto max-w-md">
            {signedInLinks.slice(0, 2).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={mobileNavClass(pathname === href)} aria-current={pathname === href ? 'page' : undefined}>
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            ))}
            <div className="flex items-start justify-center">
              <UnifiedCaptureTrigger variant="mobile" />
            </div>
            {signedInLinks.slice(2).map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className={mobileNavClass(pathname === href)} aria-current={pathname === href ? 'page' : undefined}>
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </Link>
            ))}
          </div>
        </nav>
      </SignedIn>
    </>
  );
}
