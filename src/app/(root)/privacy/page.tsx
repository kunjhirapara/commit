import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Version 2026-04-22</p>
          <p>
            CodeSync stores interview scheduling details, participant identity data, evaluation notes, notification delivery state, and operational audit information to run hiring workflows safely.
          </p>
          <p>
            Recording disclosures, retention windows, compliance jurisdiction, and candidate data handling are attached to interviews where applicable.
          </p>
          <p>
            Sensitive access to candidate history, recordings, exports, and governance workflows may be logged to support least-privilege controls and incident investigations.
          </p>
          <p>
            Users can request data export or deletion review through the settings page, subject to employer recordkeeping and applicable legal obligations.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
