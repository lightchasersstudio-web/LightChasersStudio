"use server";

import { z } from "zod";

import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { fail, ok, type ActionResult } from "@/lib/utils/action-result";

const inputSchema = z.object({ ext: z.enum(["webp", "jpg"]) });

/**
 * A one-time upload link for a student's ID photo (workshop sign-up). The
 * `student-ids` bucket is private: visitors can only upload through a link the
 * server makes, and only the server reads the files back, for the admin.
 * create_booking checks the file exists before it accepts a student.
 */
export async function getStudentIdUploadUrl(
  input: unknown,
): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return fail("Use a JPG, PNG or WebP photo.");
  if (!(await rateLimit("student-id", 10, 600))) {
    return fail("Too many uploads. Please wait a few minutes and try again.");
  }
  try {
    const path = `${crypto.randomUUID()}.${parsed.data.ext}`;
    const { data, error } = await createAdminClient()
      .storage.from("student-ids")
      .createSignedUploadUrl(path);
    if (error) throw error;
    return ok({ path: data.path, token: data.token });
  } catch (error) {
    console.error("[getStudentIdUploadUrl]", error);
    return fail("We couldn't start the upload. Please try again.");
  }
}
