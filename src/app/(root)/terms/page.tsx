import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CONTACT_EMAIL,
  GOVERNING_LAW,
  LEGAL_VERSION,
  MINIMUM_AGE,
  OPERATOR_NAME,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The terms that govern use of Commit, including what it does not promise and what you may not do with it.",
};

/**
 * The protective half of the published documents.
 *
 * Commit is run by one person, without a company, and executes code submitted by
 * strangers. The clauses that matter here are the ones that say what is not
 * promised, cap what can be claimed, and give a concrete basis for cutting off
 * someone abusing the sandbox.
 */
export default function TermsPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Terms of Service</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Version {LEGAL_VERSION}</p>
          <p>
            These terms are an agreement between you and {OPERATOR_NAME}, an
            individual operating Commit as a personal project. By creating an
            account or using the service you accept them. If you do not, do not
            use Commit.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            You must be {MINIMUM_AGE} or older
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Accounts are only for people aged {MINIMUM_AGE} and over. This is not
            a formality. Commit monitors candidate behaviour during interviews,
            and Indian data protection law prohibits behavioural monitoring of
            anyone under {MINIMUM_AGE} outright — no consent, parental or
            otherwise, permits it.
          </p>
          <p>
            If you are under {MINIMUM_AGE}, you may not use Commit. Accounts
            found to belong to a minor are deleted along with their data.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What Commit is, and is not</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Commit provides scheduling, video calls, a shared code editor, a
            sandboxed code runner and structured feedback forms for technical
            interviews.
          </p>
          <p>
            Commit is not an employment agency, does not participate in hiring
            decisions, and does not assess, rank or score anyone. Interviewers
            and their organisations decide who to hire, are responsible for the
            fairness and lawfulness of their process, and are responsible for
            telling candidates what is being recorded and why. Nothing produced
            in Commit is a recommendation about any candidate.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Acceptable use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Commit runs code you submit inside an isolated container. That
            capability is offered on the following conditions. You must not:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              attempt to escape, disable or probe the sandbox, or use it to reach
              any network or system
            </li>
            <li>
              mine cryptocurrency, run distributed computation, or use the runner
              for anything unrelated to solving an interview or practice problem
            </li>
            <li>
              deliberately consume disproportionate resources, or automate
              submissions at a rate a person could not produce
            </li>
            <li>
              upload or transmit unlawful content, malware, or material you have
              no right to share
            </li>
            <li>
              record, copy or redistribute another participant&apos;s audio,
              video or answers outside the platform without their agreement
            </li>
            <li>
              attempt to access another user&apos;s data, impersonate anyone, or
              interfere with the service&apos;s operation
            </li>
          </ul>
          <p>
            Accounts breaking these rules may be suspended or removed without
            notice. Given the operator is one person, this is enforced by
            judgement rather than by process.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your content</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            You keep ownership of the code, notes and other content you create.
            You grant the operator only the permission needed to run the service:
            to store, display and transmit that content to the people you share
            an interview with, and to keep backups.
          </p>
          <p>
            That permission ends when the content is deleted, except for backup
            copies until they age out on their normal cycle.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            No warranty, and no guarantee of availability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Commit is provided free, as-is and as-available, with no warranty of
            any kind, express or implied. There is no service level, no uptime
            commitment and no support obligation. It runs on a single machine
            maintained by one person in their own time.
          </p>
          <p>
            The service may be changed, interrupted or discontinued at any time,
            with or without notice. Do not rely on Commit as the only record of
            anything you need to keep — export what matters to you.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Limitation of liability</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            To the fullest extent the law allows, the operator is not liable for
            any indirect, incidental, special or consequential loss, nor for lost
            profits, lost opportunities, lost data, or any hiring decision made
            by anyone using Commit.
          </p>
          <p>
            Because Commit is provided free of charge, total liability for any
            claim relating to it is limited to the amount you have paid for it,
            which is nothing.
          </p>
          <p>
            Some jurisdictions do not allow certain exclusions, so parts of this
            section may not apply to you. Nothing here excludes liability that
            cannot lawfully be excluded.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Indemnity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            If your use of Commit causes a claim against the operator — for
            example because you recorded someone without telling them, misused
            candidate data, or broke the acceptable use rules — you agree to
            cover the resulting costs.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Ending your use</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            You may stop using Commit and request deletion at any time by writing
            to{" "}
            <a
              className="font-medium text-foreground underline"
              href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            . The operator may suspend or terminate an account that breaks these
            terms, or discontinue the service entirely.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Governing law and changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            These terms are governed by {GOVERNING_LAW}. Disputes are subject to
            the exclusive jurisdiction of the competent courts at the
            operator&apos;s place of residence in India.
          </p>
          <p>
            These terms may change. The version date above changes with them, and
            material changes are announced in the app before taking effect.
            Continuing to use Commit afterwards means you accept the revised
            terms.
          </p>
          <p>
            How your data is handled is described in the{" "}
            <Link
              className="font-medium text-foreground underline"
              href="/privacy">
              privacy policy
            </Link>
            , and recording is described in the{" "}
            <Link
              className="font-medium text-foreground underline"
              href="/recording-disclosure">
              recording disclosure
            </Link>
            . Both form part of these terms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
