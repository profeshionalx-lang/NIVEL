import { redirect } from "next/navigation";
import { DEMO_USER } from "@/lib/supabase/demoUser";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import TopBar from "@/components/navigation/TopBar";
import BottomNav from "@/components/navigation/BottomNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const user = DEMO_USER;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const typedProfile = (profile ?? DEMO_USER) as Profile;
  const isTrainer = typedProfile.role === "trainer";

  return (
    <div
      className={`relative mx-auto min-h-screen bg-background ${
        isTrainer ? "max-w-[430px] lg:max-w-4xl" : "max-w-[430px]"
      }`}
    >
      <TopBar
        profile={{
          full_name: typedProfile.full_name,
          avatar_url: typedProfile.avatar_url,
          role: typedProfile.role,
        }}
      />

      <main className="px-5 pt-4 pb-36">{children}</main>

      <BottomNav role={typedProfile.role} />
    </div>
  );
}
