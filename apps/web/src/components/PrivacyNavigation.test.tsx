import { afterEach, expect, mock, test } from 'bun:test';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import React from 'react';
import { clerkAppearance } from '../lib/clerk-appearance';
GlobalRegistrator.register();
const { render, screen, cleanup } = await import('@testing-library/react');
let signedIn = false;
let profileAppearance: unknown;
const UserButton = Object.assign(({ children, userProfileProps }: { children: React.ReactNode; userProfileProps: { appearance: unknown } }) => {
  profileAppearance = userProfileProps.appearance;
  return <div aria-label="Synthetic account menu">{children}</div>;
}, {
  MenuItems: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Link: ({ label, href }: { label: string; href: string }) => <a href={href}>{label}</a>,
});
mock.module('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: React.ReactNode }) => signedIn ? <>{children}</> : null,
  SignedOut: ({ children }: { children: React.ReactNode }) => signedIn ? null : <>{children}</>,
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  UserButton,
}));
mock.module('next/navigation', () => ({ usePathname: () => '/' }));
mock.module('next/image', () => ({ default: () => null }));
mock.module('next/font/google', () => ({ Oswald: () => ({variable:'heading'}), Space_Grotesk: () => ({variable:'body'}) }));
mock.module('./HomeContinuity', () => ({ default: ({children}: {children:React.ReactNode}) => <>{children}</> }));
mock.module('./Providers', () => ({ default: ({children}: {children:React.ReactNode}) => <>{children}</> }));
mock.module('./UnifiedCapture', () => ({ UnifiedCaptureController: ({children}: {children:React.ReactNode}) => <>{children}</>, UnifiedCaptureTrigger: () => null }));
const { default: Layout } = await import('../app/layout');
const { default: PrivacyPage } = await import('../app/privacy/page');
afterEach(() => { cleanup(); signedIn = false; });

test('signed-out entry retains public privacy access and sign-in privacy configuration', () => {
  render(<Layout><main>Public home</main></Layout>);
  expect(screen.getByRole('link', {name:'Privacy'}).getAttribute('href')).toBe('/privacy');
  expect(screen.getByRole('button', {name:'Sign in'})).toBeTruthy();
  expect(clerkAppearance.layout.privacyPageUrl).toBe('/privacy');
});
test('authenticated app moves Privacy to Account and preserves it after remount', () => {
  signedIn = true;
  const view = render(<Layout><main>Closet</main></Layout>);
  expect(document.querySelector('footer')).toBeNull();
  const link = screen.getByRole('link', {name:'Privacy'});
  expect(link.closest('[aria-label="Synthetic account menu"]')).toBeTruthy();
  expect(link.getAttribute('href')).toBe('/privacy');
  expect(profileAppearance).toBe(clerkAppearance);
  view.unmount();
  render(<Layout><main>Closet</main></Layout>);
  expect(screen.getByRole('link', {name:'Privacy'})).toBeTruthy();
});
test('privacy route is readable without an account and provides contact and return navigation', () => {
  render(<PrivacyPage />);
  expect(screen.getByRole('heading', {name:'Lint privacy'})).toBeTruthy();
  expect(screen.getByRole('link', {name:'Back to Lint'}).getAttribute('href')).toBe('/');
  expect(screen.getByRole('link', {name:'davidschmittgit@gmail.com'}).getAttribute('href')).toBe('mailto:davidschmittgit@gmail.com');
  expect(screen.queryByText(/disable optional analytics in the app privacy controls/i)).toBeNull();
});
