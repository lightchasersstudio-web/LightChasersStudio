"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ImagesIcon, Loader2Icon, PencilIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { SelectField, SwitchField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { moveItem, ReorderButtons } from "@/components/admin/reorder-buttons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";
import { categoryLabel, SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/catalog";
import { publicImageUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  updatePortfolioImageSchema,
  type UpdatePortfolioImageInput,
} from "@/lib/validations/portfolio";
import {
  deletePortfolioImage,
  reorderPortfolio,
  updatePortfolioImage,
} from "@/server/actions/portfolio";
import type { PortfolioImage } from "@/server/queries/portfolio";

type Filter = "all" | "featured" | ServiceCategory;

type PackageOption = { value: string; label: string };

export function PortfolioGrid({
  images: initial,
  packages,
}: {
  images: PortfolioImage[];
  /** Packages a photo can be linked to, for "Book this package" in the public gallery. */
  packages: PackageOption[];
}) {
  const [images, setImages] = useState(initial);
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setImages(initial);
  }
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<PortfolioImage | null>(null);
  const [pending, startTransition] = useTransition();

  const visible = images.filter((img) =>
    filter === "all" ? true : filter === "featured" ? img.is_featured : img.category === filter,
  );

  /** Moves within the filtered view by swapping positions in the full list. */
  function move(from: number, to: number) {
    const a = images.indexOf(visible[from]!);
    const b = images.indexOf(visible[to]!);
    const next = moveItem(images, a, b);
    setImages(next);
    startTransition(async () => {
      if (!handleResult(await reorderPortfolio({ ids: next.map((i) => i.id) }), ""))
        setImages(images);
    });
  }

  function toggleFeatured(img: PortfolioImage) {
    const updated = { ...img, is_featured: !img.is_featured };
    setImages((list) => list.map((i) => (i.id === img.id ? updated : i)));
    startTransition(async () => {
      const result = await updatePortfolioImage({
        id: img.id,
        category: img.category,
        altText: img.alt_text,
        caption: img.caption ?? "",
        isFeatured: updated.is_featured,
        serviceId: img.service_id ?? "",
      });
      if (
        !handleResult(
          result,
          updated.is_featured ? "Featured on the home page." : "Removed from featured.",
        )
      ) {
        setImages((list) => list.map((i) => (i.id === img.id ? img : i)));
      }
    });
  }

  const filters: { value: Filter; label: string; count: number }[] = [
    { value: "all", label: "All", count: images.length },
    { value: "featured", label: "Featured", count: images.filter((i) => i.is_featured).length },
    ...SERVICE_CATEGORIES.map((c) => ({
      value: c.value,
      label: c.label,
      count: images.filter((i) => i.category === c.value).length,
    })),
  ];

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Filter photos"
        className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {filters.map((f) => (
          <Button
            key={f.value}
            size="sm"
            variant={filter === f.value ? "default" : "outline"}
            aria-pressed={filter === f.value}
            onClick={() => setFilter(f.value)}
            className="shrink-0"
          >
            {f.label}
            <span className="opacity-70">{f.count}</span>
          </Button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
          <ImagesIcon className="mx-auto size-10 text-terracotta" aria-hidden />
          <p className="mt-3">
            {images.length === 0
              ? "No photos yet. Add your best work above."
              : "No photos in this view."}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {visible.map((img, index) => (
            <li key={img.id} className="overflow-hidden rounded-2xl border bg-card">
              <div className="relative aspect-[4/3] bg-muted">
                <Image
                  src={publicImageUrl("portfolio", img.storage_path)}
                  alt={img.alt_text}
                  fill
                  sizes="(min-width: 1536px) 25vw, (min-width: 1024px) 33vw, (min-width: 420px) 50vw, 100vw"
                  placeholder={img.blur_data_url ? "blur" : "empty"}
                  blurDataURL={img.blur_data_url ?? undefined}
                  className="object-cover"
                />
                <Button
                  size="icon"
                  variant="secondary"
                  aria-pressed={img.is_featured}
                  aria-label={
                    img.is_featured ? "Unfeature photo" : "Feature photo on the home page"
                  }
                  className="absolute top-2 right-2 bg-background/85 backdrop-blur"
                  onClick={() => toggleFeatured(img)}
                  disabled={pending}
                >
                  <StarIcon
                    aria-hidden
                    className={cn(img.is_featured && "fill-terracotta text-terracotta")}
                  />
                </Button>
              </div>
              <div className="flex items-center gap-1 p-2 pl-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{img.alt_text}</p>
                  <p className="text-xs text-muted-foreground">{categoryLabel(img.category)}</p>
                </div>
                <ReorderButtons
                  index={index}
                  count={visible.length}
                  name="photo"
                  disabled={pending}
                  onMove={move}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Edit photo details"
                  onClick={() => setEditing(img)}
                >
                  <PencilIcon aria-hidden />
                </Button>
                <ConfirmDelete
                  label="Delete photo"
                  title="Delete this photo?"
                  description="It will be removed from the gallery and storage. This can't be undone."
                  onConfirm={async () =>
                    handleResult(await deletePortfolioImage({ id: img.id }), "Photo deleted.")
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="sm:max-w-lg">
          {editing && (
            <EditPhotoForm
              key={editing.id}
              image={editing}
              packages={packages}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditPhotoForm({
  image,
  packages,
  onDone,
}: {
  image: PortfolioImage;
  packages: PackageOption[];
  onDone: () => void;
}) {
  const form = useForm<
    UpdatePortfolioImageInput,
    unknown,
    z.output<typeof updatePortfolioImageSchema>
  >({
    resolver: zodResolver(updatePortfolioImageSchema),
    defaultValues: {
      id: image.id,
      category: image.category,
      altText: image.alt_text,
      caption: image.caption ?? "",
      isFeatured: image.is_featured,
      serviceId: image.service_id ?? "",
    },
  });

  async function onSubmit() {
    if (handleResult(await updatePortfolioImage(form.getValues()), "Photo updated.", form))
      onDone();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>Photo details</DialogTitle>
        <DialogDescription>
          The description is read aloud by screen readers and helps Google.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <TextField control={form.control} name="altText" label="Description" maxLength={300} />
        <TextAreaField
          control={form.control}
          name="caption"
          label="Caption (optional)"
          rows={2}
          maxLength={300}
        />
        <SelectField
          control={form.control}
          name="category"
          label="Category"
          options={SERVICE_CATEGORIES}
        />
        <SelectField
          control={form.control}
          name="serviceId"
          label="Package shown (optional)"
          description='Adds a "Book this package" button when visitors open this photo.'
          options={[{ value: "", label: "None" }, ...packages]}
        />
        <SwitchField
          control={form.control}
          name="isFeatured"
          label="Featured"
          description="Show on the home page."
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}
