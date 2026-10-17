import { ArrowLeftIcon, CheckIcon, ClockIcon, WalletIcon } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { BookCta } from "@/components/public/book-cta";
import { PackageCompare } from "@/components/public/package-compare";
import { ReviewsSection } from "@/components/public/reviews-section";
import { PlaceholderPolaroid } from "@/components/public/photo-polaroid";
import { bookHref } from "@/components/public/site-nav";
import { ShareButton } from "@/components/shared/share-button";
import { Sparkle } from "@/components/shared/sparkle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { bookingTotals } from "@/lib/booking/pricing";
import { categoryLabel } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/storage";
import { formatDuration } from "@/lib/utils/format";
import { formatPeso } from "@/lib/utils/money";
import {
  getActiveServiceBySlug,
  getPublicSettings,
  listActiveServices,
} from "@/server/queries/public";

// Cache Components needs at least one param to validate the route at build time.
const PLACEHOLDER = "__none__";

export async function generateStaticParams() {
  const services = await listActiveServices();
  return services.length ? services.map((s) => ({ slug: s.slug })) : [{ slug: PLACEHOLDER }];
}

export async function generateMetadata({
  params,
}: PageProps<"/services/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const service = await getActiveServiceBySlug(slug);
  if (!service) return { title: "Service not found" };
  return {
    title: service.name,
    description: service.summary ?? `${service.name} by Light Chasers Studio, Zamboanga City.`,
    openGraph: service.cover_image_path
      ? { images: [publicImageUrl("portfolio", service.cover_image_path)] }
      : undefined,
  };
}

// params are read inside <Suspense> (Partial Prefetching): pages for slugs added after the
// build get an instant shell, and admin edits can regenerate them in the background.
export default function ServicePage({ params }: PageProps<"/services/[slug]">) {
  return (
    <>
      <Suspense fallback={<ServiceSkeleton />}>
        <ServiceDetail params={params} />
      </Suspense>
    </>
  );
}

async function ServiceDetail({ params }: Pick<PageProps<"/services/[slug]">, "params">) {
  const { slug } = await params;
  const [service, settings, allServices] = await Promise.all([
    getActiveServiceBySlug(slug),
    getPublicSettings(),
    listActiveServices(),
  ]);
  if (!service) notFound();

  const inclusions = service.inclusions as string[];
  // Same rule as create_booking() for the package on its own (add-ons raise it).
  const { deposit: depositCents } = bookingTotals({
    packageCents: service.price_cents,
    addOnsCents: 0,
    vatPercent: settings.vat_percent,
    fixedDepositCents: service.deposit_cents,
    depositPercent: settings.default_deposit_percent,
  });

  return (
    <>
      <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
        <Button asChild variant="ghost" className="-ml-3">
          <Link href="/services">
            <ArrowLeftIcon aria-hidden />
            All services
          </Link>
        </Button>

        <div className="mt-6 grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-start">
          <div className="relative">
            {service.cover_image_path ? (
              <div className="polaroid -rotate-2 pb-4">
                <div className="relative aspect-[4/3] overflow-hidden rounded-[2px]">
                  <Image
                    src={publicImageUrl("portfolio", service.cover_image_path)}
                    alt=""
                    fill
                    priority
                    sizes="(min-width: 768px) 55vw, 100vw"
                    className="object-cover"
                  />
                </div>
              </div>
            ) : (
              <PlaceholderPolaroid
                index={["wedding", "portrait", "event", "commercial"].indexOf(service.category)}
                className="mx-auto w-2/3 -rotate-2"
              />
            )}
            <Sparkle className="absolute -top-3 -right-2 size-7 text-terracotta" />
          </div>

          <div>
            <p className="font-script text-2xl text-terracotta-ink">
              {categoryLabel(service.category)}
            </p>
            <h1 className="mt-1 text-4xl font-semibold sm:text-5xl">{service.name}</h1>
            {service.summary && (
              <p className="mt-4 text-lg text-muted-foreground">{service.summary}</p>
            )}

            <dl className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border bg-card p-4">
                <dt className="text-sm text-muted-foreground">Package price</dt>
                <dd className="font-heading text-2xl font-semibold">
                  {formatPeso(service.price_cents)}
                </dd>
                {settings.vat_percent > 0 && (
                  <dd className="text-xs text-muted-foreground">+ {settings.vat_percent}% VAT</dd>
                )}
              </div>
              <div className="rounded-2xl border bg-card p-4">
                <dt className="flex items-center gap-1 text-sm text-muted-foreground">
                  <ClockIcon className="size-3.5" aria-hidden />
                  Session
                </dt>
                <dd className="font-heading text-2xl font-semibold">
                  {formatDuration(service.duration_minutes)}
                </dd>
              </div>
            </dl>
            {depositCents > 0 && (
              <p className="mt-3 flex items-start gap-2 rounded-2xl bg-accent p-4 text-sm text-accent-foreground">
                <WalletIcon className="mt-0.5 size-4 shrink-0" aria-hidden />
                <span>
                  A <strong>{formatPeso(depositCents)}</strong> deposit holds your date when you
                  book.
                </span>
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg" className="w-full sm:w-auto">
                <Link href={bookHref(service.slug)}>Book now</Link>
              </Button>
              <ShareButton
                path={`/services/${service.slug}`}
                title={service.name}
                text={service.summary ?? `${service.name} at ${settings.business_name}`}
                size="lg"
                className="w-full sm:w-auto"
              />
            </div>
          </div>
        </div>

        {(service.description || inclusions.length > 0) && (
          <div className="mt-14 grid gap-10 md:grid-cols-[1.1fr_1fr]">
            {service.description && (
              <section aria-labelledby="about-session">
                <h2 id="about-session" className="text-2xl font-semibold">
                  About this session
                </h2>
                <p className="mt-3 text-lg leading-relaxed whitespace-pre-line text-muted-foreground">
                  {service.description}
                </p>
              </section>
            )}
            {inclusions.length > 0 && (
              <section aria-labelledby="included" className="rounded-3xl border bg-card p-6">
                <h2 id="included" className="text-2xl font-semibold">
                  What&apos;s included
                </h2>
                <ul className="mt-4 space-y-3">
                  {inclusions.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-secondary text-secondary-foreground">
                        <CheckIcon className="size-3.5" aria-hidden />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </article>
      <PackageCompare
        packages={allServices.filter((s) => s.category === service.category)}
        currentId={service.id}
        categoryName={categoryLabel(service.category)}
        vatPercent={settings.vat_percent}
      />
      <ReviewsSection
        category={service.category}
        title="Clients who booked this"
        className="pt-0"
      />
      <BookCta href={bookHref(service.slug)} />
    </>
  );
}

function ServiceSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
      <Skeleton className="h-10 w-36 rounded-full" />
      <div className="mt-6 grid gap-10 md:grid-cols-[1.1fr_1fr]">
        <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-12 w-3/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-11 w-48 rounded-full" />
        </div>
      </div>
    </div>
  );
}
