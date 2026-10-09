"use client";

import { type RefObject, useEffect } from "react";

/** The sticky header's height, `h-16`. */
const HEADER = 64;

/** While the ink hero is under the sticky header, the header has white text: see-through at the top, a blurred ink backdrop once scrolled (`html[data-nav]` in globals.css). */
export function useDarkNav(hero: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = document.documentElement;
    const update = () => {
      const bottom = hero.current?.getBoundingClientRect().bottom ?? 0;
      if (bottom <= HEADER) delete root.dataset.nav;
      else root.dataset.nav = window.scrollY > 0 ? "dark-solid" : "dark";
    };
    update();
    addEventListener("scroll", update, { passive: true });
    addEventListener("resize", update);
    return () => {
      removeEventListener("scroll", update);
      removeEventListener("resize", update);
      delete root.dataset.nav;
    };
  }, [hero]);
}
