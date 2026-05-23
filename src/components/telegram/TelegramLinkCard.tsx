import { getSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import TelegramLinkCardClient from "./TelegramLinkCardClient";

export default async function TelegramLinkCard() {
  const user = await getSession();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("telegram_links")
    .select("is_active, username")
    .eq("profile_id", user.id)
    .maybeSingle();

  const linked = !!data?.is_active;

  return <TelegramLinkCardClient linked={linked} username={data?.username ?? null} />;
}
