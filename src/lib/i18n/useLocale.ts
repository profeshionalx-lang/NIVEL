"use client";

import { useEffect, useState } from "react";
import { DEFAULT_LOCALE, type Locale } from "./dict";

const COOKIE = "nivel_lang";

function readLocale(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const raw = document.cookie
    .split("; ")
    .find((r) => r.startsWith(COOKIE + "="))
    ?.split("=")[1];
  return raw === "en" || raw === "ru" ? raw : DEFAULT_LOCALE;
}

export function useLocale(): Locale {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  useEffect(() => {
    setLocaleState(readLocale());
  }, []);
  return locale;
}
