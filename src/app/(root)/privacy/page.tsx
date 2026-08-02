import type { Metadata } from "next";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CONTACT_EMAIL,
  DATA_CATEGORIES,
  LEGAL_VERSION,
  MINIMUM_AGE,
  OPERATOR_NAME,
  SITE_DOMAIN,
  SUB_PROCESSORS,
} from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Who runs Commit, exactly what it stores, who else processes it, how long it is kept, and how to have it deleted.",
};

/**
 * Written against convex/schema.ts rather than from a template.
 *
 * Two audiences read this. Candidates are entitled to know they are monitored
 * during an interview, and Google's OAuth reviewer looks specifically for a
 * statement of what happens to Google account data. Both are answered here in
 * the app's own terms; a generic policy would satisfy neither.
 */
export default function PrivacyPage() {
  return (
    <div className="container mx-auto max-w-4xl space-y-6 py-10">
      <Card>
        <CardHeader>
          <CardTitle>Privacy Policy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>Version {LEGAL_VERSION}</p>
          <p>
            Commit is operated by {OPERATOR_NAME}, an individual, as a personal
            project. There is no company behind it. For anything in this policy,
            including a request to see or delete your data, write to{" "}
            <a
              className="font-medium text-foreground underline"
              href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <p>
            This policy covers <span className="font-mono">{SITE_DOMAIN}</span>{" "}
            and nothing else.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">What is collected, and why</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          {DATA_CATEGORIES.map((category) => (
            <div key={category.category} className="space-y-1">
              <h3 className="font-semibold text-foreground">
                {category.category}
              </h3>
              <p>{category.detail}</p>
              <p className="text-xs">
                <span className="font-medium">Kept:</span> {category.retention}
              </p>
            </div>
          ))}
          <p>
            Commit does not sell personal data, does not use it for advertising,
            and does not use it to train machine-learning models.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Monitoring during interviews
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            When you take part in an interview <strong>as a candidate</strong>,
            Commit records signals about how the interview window was used:
            how long it lost focus, how much text was pasted at once, whether
            more than one display was connected, and the difference between your
            device clock and the server&apos;s. Interviewers are not monitored.
          </p>
          <p>
            This is disclosed before you join a call, and joining is how you
            agree to it. If you would rather not be monitored, do not join the
            call — tell the interviewer instead.
          </p>
          <p>
            No score, rating or judgement is produced from these signals. They
            are shown to the interviewer as individual measurements, and they are
            not evidence of anything on their own. Because this is behavioural
            monitoring, accounts are limited to people aged {MINIMUM_AGE} and
            over.
          </p>
          <p>
            Recording of audio and video is separate and is described in the{" "}
            <Link
              className="font-medium text-foreground underline"
              href="/recording-disclosure">
              recording disclosure
            </Link>
            .
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            If you sign in with Google
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Signing in with Google gives Commit your name, email address and
            profile picture. They are used for one thing: creating and
            authenticating your account, so you appear as a recognisable person
            to the people you interview with.
          </p>
          <p>
            That data is not sold, not used for advertising, not used to train
            models, and not shared with anyone beyond the processors listed
            below. Commit requests no access to Gmail, Drive, Calendar or
            contacts, and holds no Google data other than the three fields above.
          </p>
          <p>
            You can disconnect Commit at any time from your{" "}
            <a
              className="font-medium text-foreground underline"
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer">
              Google account permissions
            </a>
            . Doing so stops future sign-ins but does not delete data already
            stored here — for that, ask for deletion.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Who else processes your data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Commit is built on third-party services. Each one processes data on
            the operator&apos;s instructions, for the purpose named:
          </p>
          <div className="space-y-3">
            {SUB_PROCESSORS.map((processor) => (
              <div key={processor.name} className="space-y-0.5">
                <h3 className="font-semibold text-foreground">
                  {processor.name}
                </h3>
                <p>{processor.purpose}</p>
                <p className="text-xs">{processor.data}</p>
              </div>
            ))}
          </div>
          <p>
            These providers operate internationally, so your data may be stored
            or processed outside your country.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your rights</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            You can ask for a copy of your data, ask for it to be corrected, ask
            for it to be deleted, withdraw consent, or nominate someone else to
            exercise these rights for you. Write to{" "}
            <a
              className="font-medium text-foreground underline"
              href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            . Requests are answered within 90 days, and usually far sooner.
          </p>
          <p>
            Two limits worth stating honestly. Evaluation records and audit logs
            connected to an interview may be retained where an organisation needs
            them for its own recordkeeping. And deleting your account does not
            retract feedback an interviewer already wrote about you, though it is
            no longer linked to a live account.
          </p>
          <p>
            If you are in India and are not satisfied with the response, you may
            complain to the Data Protection Board of India.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security, and its limits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Access is role-based and checked on the server for every request.
            Sensitive actions are logged. Code you submit runs in an isolated
            container with no network access. Traffic is encrypted in transit.
          </p>
          <p>
            No system is perfectly secure, and this one is maintained by one
            person. If a breach affects your data you will be told, and the
            relevant authority notified where the law requires it. If you find a
            vulnerability, please report it to{" "}
            <a
              className="font-medium text-foreground underline"
              href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>{" "}
            rather than disclosing it publicly.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cookies and changes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Commit sets only what it needs to work: a session cookie from the
            authentication provider, a theme preference, and a request
            correlation identifier used to trace errors. There are no
            advertising or cross-site tracking cookies.
          </p>
          <p>
            If this policy changes materially, the version date above changes and
            the change is announced in the app before it takes effect. Continuing
            to use Commit after that means you accept the revised policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
