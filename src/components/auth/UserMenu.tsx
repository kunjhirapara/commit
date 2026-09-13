"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { LogOutIcon, SettingsIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCurrentUser } from "@/hooks/useCurrentUser";

/**
 * Replaces Clerk's `<UserButton />`.
 *
 * Clerk's version opened a hosted account-management modal. We do not have one
 * and should not grow one here: the app already has /settings, and the menu
 * links to it rather than reimplementing profile editing in a dropdown.
 *
 * There is deliberately no Profile entry. This app has no /profile route — only
 * /settings — and a menu item that 404s is worse than one that is absent.
 *
 * Renders nothing until the user record resolves. An avatar that appears as a
 * grey circle and then pops into a face on every navigation is worse than one
 * that appears slightly later, and the fallback initial needs the name anyway.
 */

const initialFrom = (name: string | undefined, email: string | undefined) => {
  const source = name?.trim() || email?.trim() || "";
  return source.charAt(0).toUpperCase() || "?";
};

export function UserMenu() {
  const { user, isLoaded, isSignedIn } = useCurrentUser();

  if (!isLoaded || !isSignedIn || !user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Account menu">
          <Avatar className="size-7">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="text-xs">
              {initialFrom(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-sm font-medium">{user.name}</span>
          {/*
            getCurrentUser returns "" for the email when the viewer is not
            allowed to see it. That never applies to your own row, but rendering
            an empty line would look broken if it ever did.
          */}
          {user.email && (
            <span className="block truncate text-xs text-muted-foreground">
              {user.email}
            </span>
          )}
        </DropdownMenuLabel>

        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/settings">
            <SettingsIcon className="size-4" aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            // callbackUrl rather than staying put: signing out on /dashboard
            // would otherwise bounce through the middleware to /signin with a
            // redirect_url pointing back at the page they just left.
            void signOut({ redirectTo: "/" });
          }}>
          <LogOutIcon className="size-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default UserMenu;
