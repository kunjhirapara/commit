"use client";

import { ReactNode } from "react";
import { TrendingUpIcon, TrendingDownIcon, MinusIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function DashboardPageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-[28px] border border-border/70 bg-card/80 p-6 shadow-sm backdrop-blur md:flex-row md:items-end md:justify-between">
      <div className="space-y-2.5">
        {eyebrow ? (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

type Trend = "up" | "down" | "neutral";

export function MetricCard({
  label,
  value,
  hint,
  accentClassName,
  trend,
  trendLabel,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accentClassName?: string;
  trend?: Trend;
  trendLabel?: string;
}) {
  const TrendIcon =
    trend === "up" ? TrendingUpIcon : trend === "down" ? TrendingDownIcon : MinusIcon;
  const trendColor =
    trend === "up"
      ? "text-emerald-600 dark:text-emerald-400"
      : trend === "down"
        ? "text-rose-500 dark:text-rose-400"
        : "text-muted-foreground";

  return (
    <Card className="group overflow-hidden border-border/70 bg-card/80 shadow-sm transition-shadow duration-200 hover:shadow-md">
      <CardHeader className="pb-2">
        <CardDescription className="text-xs font-medium uppercase tracking-wide">
          {label}
        </CardDescription>
        <CardTitle
          className={cn(
            "text-3xl font-semibold tracking-tight tabular-nums",
            accentClassName,
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between gap-2">
          {hint ? (
            <p className="text-xs text-muted-foreground">{hint}</p>
          ) : null}
          {trend && trendLabel ? (
            <span className={cn("inline-flex items-center gap-1 text-xs font-medium", trendColor)}>
              <TrendIcon className="size-3" aria-hidden="true" />
              {trendLabel}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

export function SectionIntro({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <span className="mt-1 block size-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
        <div className="space-y-1">
          <h2 className="text-base font-semibold leading-none tracking-tight">{title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
