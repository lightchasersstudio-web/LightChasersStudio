"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * Renders its children only until `until` (ISO time). For static, cached pages
 * that can't read the clock on the server, e.g. the workshop banner after the
 * workshop has ended. The server always renders the children.
 */
export function HideAfter({
  until,
  children,
}: {
  until: string | null;
  children: React.ReactNode;
}) {
  const show = useSyncExternalStore(
    noop,
    () => !until || Date.now() < Date.parse(until),
    () => true,
  );
  return show ? children : null;
}
