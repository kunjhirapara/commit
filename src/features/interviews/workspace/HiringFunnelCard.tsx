import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { DashboardAnalytics } from "./types";
import { formatLabel } from "./utils";

type HiringFunnelCardProps = {
  analytics: DashboardAnalytics;
};

export function HiringFunnelCard({ analytics }: HiringFunnelCardProps) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle>Hiring funnel</CardTitle>
        <CardDescription>
          Stage-level counts for quick recruiting visibility.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {analytics.funnel.map((item) => (
          <div
            key={item.status ?? "unknown"}
            className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm"
          >
            <span className="capitalize">{formatLabel(item.status)}</span>
            <Badge>{item.count}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
