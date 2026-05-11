import { cookies } from "next/headers";
import { DEFAULT_LOCALE, type Locale } from "./dict";

export const SUPPORTED_LOCALES: Locale[] = ["ru", "en"];
export const LOCALE_COOKIE = "nivel_lang";

function normalize(raw: string | undefined): Locale {
  return raw === "en" || raw === "ru" ? raw : DEFAULT_LOCALE;
}

export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return normalize(store.get(LOCALE_COOKIE)?.value);
}

export { t, dict, DEFAULT_LOCALE } from "./dict";
export type { Locale, DictKey } from "./dict";
