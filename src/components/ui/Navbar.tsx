"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ModeToggle } from "./ModeToggle";
import { CodeIcon } from "lucide-react";
import {
  SignInButton,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
} from "@clerk/nextjs";
import { Button } from "./button";
import { cn } from "@/lib/utils";
import DasboardBtn from "./DasboardBtn";
import NotificationBell from "./NotificationBell";

/**
 * Links every signed-in user can reach, whatever their role. Without these the
 * navbar was logo + avatar only, so a new candidate — who has no dashboard button
 * and no interviews — had no way to discover anything beyond the home page.
 */
const APP_LINKS = [
  { href: "/practice", label: "Practice" },
  { href: "/calendar", label: "Calendar" },
  { href: "/settings", label: "Settings" },
];

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };

    // Initialize state on mount
    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className={`sticky top-0 z-50 transition-all duration-300 pointer-events-none flex justify-center ${
        isScrolled ? "pt-4 px-4" : "pt-0 px-0"
      }`}>
      <nav
        className={`pointer-events-auto w-full transition-all duration-300 ${
          isScrolled
            ? "max-w-5xl rounded-full border border-border/50 bg-background/80 shadow-lg backdrop-blur-md"
            : "border-b bg-background"
        }`}>
        <div
          className={`flex items-center mx-auto transition-all duration-300 ${
            isScrolled ? "h-14 px-3" : "h-16 px-4 container"
          }`}>
          <Link
            href="/"
            className={`flex items-center gap-2 font-mono font-bold transition-all ${
              isScrolled
                ? "bg-primary text-background px-5 h-9 rounded-full text-sm mr-4 hover:opacity-80"
                : "text-primary text-2xl mr-6 hover:opacity-80"
            }`}>
            <CodeIcon
              className={isScrolled ? "size-4 hidden sm:block" : "size-8"}
            />
            <span className={isScrolled ? "tracking-wide" : ""}>
              {isScrolled ? "Commit" : "Commit"}
            </span>
          </Link>

          <SignedIn>
            <div className="hidden items-center gap-1 sm:flex">
              {APP_LINKS.map((link) => {
                const isActive =
                  pathname === link.href ||
                  pathname?.startsWith(`${link.href}/`);

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                    )}>
                    {link.label}
                  </Link>
                );
              })}
            </div>

            <div className="flex items-center space-x-2 sm:space-x-4 ml-auto">
              <div className="flex items-center gap-2 border-r border-border/50 pr-4">
                <DasboardBtn />
                <NotificationBell />
              </div>
              <div className="flex items-center gap-3">
                <ModeToggle />
                <div
                  className={
                    isScrolled
                      ? "scale-95 transition-transform"
                      : "scale-100 transition-transform"
                  }>
                  <UserButton />
                </div>
              </div>
            </div>
          </SignedIn>

          <SignedOut>
            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <ModeToggle />
              <SignInButton mode="modal">
                <Button variant="ghost" size="sm">
                  Sign in
                </Button>
              </SignInButton>
              <SignUpButton mode="modal">
                <Button size="sm">Get started</Button>
              </SignUpButton>
            </div>
          </SignedOut>
        </div>
      </nav>
    </div>
  );
}

export default Navbar;
