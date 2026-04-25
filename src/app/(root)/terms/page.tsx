import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Version 2026-04-22</p>
          <p>
            CodeSync is provided for interview scheduling, communication, live
            coding, video collaboration, and hiring evaluation workflows.
          </p>
          <p>
            Users must protect candidate information, avoid unauthorized access,
            and use the platform only for legitimate recruiting and interview
            operations.
          </p>
          <p>
            Recording, retention, and review activities must follow the
            configured disclosure rules, internal hiring policy, and applicable
            local law.
          </p>
          <p>
            Administrative actions, access changes, data exports, and recovery
            operations may be logged for security, governance, and incident
            response.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
