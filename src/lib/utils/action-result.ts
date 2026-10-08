/** Return type for every server action: never throw expected errors to the client. */
export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data });

export const fail = (
  error: string,
  fieldErrors?: Record<string, string[] | undefined>,
): ActionResult<never> => ({ ok: false, error, fieldErrors });
