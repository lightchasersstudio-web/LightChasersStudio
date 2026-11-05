import { z } from "zod";

import { FAQ_TOPIC_VALUES } from "@/lib/faq";

export const faqSchema = z
  .object({
    topic: z.enum(FAQ_TOPIC_VALUES, "Pick a topic."),
    question: z.string().trim().min(5, "Write the question.").max(200),
    answer: z
      .string()
      .trim()
      .min(5, "Write the answer.")
      .max(2000, "Keep the answer under 2,000 characters."),
    // Optional button under the answer: a page on this site ("/book") or a full https link.
    linkHref: z
      .string()
      .trim()
      .max(300)
      .refine(
        (v) => v === "" || /^(\/[A-Za-z0-9/_#?=&-]*|https:\/\/\S+)$/.test(v),
        "Use a page on this site like /book, or a full link starting with https://",
      ),
    linkLabel: z.string().trim().max(60),
    isPublished: z.boolean(),
  })
  .superRefine((v, ctx) => {
    if (v.linkHref && v.linkLabel.length < 2) {
      ctx.addIssue({ code: "custom", path: ["linkLabel"], message: "Add the button's text." });
    }
    if (!v.linkHref && v.linkLabel) {
      ctx.addIssue({ code: "custom", path: ["linkHref"], message: "Add where the button goes." });
    }
  })
  .transform((v) => ({
    topic: v.topic,
    question: v.question,
    answer: v.answer,
    link_href: v.linkHref || null,
    link_label: v.linkHref ? v.linkLabel : null,
    is_published: v.isPublished,
  }));

export type FaqFormInput = z.input<typeof faqSchema>;

export const faqIdSchema = z.object({ id: z.uuid() });
export const setFaqPublishedSchema = z.object({ id: z.uuid(), isPublished: z.boolean() });
