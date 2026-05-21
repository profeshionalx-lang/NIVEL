import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { loadDashboardData } from "@/lib/dashboard/data";
import { createClient } from "@/lib/supabase/server";
import DashboardView from "@/components/dashboard/DashboardView";
import InviteBlock from "@/components/trainer/InviteBlock";
import TrainerMatchesBlock from "@/components/trainer/TrainerMatchesBlock";
import BackButton from "@/components/navigation/BackButton";

export default async function TrainerStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user || user.role !== "trainer") redirect("/dashboard");

  const { id: studentId } = await params;
  const locale = await getLocale();
  const nameCol = locale === "en" ? "name_en" : "name_ru";

  const [data, skillsRes] = await Promise.all([
    loadDashboardData(studentId, locale),
    createClient().then((sb) => sb.from("skills").select(`id, ${nameCol}`).order(nameCol)),
  ]);
  if (!data) redirect("/trainer/students");

  const allSkills = (skillsRes.data ?? []).map(
    (s: Record<string, unknown>) => ({ id: s.id as number, name: s[nameCol] as string })
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <BackButton fallbackHref="/trainer/students" />
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">Student</span>
        <Link
          href={`/trainer/students/${studentId}/preview`}
          className="flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.15em] text-on-surface-variant"
          title="Preview as student"
        >
          <span className="material-symbols-outlined text-base">visibility</span>
          View
        </Link>
      </header>

      <main className="px-5 pt-6 pb-36 max-w-4xl mx-auto space-y-6">
        <InviteBlock studentId={studentId} />
        <DashboardView
          data={data!}
          locale={locale}
          editable={{ studentId, trainerId: user!.id }}
          allSkills={allSkills}
        />
        <TrainerMatchesBlock studentId={studentId} locale={locale} />
      </main>
    </div>
  );
}
