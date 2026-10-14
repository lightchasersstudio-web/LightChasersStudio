import { ArrowRightIcon, CameraIcon, ClockIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { categoryLabel } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/storage";
import { formatDuration } from "@/lib/utils/format";
import { formatPeso } from "@/lib/utils/money";
import type { PublicService } from "@/server/queries/public";

/** Whole card is one link; the title carries the accessible name. */
export function ServiceCard({ service }: { service: PublicService }) {
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border bg-card transition-shadow duration-300 focus-within:ring-3 focus-within:ring-ring/50 hover:shadow-xl">
      <div className="relative aspect-[4/3] overflow-hidden bg-accent">
        {service.cover_image_path ? (
          <Image
            src={publicImageUrl("portfolio", service.cover_image_path)}
            alt=""
            fill
            sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transition-none"
          />
        ) : (
          <CameraIcon className="absolute inset-0 m-auto size-12 text-terracotta/70" aria-hidden />
        )}
        <span className="absolute top-3 left-3 rounded-full bg-background/90 px-3 py-1 text-xs font-semibold backdrop-blur">
          {categoryLabel(service.category)}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-semibold">
          <Link
            href={`/services/${service.slug}`}
            className="outline-none after:absolute after:inset-0"
          >
            {service.name}
          </Link>
        </h3>
        {service.summary && <p className="mt-2 text-muted-foreground">{service.summary}</p>}
        <div className="mt-auto flex items-end justify-between gap-3 pt-5">
          <div>
            <p className="text-xs text-muted-foreground">from</p>
            <p className="font-heading text-2xl font-semibold">{formatPeso(service.price_cents)}</p>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <ClockIcon className="size-3.5" aria-hidden />
              {formatDuration(service.duration_minutes)}
            </p>
          </div>
          <span
            aria-hidden
            className="grid size-11 place-items-center rounded-full bg-primary text-primary-foreground transition-transform duration-300 group-hover:translate-x-1"
          >
            <ArrowRightIcon className="size-5" />
          </span>
        </div>
      </div>
    </article>
  );
}
