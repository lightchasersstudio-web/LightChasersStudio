"use client";

import { useEffect, useState } from "react";

/**
 * What the floating buttons (book bar, Workshop pill) need to stay out of the way:
 * scrolled past the top, the footer on screen, a workshop banner on screen.
 * Re-runs per page because the footer and banners are new elements after navigation.
 */
export function useFloatingState(pathname: string) {
  const [scrolled, setScrolled] = useState(false);
  const [footerVisible, setFooterVisible] = useState(false);
  const [promoVisible, setPromoVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 320);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    const footer = document.getElementById("site-footer");
    const footerObserver = new IntersectionObserver(([entry]) =>
      setFooterVisible(entry?.isIntersecting ?? false),
    );
    if (footer) footerObserver.observe(footer);

    const onScreen = new Set<Element>();
    const promoObserver = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) onScreen.add(e.target);
        else onScreen.delete(e.target);
      }
      setPromoVisible(onScreen.size > 0);
    });
    document.querySelectorAll("[data-workshop-promo]").forEach((el) => promoObserver.observe(el));

    return () => {
      window.removeEventListener("scroll", onScroll);
      footerObserver.disconnect();
      promoObserver.disconnect();
      setPromoVisible(false); // the next page may have no banner
    };
  }, [pathname]);

  return { scrolled, footerVisible, promoVisible };
}
