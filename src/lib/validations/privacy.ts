import { z } from "zod";

export const anonymiseClientSchema = z.object({
  id: z.uuid(),
  confirmName: z.string().trim().min(1, "Type the client's name to confirm.").max(120),
});

/** The typed name must match the client's, ignoring case and extra spaces. */
export function namesMatch(typed: string, name: string): boolean {
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(typed) === norm(name);
}
