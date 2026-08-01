import type { Appearance } from "@clerk/types";

/**
 * How Clerk's own UI is styled to match the app.
 *
 * Applied once on `<ClerkProvider>`, so it covers every Clerk surface together:
 * the sign-in and sign-up pages, the navbar's sign-in and sign-up modals, and
 * `UserButton`. Before this, all of them rendered Clerk's default light styling,
 * which against the app's dark theme read as broken rather than merely
 * unstyled.
 *
 * Deliberately `elements` with Tailwind classes rather than `variables` with
 * colour values. Two reasons:
 *
 * - Clerk derives hover, focus and alpha shades from a colour it is given, and
 *   it cannot compute those from a `hsl(var(--primary))` reference — the
 *   variables route yields correct base colours and broken intermediate states.
 * - Tailwind classes resolve against the same custom properties and cascade
 *   normally, so dark mode follows automatically from the `.dark` block in
 *   globals.css. That matters here because `ClerkProvider` sits *above*
 *   `ThemeProvider` in the tree, so `useTheme()` is not available at the point
 *   this object is defined; anything theme-aware in React would have required
 *   restructuring the providers.
 */
export const clerkAppearance: Appearance = {
  layout: {
    // The app already states its terms elsewhere; Clerk's own footer branding
    // adds a second, conflicting voice on the page.
    logoPlacement: "none",
    socialButtonsVariant: "blockButton",
  },
  elements: {
    // The page supplies its own card, so Clerk's would nest one inside another.
    rootBox: "w-full",
    cardBox: "w-full shadow-none border-none",
    card: "w-full bg-transparent shadow-none border-none p-0",

    header: "text-left",
    headerTitle: "text-xl font-semibold tracking-tight text-foreground",
    headerSubtitle: "text-sm text-muted-foreground",

    socialButtonsBlockButton:
      "border border-border bg-background text-foreground hover:bg-muted transition-colors",
    socialButtonsBlockButtonText: "text-sm font-medium text-foreground",

    dividerLine: "bg-border",
    dividerText: "text-xs text-muted-foreground",

    formFieldLabel: "text-sm font-medium text-foreground",
    formFieldInput:
      "border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
    formFieldInputShowPasswordButton:
      "text-muted-foreground hover:text-foreground",

    formButtonPrimary:
      "bg-primary text-primary-foreground hover:opacity-90 transition-opacity normal-case text-sm font-medium shadow-none",

    footer: "bg-transparent",
    footerActionText: "text-sm text-muted-foreground",
    footerActionLink:
      "text-sm font-medium text-primary underline-offset-4 hover:underline",

    identityPreviewText: "text-foreground",
    identityPreviewEditButton: "text-primary",

    formResendCodeLink: "text-primary",
    otpCodeFieldInput: "border border-input bg-background text-foreground",

    // UserButton, which appears on every signed-in page.
    userButtonPopoverCard:
      "bg-popover text-popover-foreground border border-border shadow-lg",
    userButtonPopoverActionButton:
      "text-foreground hover:bg-muted transition-colors",
    userButtonPopoverActionButtonText: "text-sm text-foreground",
    userButtonPopoverFooter: "hidden",

    // The modal opened by SignInButton / SignUpButton in the navbar.
    modalBackdrop: "bg-black/50 backdrop-blur-sm",
    modalContent: "bg-card text-card-foreground rounded-2xl border border-border",
  },
};
