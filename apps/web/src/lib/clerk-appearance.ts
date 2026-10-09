import type { ClerkProvider } from '@clerk/nextjs';
import type { ComponentProps } from 'react';

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>;

// Explicit foreground colors avoid Clerk's translucent neutral scale making
// enabled menu labels/icons look disabled against Lint's lavender background.
export const clerkColors = {
  ink: '#241426', secondary: '#56345C', lavender: '#D8C9DC',
  paper: '#FFFFFF', hover: '#F4EFF6', lime: '#DCE66E',
  danger: '#8A1738', success: '#245431', warning: '#70420D',
} as const;
const c = clerkColors;
const focus = { outline: `2px solid ${c.ink}`, outlineOffset: '3px', boxShadow: 'none' };
const action = {
  color: c.ink, backgroundColor: 'transparent', borderRadius: '0',
  '&:hover': { backgroundColor: c.hover, color: c.ink },
  '&:focus-visible': focus,
};
export const clerkAppearance = {
  layout: { privacyPageUrl: '/privacy' },
  variables: {
    colorPrimary: c.ink, colorPrimaryForeground: c.paper,
    colorBackground: c.lavender, colorForeground: c.ink,
    colorMuted: c.hover, colorMutedForeground: c.secondary,
    colorNeutral: c.ink, colorInput: c.paper, colorInputForeground: c.ink,
    colorDanger: c.danger, colorSuccess: c.success, colorWarning: c.warning,
    borderRadius: '0px', fontFamily: 'var(--font-body)',
  },
  elements: {
    modalBackdrop: { backgroundColor: '#00000099' },
    modalContent: { borderRadius: '0', border: `1px solid ${c.ink}` },
    card: { borderRadius: '0', border: `1px solid ${c.ink}`, boxShadow: 'none' },
    headerTitle: { color: c.ink, fontWeight: '800' },
    headerSubtitle: { color: c.secondary },
    socialButtonsBlockButton: { ...action, backgroundColor: c.paper, border: `1px solid ${c.ink}` },
    socialButtonsBlockButtonText: { color: c.ink, fontWeight: '700' },
    dividerLine: { backgroundColor: c.secondary },
    dividerText: { color: c.secondary },
    formFieldInput: {
      color: c.ink, backgroundColor: c.paper, border: `1px solid ${c.ink}`, borderRadius: '0',
      '&::placeholder': { color: c.secondary, opacity: 1 },
      '&:focus-visible': focus,
      '&:disabled': { color: c.secondary, backgroundColor: c.hover, opacity: 1 },
      '&[aria-invalid="true"]': { borderColor: c.danger },
    },
    formFieldLabel: { color: c.ink, fontWeight: '600' },
    formFieldAction: { ...action, fontWeight: '600' },
    formFieldErrorText: { color: c.danger },
    alertText: { color: c.ink },
    formButtonPrimary: {
      ...action, backgroundColor: c.lime, color: c.ink, border: `1px solid ${c.ink}`,
      '&:hover': { backgroundColor: c.lime, color: c.ink },
      '&:disabled': { color: c.secondary, backgroundColor: c.hover, opacity: 1 },
    },
    formButtonPrimaryIcon: { color: 'currentColor' },
    footerActionText: { color: c.secondary },
    footerActionLink: { ...action, fontWeight: '700' },
    footerPagesLink: { ...action, textDecoration: 'underline' },
    otpCodeFieldInput: { color: c.ink, backgroundColor: c.paper, border: `1px solid ${c.ink}`, '&:focus-visible': focus },
    formResendCodeLink: { ...action, fontWeight: '700' },
    identityPreviewText: { color: c.ink },
    userButtonTrigger: { '&:focus-visible': focus },
    userButtonPopoverCard: { color: c.ink, backgroundColor: c.lavender, borderRadius: '0', border: `1px solid ${c.ink}` },
    userButtonPopoverActionButton: action,
    userButtonPopoverActionButtonText: { color: c.ink },
    userButtonPopoverActionButtonIcon: { color: c.ink, opacity: 1 },
    userButtonPopoverFooter: { color: c.secondary },
    userPreviewMainIdentifier: { color: c.ink },
    userPreviewSecondaryIdentifier: { color: c.secondary },
    navbarButton: action,
    navbarButtonText: { color: c.ink },
    navbarButtonIcon: { color: c.ink, opacity: 1 },
    profileSectionPrimaryButton: action,
    profileSectionTitleText: { color: c.ink },
    profileSectionSubtitleText: { color: c.secondary },
  },
} satisfies Appearance;
