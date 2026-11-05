"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CircleHelpIcon, Loader2Icon, PencilIcon, PlusIcon } from "lucide-react";
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
import { FAQ_TOKENS, FAQ_TOPICS, groupFaqs, type FaqTopic } from "@/lib/faq";
import { cn } from "@/lib/utils";
import { faqSchema, type FaqFormInput } from "@/lib/validations/faq";
import {
  createFaq,
  deleteFaq,
  reorderFaqs,
  setFaqPublished,
  updateFaq,
} from "@/server/actions/faq";
import type { Faq } from "@/server/queries/faq";

/**
 * Admin → FAQ: questions grouped by topic (the page's order), each with an
 * on/off switch, up/down arrows within its topic, edit and delete.
 */
export function FaqManager({ faqs: initial }: { faqs: Faq[] }) {
  const [faqs, setFaqs] = useState(initial);
  const [pending, startTransition] = useTransition();
  // null = closed, "new" = adding, otherwise the question being edited.
  const [editing, setEditing] = useState<Faq | "new" | null>(null);
  // Re-sync when the server sends a fresh list (after refresh()).
  const [prev, setPrev] = useState(initial);
  if (prev !== initial) {
    setPrev(initial);
    setFaqs(initial);
  }
  const groups = groupFaqs(faqs);

  function move(topic: string, from: number, to: number) {
    // Reorder inside the topic, then renumber the whole list topic by topic.
    const next = groups.flatMap((g) => (g.topic === topic ? moveItem(g.items, from, to) : g.items));
    const renumbered = next.map((f, i) => ({ ...f, sort_order: i }));
    const before = faqs;
    setFaqs(renumbered);
    startTransition(async () => {
      const result = await reorderFaqs({ ids: renumbered.map((f) => f.id) });
      if (!handleResult(result, "")) setFaqs(before);
    });
  }

  function toggle(faq: Faq, isPublished: boolean) {
    setFaqs((list) => list.map((f) => (f.id === faq.id ? { ...f, is_published: isPublished } : f)));
    startTransition(async () => {
      const result = await setFaqPublished({ id: faq.id, isPublished });
      if (!handleResult(result, isPublished ? "Question is on the site." : "Question is hidden.")) {
        setFaqs((list) => list.map((f) => (f.id === faq.id ? faq : f)));
      }
    });
  }

  const addButton = (
    <Button size="lg" onClick={() => setEditing("new")}>
      <PlusIcon aria-hidden />
      Add question
    </Button>
  );

  return (
    <>
      {faqs.length === 0 ? (
        <div className="rounded-3xl border border-dashed bg-card p-10 text-center">
          <CircleHelpIcon className="mx-auto size-10 text-terracotta" aria-hidden />
          <h2 className="mt-4 text-2xl font-semibold">No questions yet</h2>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Add the questions clients ask most. They appear on the Questions &amp; answers page.
          </p>
          <div className="mt-6">{addButton}</div>
        </div>
      ) : (
        <>
          <div className="mb-6 flex justify-end">{addButton}</div>
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.topic} aria-labelledby={`faq-topic-${group.topic}`}>
                <h2 id={`faq-topic-${group.topic}`} className="mb-3 text-xl font-semibold">
                  {group.label}
                </h2>
                <ul className="space-y-3">
                  {group.items.map((faq, index) => (
                    <li
                      key={faq.id}
                      className={cn(
                        "flex flex-col gap-4 rounded-2xl border bg-card p-4 transition-all duration-200 hover:border-terracotta/40 hover:shadow-md sm:flex-row sm:items-center",
                        !faq.is_published && "bg-muted/50",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{faq.question}</h3>
                          {!faq.is_published && <Badge variant="secondary">Hidden</Badge>}
                        </div>
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                          {faq.answer}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-2 border-t pt-3 sm:border-0 sm:pt-0">
                        <label className="flex min-h-11 items-center gap-2 text-sm">
                          <Switch
                            checked={faq.is_published}
                            onCheckedChange={(v) => toggle(faq, v)}
                            disabled={pending}
                            aria-label={`Show "${faq.question}" on the site`}
                          />
                          <span className="sm:sr-only">On the site</span>
                        </label>
                        <div className="flex items-center">
                          <ReorderButtons
                            index={index}
                            count={group.items.length}
                            name={`"${faq.question}"`}
                            disabled={pending}
                            onMove={(from, to) => move(group.topic, from, to)}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Edit "${faq.question}"`}
                            onClick={() => setEditing(faq)}
                          >
                            <PencilIcon aria-hidden />
                          </Button>
                          <ConfirmDelete
                            label={`Delete "${faq.question}"`}
                            title="Delete this question?"
                            description="This can't be undone. To take it off the site for now, switch it off instead."
                            onConfirm={async () =>
                              handleResult(await deleteFaq({ id: faq.id }), "Question deleted.")
                            }
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
          {editing !== null && (
            <FaqForm
              key={editing === "new" ? "new" : editing.id}
              faq={editing === "new" ? undefined : editing}
              onDone={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function FaqForm({ faq, onDone }: { faq?: Faq; onDone: () => void }) {
  const form = useForm<FaqFormInput, unknown, z.output<typeof faqSchema>>({
    resolver: zodResolver(faqSchema),
    defaultValues: faq
      ? {
          topic: faq.topic as FaqTopic,
          question: faq.question,
          answer: faq.answer,
          linkHref: faq.link_href ?? "",
          linkLabel: faq.link_label ?? "",
          isPublished: faq.is_published,
        }
      : {
          topic: "booking",
          question: "",
          answer: "",
          linkHref: "",
          linkLabel: "",
          isPublished: true,
        },
  });

  async function onSubmit() {
    const values = form.getValues();
    const saved = faq
      ? handleResult(await updateFaq(faq.id, values), "Question saved.", form)
      : handleResult(await createFaq(values), "Question added.", form);
    if (saved) onDone();
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
      <DialogHeader>
        <DialogTitle>{faq ? "Edit question" : "Add a question"}</DialogTitle>
        <DialogDescription>
          Shown on the Questions &amp; answers page under its topic.
        </DialogDescription>
      </DialogHeader>
      <FieldGroup>
        <SelectField control={form.control} name="topic" label="Topic" options={[...FAQ_TOPICS]} />
        <TextField
          control={form.control}
          name="question"
          label="Question"
          maxLength={200}
          placeholder="Can I bring my pet to the shoot?"
        />
        <TextAreaField
          control={form.control}
          name="answer"
          label="Answer"
          rows={6}
          maxLength={2000}
          description={
            <>
              These fill in from your settings, so they stay right when you change them:{" "}
              {FAQ_TOKENS.map((t, i) => (
                <span key={t.token}>
                  <code className="rounded bg-muted px-1">{t.token}</code> ({t.meaning})
                  {i < FAQ_TOKENS.length - 1 ? ", " : "."}
                </span>
              ))}
            </>
          }
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            control={form.control}
            name="linkHref"
            label="Button link (optional)"
            placeholder="/book"
            maxLength={300}
            description="A page on this site, or a full https:// link."
          />
          <TextField
            control={form.control}
            name="linkLabel"
            label="Button text"
            placeholder="Book now"
            maxLength={60}
          />
        </div>
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
          {faq ? "Save" : "Add question"}
        </Button>
      </DialogFooter>
    </form>
  );
}
