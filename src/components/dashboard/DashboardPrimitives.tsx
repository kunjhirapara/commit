"use client";

import { ReactNode } from "react";
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
      <div className="space-y-2">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-primary">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  accentClassName,
}: {
  label: string;
  value: number | string;
  hint?: string;
  accentClassName?: string;
}) {
  return (
    <Card className="overflow-hidden border-border/70 bg-card/80 shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle
          className={cn(
            "text-3xl font-semibold tracking-tight",
            accentClassName,
          )}
        >
          {value}
        </CardTitle>
      </CardHeader>
      {hint ? (
        <CardContent className="pt-0 text-sm text-muted-foreground">
          {hint}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function SectionIntro({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

