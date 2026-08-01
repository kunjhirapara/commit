import { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { InboxIcon } from "lucide-react";
import { Button } from "./button";

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: LucideIcon;
  /** Primary call to action. Use `actionHref` for navigation, `onAction` for handlers. */
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
}

/**
 * Counterpart to ErrorState for "nothing here yet" rather than "something broke".
 *
 * Every empty state in the app used to be an ad-hoc line of grey text, which is
 * how a brand-new user ended up on a page reading "You have no scheduled
 * interviews at the moment" and nothing else. An empty state should say what
 * belongs here and give the user their next move.
 */
function EmptyState({
  title,
  message,
  icon: Icon = InboxIcon,
  actionLabel,
  actionHref,
  onAction,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-border/70 bg-muted/20 px-6 py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>

      <div className="max-w-md space-y-1.5">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>

      {actionLabel && actionHref ? (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}

      {secondaryAction}
    </div>
  );
}

export default EmptyState;
