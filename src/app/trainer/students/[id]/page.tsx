import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale } from "@/lib/i18n";
import { loadDashboardData } from "@/lib/dashboard/data";
import DashboardView from "@/components/dashboard/DashboardView";
import InviteBlock from "@/components/trainer/InviteBlock";

export default async function TrainerStudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getSession();
  if (!user || user.role !== "trainer") redirect("/dashboard");

  const { id: studentId } = await params;
  const locale = await getLocale();
  const data = await loadDashboardData(studentId, locale);
  if (!data) redirect("/trainer/students");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 glass-nav flex items-center justify-between px-6 h-16">
        <Link href="/trainer/students" className="text-on-surface-variant">
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <span className="text-lg font-black text-primary uppercase italic tracking-tight">Student</span>
        <div className="w-10" />
      </header>

      <main className="px-5 pt-6 pb-36 max-w-4xl mx-auto space-y-6">
        <InviteBlock studentId={studentId} />
        <DashboardView
          data={data!}
          locale={locale}
          editable={{ studentId, trainerId: user!.id }}
        />
      </main>
    </div>
  );
}
