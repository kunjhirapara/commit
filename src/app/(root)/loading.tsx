import { Skeleton } from "@/components/ui/skeleton";

/**
 * There was no loading.tsx anywhere in the app, so clicking a link left the
 * browser sitting on the previous page with no feedback at all until the server
 * responded — which is most of why navigation felt frozen rather than merely
 * slow. This paints immediately on click.
 */
export default function Loading() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-5 w-96" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}
