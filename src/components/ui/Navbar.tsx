"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ModeToggle } from "./ModeToggle";
import { CodeIcon } from "lucide-react";
import { SignedIn, UserButton } from "@clerk/nextjs";
import DasboardBtn from "./DasboardBtn";
import NotificationBell from "./NotificationBell";

function Navbar() {
  const [isScrolled, setIsScrolled] = useState(false);

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
            ? "max-w-4xl rounded-full border border-border/50 bg-background/80 shadow-lg backdrop-blur-md"
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
                ? "bg-foreground text-background px-5 h-9 rounded-full text-sm mr-4 hover:opacity-80"
                : "text-primary text-2xl mr-6 hover:opacity-80"
            }`}>
            <CodeIcon
              className={isScrolled ? "size-4 hidden sm:block" : "size-8"}
            />
            <span className={isScrolled ? "tracking-wide" : ""}>
              {isScrolled ? "Home" : "Commit"}
            </span>
          </Link>

          <SignedIn>
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
        </div>
      </nav>
    </div>
  );
}

export default Navbar;
