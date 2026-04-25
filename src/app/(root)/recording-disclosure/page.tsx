import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DISCLOSURES = [
  {
    jurisdiction: "Global baseline",
    detail:
      "Recording is limited to interview quality, interviewer calibration, training, and hiring review workflows. Access should stay restricted to approved recruiting and hiring operators.",
  },
  {
    jurisdiction: "EU / EEA",
    detail:
      "Only collect recordings when there is a documented lawful basis, a clear retention window, and a candidate-facing explanation of purpose, storage, and deletion handling.",
  },
  {
    jurisdiction: "United Kingdom",
    detail:
      "Candidates should be told when recording starts, who can review it, how long it is retained, and how they can raise access or deletion requests.",
  },
  {
    jurisdiction: "California / United States",
    detail:
      "Disclose recording before capture, describe the business purpose, and route consumer privacy requests through the platform's export and deletion workflow.",
  },
  {
    jurisdiction: "India",
    detail:
      "Use a clear notice before recording, limit collection to the interview purpose, and keep retention and access controls documented for internal review.",
  },
] as const;

export default function RecordingDisclosurePage() {
  return (
    <div className="container mx-auto max-w-4xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>Recording Disclosure</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Version 2026-04-22</p>
          <p>
            Commit may capture interview recordings only when the employer has enabled
            recording for that workflow and disclosed the purpose to participants.
          </p>
          <p>
            The platform records acknowledgement state, jurisdiction, and access activity to
            support internal compliance review, least-privilege access, and candidate data-rights
            requests.
          </p>
          <div className="space-y-3 rounded-2xl border border-border/70 bg-muted/30 p-4">
            {DISCLOSURES.map((item) => (
              <div key={item.jurisdiction}>
                <p className="font-medium text-foreground">{item.jurisdiction}</p>
                <p className="mt-1">{item.detail}</p>
              </div>
            ))}
          </div>
          <p>
            This page is product guidance only and does not replace review by your legal or privacy
            team for the markets where you hire.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
