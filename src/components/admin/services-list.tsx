"use client";

import { CameraIcon, ClockIcon, PencilIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { handleResult } from "@/components/admin/form-utils";
import { moveItem, ReorderButtons } from "@/components/admin/reorder-buttons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { categoryLabel } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/storage";
import { formatPeso } from "@/lib/utils/money";
import { deleteService, reorderServices, setServiceActive } from "@/server/actions/services";
import type { Service } from "@/server/queries/services";

export function ServicesList({ services: initial }: { services: Service[] }) {
  const [services, setServices] = useState(initial);
  const [pending, startTransition] = useTransition();
  // Re-sync when the server sends a fresh list (after refresh()).
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setServices(initial);
  }

  function move(from: number, to: number) {
    const next = moveItem(services, from, to);
    setServices(next);
    startTransition(async () => {
      const result = await reorderServices({ ids: next.map((s) => s.id) });
      if (!handleResult(result, "")) setServices(services);
    });
  }

  function toggle(service: Service, isActive: boolean) {
    setServices((list) =>
      list.map((s) => (s.id === service.id ? { ...s, is_active: isActive } : s)),
    );
    startTransition(async () => {
      const result = await setServiceActive({ id: service.id, isActive });
      if (
        !handleResult(
          result,
          isActive ? `${service.name} is bookable.` : `${service.name} is hidden.`,
        )
      ) {
        setServices((list) => list.map((s) => (s.id === service.id ? service : s)));
      }
    });
  }

  if (services.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
        <CameraIcon className="mx-auto size-10 text-terracotta" aria-hidden />
        <h2 className="mt-4 text-2xl font-semibold">No services yet</h2>
        <p className="mt-2 text-muted-foreground">Add your first package so clients can book it.</p>
        <Button asChild className="mt-6">
          <Link href="/admin/services/new">Add a service</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="space-y-3">
      {services.map((service, index) => (
        <li
          key={service.id}
          className="flex flex-col gap-4 rounded-2xl border bg-card p-3 sm:flex-row sm:items-center sm:p-4"
        >
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-muted sm:size-24">
              {service.cover_image_path ? (
                <Image
                  src={publicImageUrl("portfolio", service.cover_image_path)}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              ) : (
                <CameraIcon
                  className="absolute inset-0 m-auto size-6 text-muted-foreground"
                  aria-hidden
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate font-heading text-lg font-semibold">{service.name}</h2>
                {!service.is_active && <Badge variant="secondary">Hidden</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{categoryLabel(service.category)}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                <span className="font-semibold">{formatPeso(service.price_cents)}</span>
                <span className="flex items-center gap-1 text-muted-foreground">
                  <ClockIcon className="size-3.5" aria-hidden />
                  {formatDuration(service.duration_minutes)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-3 sm:border-0 sm:pt-0">
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <Switch
                checked={service.is_active}
                onCheckedChange={(v) => toggle(service, v)}
                disabled={pending}
                aria-label={`${service.name} bookable`}
              />
              <span className="sm:sr-only">Bookable</span>
            </label>
            <div className="flex items-center">
              <ReorderButtons
                index={index}
                count={services.length}
                name={service.name}
                disabled={pending}
                onMove={move}
              />
              <Button asChild variant="ghost" size="icon" aria-label={`Edit ${service.name}`}>
                <Link href={`/admin/services/${service.id}`}>
                  <PencilIcon aria-hidden />
                </Link>
              </Button>
              <ConfirmDelete
                label={`Delete ${service.name}`}
                title={`Delete “${service.name}”?`}
                description="This can't be undone. Services that already have bookings can't be deleted; turn them off instead."
                onConfirm={async () =>
                  handleResult(await deleteService({ id: service.id }), "Service deleted.")
                }
              />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return [h && `${h} hr`, m && `${m} min`].filter(Boolean).join(" ");
}
