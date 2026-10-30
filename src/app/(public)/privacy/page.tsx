import type { Metadata } from "next";
import Link from "next/link";

import { SectionHeading } from "@/components/public/section-heading";
import { PRIVACY_UPDATED } from "@/lib/validations/booking";
import { getPublicSettings } from "@/server/queries/public";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What personal data Light Chasers Studio collects when you book, why, who sees it and how to ask for it to be deleted.",
};

// Written from what the site actually collects; the owner reviews the wording
// before go-live (docs/HANDOFF.md). Bump CONSENT_VERSION when it changes.
export default async function PrivacyPage() {
  const s = await getPublicSettings();
  const contact = s.email ? (
    <a href={`mailto:${s.email}`} className="font-semibold underline underline-offset-4">
      {s.email}
    </a>
  ) : (
    <Link href="/contact" className="font-semibold underline underline-offset-4">
      our contact page
    </Link>
  );

  return (
    <section className="bg-studio">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <SectionHeading
          as="h1"
          eyebrow="your data, looked after"
          title="Privacy policy"
          description={`How ${s.business_name} handles your personal data, under the Philippine Data Privacy Act of 2012 (RA 10173). Last updated ${PRIVACY_UPDATED}.`}
        />
        <div className="mt-10 space-y-8 rounded-[2rem] border bg-background p-6 leading-relaxed sm:p-10 [&_h2]:mb-3 [&_h2]:text-2xl [&_h2]:font-semibold [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-5">
          <div>
            <h2>Who we are</h2>
            <p>
              {s.business_name} is a photography studio in {s.city ?? "Zamboanga City"},
              Philippines. We are responsible for the personal data you give us on this website. For
              anything about your data, contact us at {contact}.
            </p>
          </div>

          <div>
            <h2>What we collect</h2>
            <ul>
              <li>
                <strong>Your contact details</strong>: name, email, mobile number, how you prefer to
                be contacted and, if you give it, your Messenger name.
              </li>
              <li>
                <strong>Your booking</strong>: the package, date and time, location, number of
                people and any notes or requests you write.
              </li>
              <li>
                <strong>Workshop sign-ups</strong>: for each person, the name for the certificate,
                mobile number, address and price category. For a student price, a photo of a valid
                student ID.
              </li>
              <li>
                <strong>Payments</strong>: the amount, date, method and PayMongo&apos;s payment
                reference. Your card, e-wallet or bank details are entered on PayMongo&apos;s page
                and never reach us.
              </li>
            </ul>
            <p className="mt-3">
              We don&apos;t use advertising or tracking cookies. While you fill in the booking form,
              your browser may keep an unfinished draft on your own device so you can pick up where
              you left off; it&apos;s removed once you book.
            </p>
          </div>

          <div>
            <h2>Why we use it</h2>
            <ul>
              <li>To hold your date and time, take your deposit and confirm your booking.</li>
              <li>To contact you about your booking, the shoot and your photos.</li>
              <li>To prepare workshop certificates and check student prices.</li>
              <li>To keep the accounting and tax records the law requires.</li>
            </ul>
            <p className="mt-3">
              We use your data because you agree to it when you book, and because we need it to
              provide the session you booked. We never sell it or use it for advertising.
            </p>
          </div>

          <div>
            <h2>Who else handles it</h2>
            <p>Only our studio team sees your details. We use these services to run the site:</p>
            <ul className="mt-2">
              <li>
                <strong>PayMongo</strong>, for payments.
              </li>
              <li>
                <strong>Supabase</strong>, where our booking records are stored securely.
              </li>
              <li>
                <strong>Vercel</strong>, which hosts this website.
              </li>
              <li>
                <strong>Google (Gmail)</strong>, which sends our booking emails.
              </li>
              <li>
                <strong>Cloudflare Turnstile</strong>, which checks that bookings come from real
                people and not bots.
              </li>
            </ul>
            <p className="mt-3">
              Some of these services store data outside the Philippines. Each only handles what it
              needs to do its job.
            </p>
          </div>

          <div>
            <h2>How long we keep it</h2>
            <p>
              We keep booking and payment records for as long as we need them for your booking and
              for the accounting and tax records the law requires. Student ID photos are deleted
              after the workshop. You can ask us to delete your personal data sooner (see below); we
              then remove your name and contact details but keep the amounts and dates our accounts
              need.
            </p>
          </div>

          <div>
            <h2>Your rights</h2>
            <p>Under the Data Privacy Act you can:</p>
            <ul className="mt-2">
              <li>ask what personal data we have about you and get a copy;</li>
              <li>ask us to correct anything that&apos;s wrong;</li>
              <li>ask us to delete or stop using your data;</li>
              <li>withdraw your consent, for the future;</li>
              <li>
                complain to the National Privacy Commission (
                <a
                  href="https://privacy.gov.ph"
                  className="underline underline-offset-4"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  privacy.gov.ph
                </a>
                ).
              </li>
            </ul>
            <p className="mt-3">
              To do any of these, email us at {contact} from the email address you booked with, or
              tell us your booking reference. We&apos;ll reply as soon as we can.
            </p>
          </div>

          <div>
            <h2>Keeping it safe</h2>
            <p>
              Our records are only reachable by signed-in studio staff, the site uses an encrypted
              connection (https), and student ID photos are kept in private storage that only the
              studio can open.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
