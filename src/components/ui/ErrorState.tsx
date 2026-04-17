import { ReactNode } from "react";
import { Button } from "./button";

interface ErrorStateProps {
  title?: string;
  message: string;
  details?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryAction?: ReactNode;
  fullScreen?: boolean;
}

function ErrorState({
  title = "Something went wrong",
  message,
  details,
  actionLabel,
  onAction,
  secondaryAction,
  fullScreen = false,
}: ErrorStateProps) {
  return (
    <div
      className={`flex w-full flex-col items-center justify-center gap-4 px-4 text-center ${
        fullScreen ? "min-h-screen" : "h-[calc(100vh-4rem-1px)]"
      }`}>
      <div className="max-w-xl space-y-2">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted-foreground">{message}</p>
        {details ? (
          <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            {details}
          </pre>
        ) : null}
      </div>

      {actionLabel && onAction ? (
        <Button onClick={onAction}>{actionLabel}</Button>
      ) : null}

      {secondaryAction}
    </div>
  );
}

export default ErrorState;
