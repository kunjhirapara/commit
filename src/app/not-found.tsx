import Link from "next/link";
import ErrorState from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <ErrorState
      fullScreen
      title="Page not found"
      message="We couldn't find the page you were looking for. It may have been moved, renamed, or never existed."
      secondaryAction={
        <Link href="/">
          <Button>Back to home</Button>
        </Link>
      }
    />
  );
}
