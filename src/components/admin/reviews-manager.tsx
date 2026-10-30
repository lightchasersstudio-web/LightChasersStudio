"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2Icon, MessageSquareQuoteIcon, PencilIcon, PlusIcon, StarIcon } from "lucide-react";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import type { z } from "zod";

import { ConfirmDelete } from "@/components/admin/confirm-delete";
import { SelectField, SwitchField, TextAreaField, TextField } from "@/components/admin/form-fields";
import { handleResult } from "@/components/admin/form-utils";
import { moveItem, ReorderButtons } from "@/components/admin/reorder-buttons";
import { Badge } from "@/components/ui/badge";
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
import { Switch } from "@/components/ui/switch";
import { categoryLabel, SERVICE_CATEGORIES } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { reviewSchema, type ReviewFormInput } from "@/lib/validations/reviews";
import {
  createReview,
  deleteReview,
  reorderReviews,
  setReviewPublished,
  updateReview,
} from "@/server/actions/reviews";
import type { Review } from "@/server/queries/reviews";

const RATINGS = [
  { value: "5", label: "★★★★★  5 stars" },
  { value: "4", label: "★★★★  4 stars" },
  { value: "3", label: "★★★  3 stars" },
  { value: "2", label: "★★  2 stars" },
  { value: "1", label: "★  1 star" },
  { value: "", label: "No star rating" },
];

export function ReviewsManager({ reviews: initial }: { reviews: Review[] }) {
  const [reviews, setReviews] = useState(initial);
  const [pending, startTransition] = useTransition();
  // null = closed, "new" = adding, otherwise the review being edited.
  const [editing, setEditing] = useState<Review | "new" | null>(null);
  // Re-sync when the server sends a fresh list (after refresh()).
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setReviews(initial);
  }

  function move(from: number, to: number) {
    const next = moveItem(reviews, from, to);
    setReviews(next);
    startTransition(async () => {
      const result = await reorderReviews({ ids: next.map((r) => r.id) });
      if (!handleResult(result, "")) setReviews(reviews);
    });
  }

  function toggle(review: Review, isPublished: boolean) {
    setReviews((list) =>
      list.map((r) => (r.id === review.id ? { ...r, is_published: isPublished } : r)),
    );
    startTransition(async () => {
      const result = await setReviewPublished({ id: review.id, isPublished });
      if (
        !handleResult(
          result,
          isPublished
            ? `${review.name}'s review is on the site.`
            : `${review.name}'s review is hidden.`,
        )
      ) {
        setReviews((list) => list.map((r) => (r.id === review.id ? review : r)));
      }
    });
  }

  const addButton = (
    <Button size="lg" onClick={() => setEditing("new")}>
      <PlusIcon aria-hidden />
      Add review
    </Button>
  );

  return (
    <>
      {reviews.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
          <MessageSquareQuoteIcon className="mx-auto size-10 text-terracotta" aria-hidden />
          <h2 className="mt-4 text-2xl font-semibold">No reviews yet</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Paste in kind words from happy clients (with their permission). The reviews section
            stays hidden on the site until you add one.
          </p>
          <div className="mt-6">{addButton}</div>
        </div>
      ) : (
        <>
          <div className="mb-4 flex justify-end">{addButton}</div>
          <ul className="space-y-3">
            {reviews.map((review, index) => (
              <li
                key={review.id}
                className={cn(
                  "flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-terracotta/40 hover:shadow-md sm:flex-row sm:items-center",
                  !review.is_published && "bg-muted/50",
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-heading text-lg font-semibold">{review.name}</h2>
                    {!review.is_published && <Badge variant="secondary">Hidden</Badge>}
                    {review.rating && <Stars rating={review.rating} />}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {review.shoot} · {categoryLabel(review.category)}
                  </p>
                  <p className="mt-2 line-clamp-2 text-sm">“{review.quote}”</p>
                </div>

                <div className="flex items-center justify-between gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                  <label className="flex min-h-11 items-center gap-2 text-sm">
                    <Switch
                      checked={review.is_published}
                      onCheckedChange={(v) => toggle(review, v)}
                      disabled={pending}
                      aria-label={`Show ${review.name}'s review on the site`}
                    />
                    <span className="sm:sr-only">On the site</span>
                  </label>
                  <div className="flex items-center">
                    <ReorderButtons
                      index={index}
                      count={reviews.length}
                      name={`${review.name}'s review`}
                      disabled={pending}
                      onMove={move}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Edit ${review.name}'s review`}
                      onClick={() => setEditing(review)}
                    >
                      <PencilIcon aria-hidden />
                    </Button>
                    <ConfirmDelete
                      label={`Delete ${review.name}'s review`}
                      title={`Delete ${review.name}'s review?`}
                      description="This can't be undone. To take it off the site for now, switch it off instead."
                      onConfirm={async () =>
                        handleResult(await deleteReview({ id: review.id }), "Review deleted.")
                      }
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
          {editing !== null && (
            <ReviewForm
              key={editing === "new" ? "new" : editing.id}
              review={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="flex gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <StarIcon
          key={i}
          className={cn("size-3.5", i < rating ? "fill-terracotta text-terracotta" : "text-border")}
          aria-hidden
        />
      ))}
    </span>
  );
}

function ReviewForm({ review, onDone }: { review?: Review; onDone: () => void }) {
  const form = useForm<ReviewFormInput, unknown, z.output<typeof reviewSchema>>({
    resolver: zodResolver(reviewSchema),
    defaultValues: review
      ? {
          name: review.name,
          category: review.category,
          shoot: review.shoot,
          quote: review.quote,
          rating: review.rating ? (String(review.rating) as ReviewFormInput["rating"]) : "",
          isPublished: review.is_published,
        }
      : {
          name: "",
          category: "wedding",
          shoot: "",
          quote: "",
          rating: "5",
          isPublished: true,
        },
  });

  async function onSubmit() {
    const values = form.getValues();
    const saved = review
      ? handleResult(await updateReview(review.id, values), "Review saved.", form)
      : handleResult(await createReview(values), "Review added.", form);
    if (saved) onDone();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>{review ? "Edit review" : "Add a review"}</DialogTitle>
        <DialogDescription>
          Only post reviews the client agreed to share. Their first name or initials is fine.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <TextAreaField
          control={form.control}
          name="quote"
          label="What they said"
          rows={5}
          maxLength={800}
          placeholder="They made us feel so relaxed…"
          description="Short and specific reads best: two or three sentences."
        />
        <TextField
          control={form.control}
          name="name"
          label="Client name"
          maxLength={80}
          placeholder="Maria & Jun"
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="shoot"
            label="What they booked"
            maxLength={80}
            placeholder="Prenup session"
          />
          <SelectField
            control={form.control}
            name="category"
            label="Category"
            options={SERVICE_CATEGORIES}
            description="It also shows on this category's package pages."
          />
        </div>
        <SelectField control={form.control} name="rating" label="Rating" options={RATINGS} />
        <SwitchField
          control={form.control}
          name="isPublished"
          label="Show on the site"
          description="Switch off to save it without showing it yet."
        />
      </FieldGroup>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting && <Loader2Icon className="animate-spin" aria-hidden />}
          {review ? "Save" : "Add review"}
        </Button>
      </DialogFooter>
    </form>
  );
}
