"use client";

import { useEffect } from "react";

const MESSAGE = "You have unsaved changes. Leave without saving?";

/**
 * While a form has unsaved changes, asks before leaving: closing or reloading
 * the tab (the browser's own prompt) and clicking a link to another page.
 */
export function useUnsavedChangesWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();

    // Capture phase on document runs before Next's <Link> handler on the React root.
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return; // opening in a new tab keeps this one
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      const here = window.location;
      if (url.origin !== here.origin) return; // leaving the site: beforeunload asks
      if (url.pathname === here.pathname && url.search === here.search) return; // same page
      if (!window.confirm(MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);
}
