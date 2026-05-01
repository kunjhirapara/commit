import Link from "next/link";
import ErrorState from "@/components/ui/ErrorState";

function CallEndedPage() {
  return (
    <ErrorState
      fullScreen
      title="Call has ended"
      message="This meeting was closed by the host and can no longer be joined from this link."
      secondaryAction={
        <Link
          className="text-sm text-primary underline-offset-4 hover:underline"
          href="/">
          Back to dashboard
        </Link>
      }
    />
  );
}

export default CallEndedPage;
