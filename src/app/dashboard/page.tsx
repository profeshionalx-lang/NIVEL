import { getSession } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { getLocale } from "@/lib/i18n";
import { loadDashboardData } from "@/lib/dashboard/data";
import DashboardView from "@/components/dashboard/DashboardView";
import LanguageSwitcher from "@/components/navigation/LanguageSwitcher";

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect("/login");

  const locale = await getLocale();
  const data = await loadDashboardData(user!.id, locale);
  if (!data) redirect("/login");

  return (
    <>
      <DashboardView data={data!} locale={locale} />
      <LanguageSwitcher current={locale} />
    </>
  );
}
