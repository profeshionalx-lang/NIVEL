import { redirect } from "next/navigation";
import { DEMO_USER } from "@/lib/supabase/demoUser";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import BottomNav from "@/components/navigation/BottomNav";

export default async function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = DEMO_USER;
const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  return (
    <div className="relative mx-auto min-h-screen max-w-[430px] bg-background">
      {children}
      <BottomNav role={(profile as Pick<Profile, "role">).role} />
    </div>
  );
}
